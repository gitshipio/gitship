/*
Copyright 2026.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package gitshipio

import (
	"context"
	"fmt"
	"strings"
	"time"

	cmv1 "github.com/cert-manager/cert-manager/pkg/apis/certmanager/v1"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing/transport"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/go-git/go-git/v5/plumbing/transport/ssh"
	"github.com/go-git/go-git/v5/storage/memory"
	golang_ssh "golang.org/x/crypto/ssh"
	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	gitshipiov1alpha1 "github.com/gitshipio/gitship/api/gitship.io/v1alpha1"
)

const logName = "gitshipapp-controller"
const phaseRunning = "Running"
const headRef = "HEAD"

var log = logf.Log.WithName(logName)

type ControllerConfig struct {
	RegistryPushURL string
	RegistryPullURL string
	SystemNamespace string

	IngressClassName    string
	DefaultStorageClass string

	// Default Quotas
	DefaultQuotaCPU     string
	DefaultQuotaRAM     string
	DefaultQuotaPods    string
	DefaultQuotaStorage string

	ImageGit    string
	ImageKaniko string
}

// GitshipAppReconciler reconciles a GitshipApp object
type GitshipAppReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Config ControllerConfig
}

// +kubebuilder:rbac:groups=gitship.io,resources=gitshipapps,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipapps/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipapps/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=services;secrets;pods;persistentvolumeclaims,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=batch,resources=jobs,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=ingresses;networkpolicies,verbs=get;list;watch;create;update;patch;delete

func (r *GitshipAppReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.WithValues("gitshipapp", req.NamespacedName)

	gitshipApp := &gitshipiov1alpha1.GitshipApp{}
	if err := r.Get(ctx, req.NamespacedName, gitshipApp); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	// 1. Try SSH Key
	privateKey := ""
	sshSecret := &corev1.Secret{}
	sshSecretName := fmt.Sprintf("%s-ssh-key", gitshipApp.Name)
	if err := r.Get(ctx, types.NamespacedName{Name: sshSecretName, Namespace: gitshipApp.Namespace}, sshSecret); err == nil {
		privateKey = string(sshSecret.Data["ssh-privatekey"])
		log.Info("DEBUG: Found SSH key secret", "secret", sshSecretName)
	} else {
		log.Info("DEBUG: SSH key secret not found", "secret", sshSecretName, "error", err)
	}

	// 2. Try GitHub Token
	githubToken := ""
	tokenSecret := &corev1.Secret{}
	if err := r.Get(ctx, types.NamespacedName{Name: "gitship-github-token", Namespace: gitshipApp.Namespace}, tokenSecret); err == nil {
		githubToken = string(tokenSecret.Data["token"])
	}

	// Resolve latest commit using 3-step strategy: SSH -> Token -> Anon
	repoURL := gitshipApp.Spec.RepoURL
	source := gitshipApp.Spec.Source

	latestCommit, err := resolveLatestCommit(repoURL, source, privateKey, githubToken)
	if err != nil {
		log.Error(err, "Failed to resolve latest commit", "repo", repoURL)

		// If it's an auth error, mark as AuthError phase
		errMsg := strings.ToLower(err.Error())
		if strings.Contains(errMsg, "auth") || strings.Contains(errMsg, "unauthorized") {
			gitshipApp.Status.Phase = "AuthError"
			_ = r.Status().Update(ctx, gitshipApp)
			return ctrl.Result{RequeueAfter: 5 * time.Minute}, nil
		}

		if gitshipApp.Status.Phase == "Building" {
			gitshipApp.Status.Phase = "Failed"
			_ = r.Status().Update(ctx, gitshipApp)
		}
		return ctrl.Result{RequeueAfter: 1 * time.Minute}, nil
	}

	// SUCCESS: Clear AuthError if it was set
	if gitshipApp.Status.Phase == "AuthError" {
		log.Info("Connection successful, clearing AuthError")
		gitshipApp.Status.Phase = phaseRunning
		if err := r.Status().Update(ctx, gitshipApp); err != nil {
			log.Error(err, "Failed to clear AuthError status")
		}
	}

	log.Info("Resolved latest commit", "commit", latestCommit, "source", source.Type, "value", source.Value)

	if gitshipApp.Status.LatestBuildID == latestCommit {
		// 0. Resolve Image
		_, image := r.resolveImageNames(gitshipApp, latestCommit)

		if err := r.ensureVolumes(ctx, gitshipApp); err != nil {
			return ctrl.Result{}, err
		}

		replicas := gitshipApp.Spec.Replicas
		if replicas == 0 {
			replicas = 1
		}

		if err := r.ensureDeployment(ctx, gitshipApp, image, replicas); err != nil {
			return ctrl.Result{}, err
		}

		if err := r.ensureService(ctx, gitshipApp); err != nil {
			return ctrl.Result{}, err
		}

		if err := r.ensureIngress(ctx, gitshipApp); err != nil {
			return ctrl.Result{}, err
		}

		// Update Status
		dep := &appsv1.Deployment{}
		_ = r.Get(ctx, types.NamespacedName{Name: gitshipApp.Name, Namespace: gitshipApp.Namespace}, dep)

		statusChanged := false
		if gitshipApp.Status.DesiredReplicas != replicas || gitshipApp.Status.ReadyReplicas != dep.Status.ReadyReplicas {
			gitshipApp.Status.DesiredReplicas = replicas
			gitshipApp.Status.ReadyReplicas = dep.Status.ReadyReplicas
			statusChanged = true
		}

		if dep.Status.ReadyReplicas > 0 && dep.Status.ReadyReplicas >= replicas {
			if gitshipApp.Status.Phase != phaseRunning {
				gitshipApp.Status.Phase = phaseRunning
				gitshipApp.Status.LastDeployedAt = metav1.Now().Format(time.RFC3339)
				statusChanged = true
			}
		}

		// Calculate AppURL based on Ingress
		newAppURL := ""
		if len(gitshipApp.Spec.Ingresses) > 0 {
			proto := "http"
			if gitshipApp.Spec.Ingresses[0].TLS {
				proto = "https"
			}
			newAppURL = fmt.Sprintf("%s://%s", proto, gitshipApp.Spec.Ingresses[0].Host)
		}

		if gitshipApp.Status.AppURL != newAppURL {
			gitshipApp.Status.AppURL = newAppURL
			statusChanged = true
		}

		// Cleanup: Force clear if it still contains internal domain (fallback)
		if strings.Contains(gitshipApp.Status.AppURL, ".svc.cluster.local") {
			gitshipApp.Status.AppURL = ""
			statusChanged = true
		}

		podList := &corev1.PodList{}
		if err := r.List(ctx, podList, client.InNamespace(gitshipApp.Namespace), client.MatchingLabels{"app": gitshipApp.Name}); err == nil {
			var totalRestarts int32
			for _, pod := range podList.Items {
				for _, cs := range pod.Status.ContainerStatuses {
					totalRestarts += cs.RestartCount
				}
			}
			if gitshipApp.Status.RestartCount != totalRestarts {
				gitshipApp.Status.RestartCount = totalRestarts
				statusChanged = true
			}
		}

		if statusChanged {
			if err := r.Status().Update(ctx, gitshipApp); err != nil {
				log.V(1).Info("Failed to update status", "error", err)
			}
		}

		requeueAfter := 5 * time.Minute
		if gitshipApp.Spec.UpdateStrategy.Type == "webhook" {
			requeueAfter = 0
		} else if gitshipApp.Spec.UpdateStrategy.Interval != "" {
			if parsed, err := time.ParseDuration(gitshipApp.Spec.UpdateStrategy.Interval); err == nil {
				requeueAfter = parsed
			}
		}

		return ctrl.Result{RequeueAfter: requeueAfter}, nil
	}

	log.Info("New commit detected", "commit", latestCommit, "old", gitshipApp.Status.LatestBuildID)

	jobName := fmt.Sprintf("%s-build-%s", gitshipApp.Name, latestCommit[:7])
	job := &batchv1.Job{}
	err = r.Get(ctx, types.NamespacedName{Name: jobName, Namespace: gitshipApp.Namespace}, job)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return ctrl.Result{}, err
	}

	if err != nil {
		gitshipApp.Status.Phase = "Building"
		gitshipApp.Status.LatestBuildID = latestCommit
		if err := r.Status().Update(ctx, gitshipApp); err != nil {
			return ctrl.Result{}, err
		}

		pushImage, _ := r.resolveImageNames(gitshipApp, latestCommit)

		// Use the same repository for caching, or a subpath
		cacheRepo := strings.Split(pushImage, ":")[0] + "-cache"

		kanikoArgs := []string{
			"--dockerfile=Dockerfile",
			"--context=dir:///workspace",
			"--destination=" + pushImage,
			"--cache=true",
			"--cache-repo=" + cacheRepo,
		}

		volumeMounts := []corev1.VolumeMount{{Name: "workspace", MountPath: "/workspace"}}
		volumes := []corev1.Volume{{Name: "workspace", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}}}}

		var initEnv []corev1.EnvVar
		if err := r.Get(ctx, types.NamespacedName{Name: "gitship-github-token", Namespace: gitshipApp.Namespace}, &corev1.Secret{}); err == nil {
			initEnv = append(initEnv, corev1.EnvVar{
				Name: "GITHUB_TOKEN",
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{Name: "gitship-github-token"},
						Key:                  "token",
					},
				},
			})
		}

		gitCloneCmd := `
			if [ -n "$GITHUB_TOKEN" ]; then 
				REPO_URL=$(echo $REPO_URL | sed "s/https:\/\//https:\/\/oauth2:$GITHUB_TOKEN@/"); 
			fi; 
			git clone $REPO_URL /workspace && cd /workspace && git checkout $COMMIT_ID
		`

		sshSecretName := fmt.Sprintf("%s-ssh-key", gitshipApp.Name)
		if err := r.Get(ctx, types.NamespacedName{Name: sshSecretName, Namespace: gitshipApp.Namespace}, &corev1.Secret{}); err == nil {
			sshUrl := gitshipApp.Spec.RepoURL
			if strings.HasPrefix(sshUrl, "https://github.com/") {
				sshUrl = strings.Replace(sshUrl, "https://github.com/", "git@github.com:", 1)
			}

			volumeMounts = append(volumeMounts, corev1.VolumeMount{Name: "ssh-key", MountPath: "/etc/ssh-key", ReadOnly: true})
			volumes = append(volumes, corev1.Volume{
				Name: "ssh-key",
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName:  sshSecretName,
						DefaultMode: func(i int32) *int32 { return &i }(0400),
					},
				},
			})

			gitCloneCmd = fmt.Sprintf(`
				mkdir -p /root/.ssh && 
				cp /etc/ssh-key/ssh-privatekey /root/.ssh/id_rsa && 
				chmod 600 /root/.ssh/id_rsa && 
				export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_rsa -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no" && 
				if git clone %s /workspace; then 
					cd /workspace && git checkout $COMMIT_ID; 
				else 
					if [ -n "$GITHUB_TOKEN" ]; then 
						REPO_URL=$(echo $REPO_URL | sed "s/https:\/\//https:\/\/oauth2:$GITHUB_TOKEN@/"); 
					fi; 
					git clone $REPO_URL /workspace && cd /workspace && git checkout $COMMIT_ID; 
				fi
			`, sshUrl)
		}

		buildResources := resolveResources(gitshipApp.Spec.Resources)

		newJob := &batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      jobName,
				Namespace: gitshipApp.Namespace,
				Labels:    map[string]string{"gitship.io/app": gitshipApp.Name, "gitship.io/commit": latestCommit},
			},
			Spec: batchv1.JobSpec{
				BackoffLimit:            func(i int32) *int32 { return &i }(1),
				TTLSecondsAfterFinished: func(i int32) *int32 { return &i }(3600),
				ActiveDeadlineSeconds:   func(i int64) *int64 { return &i }(3600),
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						RestartPolicy: corev1.RestartPolicyNever,
						InitContainers: []corev1.Container{{
							Name: "git-clone", Image: r.Config.ImageGit,
							Command: []string{"/bin/sh", "-c", gitCloneCmd},
							Env: append([]corev1.EnvVar{
								{Name: "REPO_URL", Value: gitshipApp.Spec.RepoURL},
								{Name: "COMMIT_ID", Value: latestCommit},
							}, initEnv...),
							VolumeMounts: volumeMounts, Resources: buildResources,
						}},
						Containers: []corev1.Container{{
							Name: "kaniko", Image: r.Config.ImageKaniko,
							Args: kanikoArgs, VolumeMounts: volumeMounts, Resources: buildResources,
						}},
						Volumes: volumes,
					},
				},
			},
		}

		if err := ctrl.SetControllerReference(gitshipApp, newJob, r.Scheme); err != nil {
			return ctrl.Result{}, err
		}
		if err := r.Create(ctx, newJob); err != nil {
			return ctrl.Result{}, err
		}
	} else if job.Status.Succeeded > 0 {
		log.Info("Build Job succeeded, recording and re-reconciling")
		r.recordBuild(gitshipApp, latestCommit, "Succeeded", "Build completed successfully")
		return ctrl.Result{Requeue: true}, nil
	} else if job.Status.Failed > 0 {
		log.Info("Build Job failed, recording")
		gitshipApp.Status.Phase = "Failed"
		r.recordBuild(gitshipApp, latestCommit, "Failed", "Build job failed")
		_ = r.Status().Update(ctx, gitshipApp)
	}

	return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
}

func (r *GitshipAppReconciler) ensureService(ctx context.Context, gitshipApp *gitshipiov1alpha1.GitshipApp) error {
	var svcPorts []corev1.ServicePort
	for _, p := range gitshipApp.Spec.Ports {
		name := p.Name
		if name == "" {
			name = fmt.Sprintf("port-%d", p.Port)
		}
		svcPorts = append(svcPorts, corev1.ServicePort{
			Name:       name,
			Port:       p.Port,
			TargetPort: intstr.FromInt32(p.TargetPort),
			Protocol:   corev1.Protocol(strings.ToUpper(p.Protocol)),
		})
	}

	if len(svcPorts) == 0 {
		svcPorts = []corev1.ServicePort{{
			Name:       "http",
			Port:       80,
			TargetPort: intstr.FromInt(8080),
			Protocol:   corev1.ProtocolTCP,
		}}
	}

	svc := &corev1.Service{}
	svcName := gitshipApp.Name
	err := r.Get(ctx, types.NamespacedName{Name: svcName, Namespace: gitshipApp.Namespace}, svc)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}
	if err != nil {
		log.Info("Creating Service")
		newSvc := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      svcName,
				Namespace: gitshipApp.Namespace,
				Labels:    map[string]string{"app": gitshipApp.Name},
			},
			Spec: corev1.ServiceSpec{
				Selector: map[string]string{"app": gitshipApp.Name},
				Ports:    svcPorts,
				Type:     corev1.ServiceTypeClusterIP,
			},
		}
		if err := ctrl.SetControllerReference(gitshipApp, newSvc, r.Scheme); err != nil {
			return err
		}
		return r.Create(ctx, newSvc)
	}

	if !compareServicePorts(svc.Spec.Ports, svcPorts) {
		log.Info("Updating Service Ports")
		svc.Spec.Ports = svcPorts
		return r.Update(ctx, svc)
	}
	return nil
}

func (r *GitshipAppReconciler) ensureIngress(ctx context.Context, gitshipApp *gitshipiov1alpha1.GitshipApp) error {
	if len(gitshipApp.Spec.Ingresses) == 0 {
		ing := &networkingv1.Ingress{}
		err := r.Get(ctx, types.NamespacedName{Name: gitshipApp.Name, Namespace: gitshipApp.Namespace}, ing)
		if err == nil {
			log.Info("Cleaning up Ingress (no rules)")
			return r.Delete(ctx, ing)
		}
		return nil
	}

	ing := &networkingv1.Ingress{}
	ingName := gitshipApp.Name
	err := r.Get(ctx, types.NamespacedName{Name: ingName, Namespace: gitshipApp.Namespace}, ing)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	pathType := networkingv1.PathTypePrefix
	ingressClassName := r.Config.IngressClassName
	if ingressClassName == "" {
		ingressClassName = "nginx"
	}

	annotations := map[string]string{
		"kubernetes.io/ingress.class": ingressClassName,
	}

	var rules []networkingv1.IngressRule
	var tls []networkingv1.IngressTLS
	anyTlsEnabled := false

	for _, ingressConfig := range gitshipApp.Spec.Ingresses {
		path := ingressConfig.Path
		if path == "" {
			path = "/"
		}

		rules = append(rules, networkingv1.IngressRule{
			Host: ingressConfig.Host,
			IngressRuleValue: networkingv1.IngressRuleValue{
				HTTP: &networkingv1.HTTPIngressRuleValue{
					Paths: []networkingv1.HTTPIngressPath{
						{
							Path:     path,
							PathType: &pathType,
							Backend: networkingv1.IngressBackend{
								Service: &networkingv1.IngressServiceBackend{
									Name: gitshipApp.Name,
									Port: networkingv1.ServiceBackendPort{
										Number: ingressConfig.ServicePort,
									},
								},
							},
						},
					},
				},
			},
		})

		if ingressConfig.TLS {
			anyTlsEnabled = true
			tls = append(tls, networkingv1.IngressTLS{
				Hosts:      []string{ingressConfig.Host},
				SecretName: fmt.Sprintf("%s-%s-tls", gitshipApp.Name, strings.ReplaceAll(ingressConfig.Host, ".", "-")),
			})
		}
	}

	if anyTlsEnabled {
		// Check if local Issuer exists (created by User Controller)
		localIssuer := &cmv1.Issuer{}
		err := r.Get(ctx, types.NamespacedName{Name: "letsencrypt-prod", Namespace: gitshipApp.Namespace}, localIssuer)
		
		if err == nil {
			// Local issuer exists -> Use it
			annotations["cert-manager.io/issuer"] = "letsencrypt-prod"
		} else {
			// No local issuer -> No certificate. We don't want a global fallback.
			log.Info("Skipping certificate issuance: no local 'letsencrypt-prod' issuer found in namespace", "namespace", gitshipApp.Namespace)
		}
	}

	if err != nil {
		log.Info("Creating Ingress", "rules", len(rules))
		newIng := &networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{
				Name:        ingName,
				Namespace:   gitshipApp.Namespace,
				Annotations: annotations,
			},
			Spec: networkingv1.IngressSpec{
				IngressClassName: &ingressClassName,
				TLS:              tls,
				Rules:            rules,
			},
		}
		if err := ctrl.SetControllerReference(gitshipApp, newIng, r.Scheme); err != nil {
			return err
		}
		return r.Create(ctx, newIng)
	}

	log.Info("Updating Ingress", "rules", len(rules))
	ing.Annotations = annotations
	ing.Spec.IngressClassName = &ingressClassName
	ing.Spec.Rules = rules
	ing.Spec.TLS = tls
	return r.Update(ctx, ing)
}

func (r *GitshipAppReconciler) ensureDeployment(ctx context.Context, gitshipApp *gitshipiov1alpha1.GitshipApp, image string, replicas int32) error {
	dep := &appsv1.Deployment{}
	depName := gitshipApp.Name
	err := r.Get(ctx, types.NamespacedName{Name: depName, Namespace: gitshipApp.Namespace}, dep)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	var envVars []corev1.EnvVar
	for k, v := range gitshipApp.Spec.Env {
		envVars = append(envVars, corev1.EnvVar{Name: k, Value: v})
	}

	var envFrom []corev1.EnvFromSource
	for _, secretName := range gitshipApp.Spec.SecretRefs {
		envFrom = append(envFrom, corev1.EnvFromSource{
			SecretRef: &corev1.SecretEnvSource{
				LocalObjectReference: corev1.LocalObjectReference{Name: secretName},
			},
		})
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount

	// 1. Persistent Volumes
	for _, v := range gitshipApp.Spec.Volumes {
		pvcName := fmt.Sprintf("%s-%s", gitshipApp.Name, v.Name)
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      v.Name,
			MountPath: v.MountPath,
		})
		volumes = append(volumes, corev1.Volume{
			Name: v.Name,
			VolumeSource: corev1.VolumeSource{
				PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{
					ClaimName: pvcName,
				},
			},
		})
	}

	// 2. Secret Mounts (Files)
	for i, sm := range gitshipApp.Spec.SecretMounts {
		volName := fmt.Sprintf("secret-%d", i)
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      volName,
			MountPath: sm.MountPath,
			ReadOnly:  true,
		})
		volumes = append(volumes, corev1.Volume{
			Name: volName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: sm.SecretName,
				},
			},
		})
	}

	// 3. Common Temp Mounts (for non-root support)
	tempDirs := []string{"/tmp", "/var/cache/nginx", "/var/run"}
	for i, dir := range tempDirs {
		name := fmt.Sprintf("tmp-%d", i)
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      name,
			MountPath: dir,
		})
		volumes = append(volumes, corev1.Volume{
			Name: name,
			VolumeSource: corev1.VolumeSource{
				EmptyDir: &corev1.EmptyDirVolumeSource{},
			},
		})
	}

	appResources := resolveResources(gitshipApp.Spec.Resources)

	var imagePullSecrets []corev1.LocalObjectReference
	if gitshipApp.Spec.RegistrySecretRef != "" {
		imagePullSecrets = append(imagePullSecrets, corev1.LocalObjectReference{Name: gitshipApp.Spec.RegistrySecretRef})
	}

	if err != nil {
		log.Info("Creating Deployment", "image", image)

		var containerPorts []corev1.ContainerPort
		for _, p := range gitshipApp.Spec.Ports {
			containerPorts = append(containerPorts, corev1.ContainerPort{
				ContainerPort: p.TargetPort,
				Protocol:      corev1.Protocol(strings.ToUpper(p.Protocol)),
			})
		}
		if len(containerPorts) == 0 {
			containerPorts = []corev1.ContainerPort{{ContainerPort: 8080}}
		}

		liveness, readiness := resolveProbes(gitshipApp.Spec.HealthCheck)

		newDep := &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      depName,
				Namespace: gitshipApp.Namespace,
				Labels:    map[string]string{"app": gitshipApp.Name},
			},
			Spec: appsv1.DeploymentSpec{
				Replicas: &replicas,
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": gitshipApp.Name},
				},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"app": gitshipApp.Name},
					},
					Spec: corev1.PodSpec{
						SecurityContext: &corev1.PodSecurityContext{
							// Allow image default user (often root) to support standard images like nginx:alpine
							// but still keep some level of isolation via other fields.
							FSGroup: func(i int64) *int64 { return &i }(1000),
						},
						Containers: []corev1.Container{
							{
								Name:  "app",
								Image: image,
								SecurityContext: &corev1.SecurityContext{
									AllowPrivilegeEscalation: func(b bool) *bool { return &b }(false),
									ReadOnlyRootFilesystem:   func(b bool) *bool { return &b }(false),
								},
								Ports:          containerPorts,
								Env:            envVars,
								EnvFrom:        envFrom,
								VolumeMounts:   volumeMounts,
								Resources:      appResources,
								LivenessProbe:  liveness,
								ReadinessProbe: readiness,
							},
						},
						ImagePullSecrets: imagePullSecrets,
						Volumes:          volumes,
					},
				},
			},
		}
		if err := ctrl.SetControllerReference(gitshipApp, newDep, r.Scheme); err != nil {
			return err
		}
		if err := r.Create(ctx, newDep); err != nil {
			log.Error(err, "Failed to create Deployment")
			return err
		}
	} else {
		changed := false
		if *dep.Spec.Replicas != replicas {
			log.Info("Updating Replicas", "old", *dep.Spec.Replicas, "new", replicas)
			dep.Spec.Replicas = &replicas
			changed = true
		}

		container := &dep.Spec.Template.Spec.Containers[0]
		if container.Image != image {
			log.Info("Updating Deployment Image", "old", container.Image, "new", image)
			container.Image = image
			changed = true
		}

		var targetContainerPorts []corev1.ContainerPort
		for _, p := range gitshipApp.Spec.Ports {
			targetContainerPorts = append(targetContainerPorts, corev1.ContainerPort{
				ContainerPort: p.TargetPort,
				Protocol:      corev1.Protocol(strings.ToUpper(p.Protocol)),
			})
		}
		if len(targetContainerPorts) == 0 {
			targetContainerPorts = []corev1.ContainerPort{{ContainerPort: 8080}}
		}

		if !compareContainerPorts(container.Ports, targetContainerPorts) {
			log.Info("Updating Deployment Ports")
			container.Ports = targetContainerPorts
			changed = true
		}

		var targetEnv []corev1.EnvVar
		for k, v := range gitshipApp.Spec.Env {
			targetEnv = append(targetEnv, corev1.EnvVar{Name: k, Value: v})
		}
		if !compareEnv(container.Env, targetEnv) {
			log.Info("Updating Env Vars")
			container.Env = targetEnv
			changed = true
		}

		if !compareEnvFrom(container.EnvFrom, envFrom) {
			log.Info("Updating EnvFrom (Secrets)")
			container.EnvFrom = envFrom
			changed = true
		}

		if !compareVolumeMounts(container.VolumeMounts, volumeMounts) || !compareVolumes(dep.Spec.Template.Spec.Volumes, volumes) {
			log.Info("Updating Volumes/Mounts")
			container.VolumeMounts = volumeMounts
			dep.Spec.Template.Spec.Volumes = volumes
			changed = true
		}

		if !compareResources(container.Resources, appResources) {
			log.Info("Updating Resources")
			container.Resources = appResources
			changed = true
		}

		// SecurityContext Updates
		targetPodSC := &corev1.PodSecurityContext{
			FSGroup: func(i int64) *int64 { return &i }(1000),
		}
		targetContainerSC := &corev1.SecurityContext{
			AllowPrivilegeEscalation: func(b bool) *bool { return &b }(false),
			ReadOnlyRootFilesystem:   func(b bool) *bool { return &b }(false),
		}

		if !comparePodSecurityContext(dep.Spec.Template.Spec.SecurityContext, targetPodSC) {
			log.Info("Updating Pod SecurityContext")
			dep.Spec.Template.Spec.SecurityContext = targetPodSC
			changed = true
		}
		if !compareContainerSecurityContext(container.SecurityContext, targetContainerSC) {
			log.Info("Updating Container SecurityContext")
			container.SecurityContext = targetContainerSC
			changed = true
		}

		liveness, readiness := resolveProbes(gitshipApp.Spec.HealthCheck)
		if !compareProbes(container.LivenessProbe, liveness) || !compareProbes(container.ReadinessProbe, readiness) {
			log.Info("Updating Health Probes")
			container.LivenessProbe = liveness
			container.ReadinessProbe = readiness
			changed = true
		}

		if changed {
			if err := r.Update(ctx, dep); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *GitshipAppReconciler) ensureVolumes(ctx context.Context, gitshipApp *gitshipiov1alpha1.GitshipApp) error {
	for _, vol := range gitshipApp.Spec.Volumes {
		pvc := &corev1.PersistentVolumeClaim{}
		pvcName := fmt.Sprintf("%s-%s", gitshipApp.Name, vol.Name)
		err := r.Get(ctx, types.NamespacedName{Name: pvcName, Namespace: gitshipApp.Namespace}, pvc)
		if err != nil && client.IgnoreNotFound(err) != nil {
			return err
		}

		if err != nil {
			log.Info("Creating PVC", "name", pvcName, "size", vol.Size)
			storageClass := vol.StorageClass
			newPvc := &corev1.PersistentVolumeClaim{
				ObjectMeta: metav1.ObjectMeta{
					Name:      pvcName,
					Namespace: gitshipApp.Namespace,
				},
				Spec: corev1.PersistentVolumeClaimSpec{
					AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
					Resources: corev1.VolumeResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceStorage: resource.MustParse(vol.Size),
						},
					},
				},
			}
			if storageClass != "" {
				newPvc.Spec.StorageClassName = &storageClass
			} else if r.Config.DefaultStorageClass != "" {
				newPvc.Spec.StorageClassName = &r.Config.DefaultStorageClass
			}
			if err := ctrl.SetControllerReference(gitshipApp, newPvc, r.Scheme); err != nil {
				return err
			}
			if err := r.Create(ctx, newPvc); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *GitshipAppReconciler) recordBuild(app *gitshipiov1alpha1.GitshipApp, commit string, status string, message string) {
	record := gitshipiov1alpha1.BuildRecord{
		CommitID:       commit,
		Status:         status,
		CompletionTime: metav1.Now().Format(time.RFC3339),
		Message:        message,
	}

	// Keep last 10 builds
	history := append([]gitshipiov1alpha1.BuildRecord{record}, app.Status.BuildHistory...)
	if len(history) > 10 {
		history = history[:10]
	}
	app.Status.BuildHistory = history
}

func resolveLatestCommit(repoURL string, source gitshipiov1alpha1.SourceConfig, privateKey string, token string) (string, error) {
	if source.Type == "commit" {
		return source.Value, nil
	}

	tryFetch := func(url string, auth transport.AuthMethod) (string, error) {
		rem := git.NewRemote(memory.NewStorage(), &config.RemoteConfig{Name: "origin", URLs: []string{url}})
		refs, err := rem.List(&git.ListOptions{Auth: auth})
		if err != nil {
			return "", err
		}
		target := headRef
		if source.Type == "branch" && source.Value != "" && source.Value != headRef {
			target = "refs/heads/" + source.Value
		} else if source.Type == "tag" {
			target = "refs/tags/" + source.Value
		}
		for _, ref := range refs {
			if ref.Name().String() == target {
				return ref.Hash().String(), nil
			}
			if target == headRef && (ref.Name().String() == "refs/heads/main" || ref.Name().String() == "refs/heads/master") {
				return ref.Hash().String(), nil
			}
		}
		return "", fmt.Errorf("ref %s not found", target)
	}

	var lastErr error
	if privateKey != "" {
		sshUrl := repoURL
		if strings.Contains(sshUrl, "github.com") && !strings.HasPrefix(sshUrl, "git@") {
			trimmed := strings.TrimPrefix(sshUrl, "https://github.com/")
			trimmed = strings.TrimPrefix(trimmed, "http://github.com/")
			sshUrl = "git@github.com:" + trimmed
		}
		publicKeys, err := ssh.NewPublicKeys("git", []byte(privateKey), "")
		if err == nil {
			publicKeys.HostKeyCallback = golang_ssh.InsecureIgnoreHostKey()
			hash, err := tryFetch(sshUrl, publicKeys)
			if err == nil {
				return hash, nil
			}
			lastErr = fmt.Errorf("SSH failed: %w", err)
		}
	}

	if token != "" {
		basicAuth := &http.BasicAuth{Username: "oauth2", Password: token}
		hash, err := tryFetch(repoURL, basicAuth)
		if err == nil {
			return hash, nil
		}
		lastErr = fmt.Errorf("token failed: %w (prev: %v)", err, lastErr)
	}

	hash, err := tryFetch(repoURL, nil)
	if err == nil {
		return hash, nil
	}
	return "", fmt.Errorf("all auth methods failed. Last error: %w (prev: %v)", err, lastErr)
}

func (r *GitshipAppReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&gitshipiov1alpha1.GitshipApp{}).
		Owns(&appsv1.Deployment{}).
		Owns(&corev1.Service{}).
		Owns(&networkingv1.Ingress{}).
		Complete(r)
}

func (r *GitshipAppReconciler) resolveImageNames(app *gitshipiov1alpha1.GitshipApp, commit string) (pushImage, pullImage string) {
	baseName := strings.ToLower(app.Spec.ImageName)
	if idx := strings.LastIndex(baseName, ":"); idx != -1 {
		afterColon := baseName[idx+1:]
		if !strings.Contains(afterColon, "/") {
			baseName = baseName[:idx]
		}
	}

	if app.Spec.RegistrySecretRef == "" {
		pushRepo := r.Config.RegistryPushURL
		if pushRepo == "" {
			pushRepo = fmt.Sprintf("gitship-registry.%s.svc.cluster.local:5000", r.Config.SystemNamespace)
		}

		pullRepo := r.Config.RegistryPullURL
		if pullRepo == "" {
			// Smart Fallback: If pushing to internal registry service, default pull to NodePort (for Kind/Local)
			if strings.Contains(pushRepo, "gitship-registry") && strings.Contains(pushRepo, ".svc.cluster.local") {
				pullRepo = "localhost:30005"
			} else {
				pullRepo = pushRepo
			}
		}

		pushImage = fmt.Sprintf("%s/%s:%s", pushRepo, baseName, commit)
		pullImage = fmt.Sprintf("%s/%s:%s", pullRepo, baseName, commit)
	} else {
		pushImage = fmt.Sprintf("%s:%s", baseName, commit)
		pullImage = pushImage
	}
	return pushImage, pullImage
}

func resolveResources(resourceConfig gitshipiov1alpha1.ResourceConfig) corev1.ResourceRequirements {
	cpuLimit := resourceConfig.CPU
	if cpuLimit == "" {
		cpuLimit = "500m"
	}
	memLimit := resourceConfig.Memory
	if memLimit == "" {
		memLimit = "1Gi"
	}
	cpuReq := "100m"
	memReq := "512Mi"
	if cpu, err := resource.ParseQuantity(cpuLimit); err == nil {
		cpuReq = fmt.Sprintf("%dm", cpu.MilliValue()/4)
	}
	if mem, err := resource.ParseQuantity(memLimit); err == nil {
		memReq = fmt.Sprintf("%d", mem.Value()/2)
	}
	return corev1.ResourceRequirements{
		Limits:   corev1.ResourceList{corev1.ResourceCPU: resource.MustParse(cpuLimit), corev1.ResourceMemory: resource.MustParse(memLimit)},
		Requests: corev1.ResourceList{corev1.ResourceCPU: resource.MustParse(cpuReq), corev1.ResourceMemory: resource.MustParse(memReq)},
	}
}

func compareEnv(a, b []corev1.EnvVar) bool {
	if len(a) != len(b) {
		return false
	}
	m := make(map[string]string)
	for _, e := range a {
		m[e.Name] = e.Value
	}
	for _, e := range b {
		if val, ok := m[e.Name]; !ok || val != e.Value {
			return false
		}
	}
	return true
}

func compareEnvFrom(a, b []corev1.EnvFromSource) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].SecretRef == nil || b[i].SecretRef == nil {
			if a[i].SecretRef != b[i].SecretRef {
				return false
			}
			continue
		}
		if a[i].SecretRef.Name != b[i].SecretRef.Name {
			return false
		}
	}
	return true
}

func compareVolumeMounts(a, b []corev1.VolumeMount) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Name != b[i].Name || a[i].MountPath != b[i].MountPath {
			return false
		}
	}
	return true
}

func compareVolumes(a, b []corev1.Volume) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			return false
		}
		if a[i].PersistentVolumeClaim == nil || b[i].PersistentVolumeClaim == nil {
			if a[i].PersistentVolumeClaim != b[i].PersistentVolumeClaim {
				return false
			}
			continue
		}
		if a[i].PersistentVolumeClaim.ClaimName != b[i].PersistentVolumeClaim.ClaimName {
			return false
		}
	}
	return true
}

func compareResources(a, b corev1.ResourceRequirements) bool {
	aqCpu := a.Limits[corev1.ResourceCPU]
	bqCpu := b.Limits[corev1.ResourceCPU]
	aqMem := a.Limits[corev1.ResourceMemory]
	bqMem := b.Limits[corev1.ResourceMemory]

	return aqCpu.Cmp(bqCpu) == 0 && aqMem.Cmp(bqMem) == 0
}

func comparePodSecurityContext(a, b *corev1.PodSecurityContext) bool {
	if a == nil || b == nil {
		return a == b
	}

	// Check RunAsUser
	if (a.RunAsUser == nil) != (b.RunAsUser == nil) {
		return false
	}
	if a.RunAsUser != nil && *a.RunAsUser != *b.RunAsUser {
		return false
	}

	// Check RunAsNonRoot
	if (a.RunAsNonRoot == nil) != (b.RunAsNonRoot == nil) {
		return false
	}
	if a.RunAsNonRoot != nil && *a.RunAsNonRoot != *b.RunAsNonRoot {
		return false
	}

	// Check FSGroup
	if (a.FSGroup == nil) != (b.FSGroup == nil) {
		return false
	}
	if a.FSGroup != nil && *a.FSGroup != *b.FSGroup {
		return false
	}

	return true
}

func compareContainerSecurityContext(a, b *corev1.SecurityContext) bool {
	if a == nil || b == nil {
		return a == b
	}

	if (a.AllowPrivilegeEscalation == nil) != (b.AllowPrivilegeEscalation == nil) {
		return false
	}
	if a.AllowPrivilegeEscalation != nil && *a.AllowPrivilegeEscalation != *b.AllowPrivilegeEscalation {
		return false
	}

	if (a.ReadOnlyRootFilesystem == nil) != (b.ReadOnlyRootFilesystem == nil) {
		return false
	}
	if a.ReadOnlyRootFilesystem != nil && *a.ReadOnlyRootFilesystem != *b.ReadOnlyRootFilesystem {
		return false
	}

	// Compare Capabilities (Simplified)
	if a.Capabilities == nil || b.Capabilities == nil {
		return a.Capabilities == b.Capabilities
	}
	if len(a.Capabilities.Add) != len(b.Capabilities.Add) || len(a.Capabilities.Drop) != len(b.Capabilities.Drop) {
		return false
	}

	return true
}

func compareContainerPorts(a, b []corev1.ContainerPort) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].ContainerPort != b[i].ContainerPort || a[i].Protocol != b[i].Protocol {
			return false
		}
	}
	return true
}

func compareServicePorts(a, b []corev1.ServicePort) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Port != b[i].Port || a[i].TargetPort != b[i].TargetPort || a[i].Protocol != b[i].Protocol {
			return false
		}
	}
	return true
}

func compareProbes(a, b *corev1.Probe) bool {
	if a == nil || b == nil {
		return a == b
	}
	if a.HTTPGet == nil || b.HTTPGet == nil {
		return a.HTTPGet == b.HTTPGet
	}
	return a.HTTPGet.Path == b.HTTPGet.Path &&
		a.HTTPGet.Port.IntVal == b.HTTPGet.Port.IntVal &&
		a.InitialDelaySeconds == b.InitialDelaySeconds &&
		a.TimeoutSeconds == b.TimeoutSeconds
}

func resolveProbes(hcConfig gitshipiov1alpha1.HealthCheckConfig) (liveness, readiness *corev1.Probe) {
	if hcConfig.Path == "" {
		return nil, nil
	}

	port := hcConfig.Port
	if port == 0 {
		port = 8080 // Heuristic default
	}

	initialDelay := hcConfig.InitialDelay
	if initialDelay == 0 {
		initialDelay = 10
	}

	timeout := hcConfig.Timeout
	if timeout == 0 {
		timeout = 5
	}

	probe := &corev1.Probe{
		ProbeHandler: corev1.ProbeHandler{
			HTTPGet: &corev1.HTTPGetAction{
				Path: hcConfig.Path,
				Port: intstr.FromInt32(port),
			},
		},
		InitialDelaySeconds: initialDelay,
		TimeoutSeconds:      timeout,
		PeriodSeconds:       10,
		SuccessThreshold:    1,
		FailureThreshold:    3,
	}

	return probe, probe
}
