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

	acmev1 "github.com/cert-manager/cert-manager/pkg/apis/acme/v1"
	cmv1 "github.com/cert-manager/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/cert-manager/cert-manager/pkg/apis/meta/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	gitshipiov1alpha1 "github.com/gitshipio/gitship/api/gitship.io/v1alpha1"
)

// GitshipUserReconciler reconciles a GitshipUser object
type GitshipUserReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Config ControllerConfig
}

// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers/finalizers,verbs=update
// +kubebuilder:rbac:groups="",resources=namespaces,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=resourcequotas,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=networkpolicies,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=cert-manager.io,resources=issuers,verbs=get;list;watch;create;update;patch;delete

// Reconcile GitshipUser.
func (r *GitshipUserReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	// Fetch the GitshipUser instance
	gitshipUser := &gitshipiov1alpha1.GitshipUser{}
	if err := r.Get(ctx, req.NamespacedName, gitshipUser); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	log.Info("Reconciling GitshipUser", "user", gitshipUser.Spec.GitHubUsername, "id", gitshipUser.Name)

	// Use the metadata name (u-ID) as the base for the namespace
	nsName := "gitship-" + gitshipUser.Name

	ns := &corev1.Namespace{}
	err := r.Get(ctx, client.ObjectKey{Name: nsName}, ns)
	if err != nil && client.IgnoreNotFound(err) != nil {
		log.Error(err, "Failed to get Namespace", "namespace", nsName)
		return ctrl.Result{}, err
	}

	if err != nil {
		log.Info("Creating Namespace", "namespace", nsName)
		newNs := &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: nsName,
				Labels: map[string]string{
					"app.kubernetes.io/managed-by": "gitship-controller",
					"gitship.io/user":              gitshipUser.Name,
					"gitship.io/github-username":   strings.ToLower(gitshipUser.Spec.GitHubUsername),
				},
			},
		}
		if err := r.Create(ctx, newNs); err != nil {
			log.Error(err, "Failed to create Namespace", "namespace", nsName)
			return ctrl.Result{}, err
		}
	}

	for _, reg := range gitshipUser.Spec.Registries {
		if err := r.ensureRegistrySecret(ctx, nsName, reg); err != nil {
			log.Error(err, "Failed to sync registry secret", "namespace", nsName, "registry", reg.Name)
			return ctrl.Result{}, err
		}
	}

	// Ensure ResourceQuotas exist
	if err := r.ensureResourceQuota(ctx, nsName, gitshipUser.Spec.Quotas); err != nil {
		log.Error(err, "Failed to sync resource quota", "namespace", nsName)
		return ctrl.Result{}, err
	}

	// Ensure NetworkPolicy exists
	if err := r.ensureNetworkPolicy(ctx, nsName); err != nil {
		log.Error(err, "Failed to sync network policy", "namespace", nsName)
		return ctrl.Result{}, err
	}

	// Ensure Cert-Manager Issuer exists if integration is enabled
	integrations := &gitshipiov1alpha1.GitshipIntegrationList{}
	hasCertManager := false
	if err := r.List(ctx, integrations, client.InNamespace(nsName)); err == nil {
		for _, integration := range integrations.Items {
			if strings.ToLower(integration.Spec.Type) == "cert-manager" && integration.Spec.Enabled {
				hasCertManager = true
				break
			}
		}
	}

	if hasCertManager && gitshipUser.Spec.Email != "" {
		if err := r.ensureIssuer(ctx, nsName, gitshipUser.Spec.Email, gitshipUser); err != nil {
			log.Error(err, "Failed to sync issuer", "namespace", nsName)
			return ctrl.Result{}, err
		}
	} else if !hasCertManager {
		// Cleanup issuer if integration is removed
		issuer := &cmv1.Issuer{}
		if err := r.Get(ctx, client.ObjectKey{Namespace: nsName, Name: "letsencrypt-prod"}, issuer); err == nil {
			log.Info("Cleaning up Issuer as integration is disabled/missing", "namespace", nsName)
			_ = r.Delete(ctx, issuer)
		}
	}

	gitshipUser.Status.Ready = true
	gitshipUser.Status.Namespaces = []string{nsName}
	if err := r.Status().Update(ctx, gitshipUser); err != nil {
		log.Error(err, "Failed to update GitshipUser status")
		return ctrl.Result{}, err
	}

	return ctrl.Result{}, nil
}

func (r *GitshipUserReconciler) ensureRegistrySecret(ctx context.Context, namespace string, reg gitshipiov1alpha1.RegistryConfig) error {
	secretName := fmt.Sprintf("gitship-registry-%s", reg.Name)

	dockerConfig, err := createDockerConfigJSON(reg.Server, reg.Username, reg.Password)
	if err != nil {
		return err
	}

	secret := &corev1.Secret{}
	err = r.Get(ctx, client.ObjectKey{Namespace: namespace, Name: secretName}, secret)

	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	if err != nil {
		newSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: namespace,
				Labels: map[string]string{
					"gitship.io/managed-by": "gitship-user-controller",
				},
			},
			Type: corev1.SecretTypeDockerConfigJson,
			Data: map[string][]byte{
				corev1.DockerConfigJsonKey: dockerConfig,
			},
		}
		return r.Create(ctx, newSecret)
	}

	if string(secret.Data[corev1.DockerConfigJsonKey]) != string(dockerConfig) {
		secret.Data[corev1.DockerConfigJsonKey] = dockerConfig
		return r.Update(ctx, secret)
	}

	return nil
}

func (r *GitshipUserReconciler) ensureResourceQuota(ctx context.Context, namespace string, quotas gitshipiov1alpha1.UserQuotas) error {
	quotaName := "user-quota"

	// Use defaults from config if not set in CRD
	cpu := quotas.CPU
	if cpu == "" {
		cpu = r.Config.DefaultQuotaCPU
	}
	if cpu == "" {
		cpu = "4"
	} // Final fallback

	mem := quotas.Memory
	if mem == "" {
		mem = r.Config.DefaultQuotaRAM
	}
	if mem == "" {
		mem = "8Gi"
	}

	pods := quotas.Pods
	if pods == "" {
		pods = r.Config.DefaultQuotaPods
	}
	if pods == "" {
		pods = "20"
	}

	storage := quotas.Storage
	if storage == "" {
		storage = r.Config.DefaultQuotaStorage
	}
	if storage == "" {
		storage = "10Gi"
	}

	targetResources := corev1.ResourceList{
		corev1.ResourceRequestsCPU:     resource.MustParse(cpu),
		corev1.ResourceLimitsCPU:       resource.MustParse(cpu),
		corev1.ResourceRequestsMemory:  resource.MustParse(mem),
		corev1.ResourceLimitsMemory:    resource.MustParse(mem),
		corev1.ResourcePods:            resource.MustParse(pods),
		corev1.ResourceRequestsStorage: resource.MustParse(storage),
	}

	log := logf.Log.WithName("gitshipuser-controller")
	log.Info("Applying ResourceQuota", "namespace", namespace, "resources", targetResources)

	quota := &corev1.ResourceQuota{}
	err := r.Get(ctx, client.ObjectKey{Namespace: namespace, Name: quotaName}, quota)

	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	if err != nil {
		// Create
		newQuota := &corev1.ResourceQuota{
			ObjectMeta: metav1.ObjectMeta{
				Name:      quotaName,
				Namespace: namespace,
				Labels: map[string]string{
					"gitship.io/managed-by": "gitship-user-controller",
				},
			},
			Spec: corev1.ResourceQuotaSpec{
				Hard: targetResources,
			},
		}
		return r.Create(ctx, newQuota)
	}

	// Update if changed
	quota.Spec.Hard = targetResources
	return r.Update(ctx, quota)
}

func (r *GitshipUserReconciler) ensureNetworkPolicy(ctx context.Context, namespace string) error {
	policyName := "isolate-user"

	policy := &networkingv1.NetworkPolicy{}
	err := r.Get(ctx, client.ObjectKey{Namespace: namespace, Name: policyName}, policy)

	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	if err == nil {
		// Policy exists, we don't update complex policies for now to avoid breaking custom tweaks
		return nil
	}

	// Create default policy: Allow all in namespace, allow from system namespace (Ingress), deny others
	newPolicy := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      policyName,
			Namespace: namespace,
			Labels: map[string]string{
				"gitship.io/managed-by": "gitship-user-controller",
			},
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
			Ingress: []networkingv1.NetworkPolicyIngressRule{
				{
					// Allow from same namespace
					From: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"kubernetes.io/metadata.name": namespace,
								},
							},
						},
					},
				},
				{
					// Allow from system namespace (for Ingress/Health probes)
					From: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"kubernetes.io/metadata.name": r.Config.SystemNamespace,
								},
							},
						},
					},
				},
			},
		},
	}
	return r.Create(ctx, newPolicy)
}

func (r *GitshipUserReconciler) ensureIssuer(ctx context.Context, namespace string, email string, gitshipUser *gitshipiov1alpha1.GitshipUser) error {
	issuerName := "letsencrypt-prod"
	issuer := &cmv1.Issuer{}
	err := r.Get(ctx, client.ObjectKey{Namespace: namespace, Name: issuerName}, issuer)

	if err != nil && client.IgnoreNotFound(err) != nil {
		return err
	}

	spec := cmv1.IssuerSpec{
		IssuerConfig: cmv1.IssuerConfig{
			ACME: &acmev1.ACMEIssuer{
				Server: "https://acme-v02.api.letsencrypt.org/directory",
				Email:  email,
				PrivateKey: cmmeta.SecretKeySelector{
					LocalObjectReference: cmmeta.LocalObjectReference{
						Name: "letsencrypt-prod-account-key",
					},
				},
				Solvers: []acmev1.ACMEChallengeSolver{
					{
						HTTP01: &acmev1.ACMEChallengeSolverHTTP01{
							Ingress: &acmev1.ACMEChallengeSolverHTTP01Ingress{
								Class: &r.Config.IngressClassName,
							},
						},
					},
				},
			},
		},
	}

	if err != nil {
		// Create
		newIssuer := &cmv1.Issuer{
			ObjectMeta: metav1.ObjectMeta{
				Name:      issuerName,
				Namespace: namespace,
				Labels: map[string]string{
					"gitship.io/managed-by": "gitship-user-controller",
				},
			},
			Spec: spec,
		}
		if err := ctrl.SetControllerReference(gitshipUser, newIssuer, r.Scheme); err != nil {
			return err
		}
		return r.Create(ctx, newIssuer)
	}

	// Update if email changed (simple check)
	if issuer.Spec.ACME.Email != email {
		issuer.Spec = spec
		return r.Update(ctx, issuer)
	}

	return nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *GitshipUserReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&gitshipiov1alpha1.GitshipUser{}).
		Owns(&cmv1.Issuer{}).
		Named("gitship.io-gitshipuser").
		Complete(r)
}
