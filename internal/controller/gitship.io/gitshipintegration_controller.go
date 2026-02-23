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

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	logf "sigs.k8s.io/controller-runtime/pkg/log"

	gitshipiov1alpha1 "github.com/gitshipio/gitship/api/gitship.io/v1alpha1"
)

// GitshipIntegrationReconciler reconciles a GitshipIntegration object
type GitshipIntegrationReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Config ControllerConfig
}

// +kubebuilder:rbac:groups=gitship.io,resources=gitshipintegrations,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipintegrations/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipintegrations/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=deployments,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;delete

func (r *GitshipIntegrationReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	integration := &gitshipiov1alpha1.GitshipIntegration{}
	if err := r.Get(ctx, req.NamespacedName, integration); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	log.Info("Reconciling Integration", "type", integration.Spec.Type, "name", integration.Name)

	if !integration.Spec.Enabled {
		log.Info("Integration disabled, cleaning up resources", "name", integration.Name)
		return r.cleanupIntegration(ctx, integration)
	}

	switch strings.ToLower(integration.Spec.Type) {
	case "cloudflare-tunnel":
		return r.reconcileCloudflareTunnel(ctx, integration)
	default:
		log.Info("Unknown integration type", "type", integration.Spec.Type)
	}

	return ctrl.Result{}, nil
}

func (r *GitshipIntegrationReconciler) reconcileCloudflareTunnel(ctx context.Context, integration *gitshipiov1alpha1.GitshipIntegration) (ctrl.Result, error) {
	log := logf.FromContext(ctx)
	token := integration.Spec.Config["token"]
	if token == "" {
		integration.Status.Phase = "Error"
		integration.Status.Message = "Cloudflare Tunnel Token is missing in config"
		_ = r.Status().Update(ctx, integration)
		return ctrl.Result{}, nil
	}

	// 1. Ensure Secret
	secretName := fmt.Sprintf("gitship-integration-%s-config", integration.Name)
	secret := &corev1.Secret{}
	err := r.Get(ctx, types.NamespacedName{Name: secretName, Namespace: integration.Namespace}, secret)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return ctrl.Result{}, err
	}

	if err != nil {
		log.Info("Creating configuration secret for integration", "name", integration.Name)
		newSecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: integration.Namespace,
			},
			StringData: map[string]string{
				"TUNNEL_TOKEN": token,
			},
		}
		if err := ctrl.SetControllerReference(integration, newSecret, r.Scheme); err != nil {
			return ctrl.Result{}, err
		}
		if err := r.Create(ctx, newSecret); err != nil {
			return ctrl.Result{}, err
		}
	}

	// 2. Ensure Deployment
	depName := fmt.Sprintf("gitship-integration-%s", integration.Name)
	dep := &appsv1.Deployment{}
	err = r.Get(ctx, types.NamespacedName{Name: depName, Namespace: integration.Namespace}, dep)
	if err != nil && client.IgnoreNotFound(err) != nil {
		return ctrl.Result{}, err
	}

	// Resolve Resources
	cpuLimit := integration.Spec.Resources.CPU
	if cpuLimit == "" {
		cpuLimit = "100m"
	}
	memLimit := integration.Spec.Resources.Memory
	if memLimit == "" {
		memLimit = "128Mi"
	}

	replicas := integration.Spec.Replicas
	if replicas == 0 && integration.Spec.Enabled {
		replicas = 1
	}
	if !integration.Spec.Enabled {
		replicas = 0
	}

	podSpec := corev1.PodSpec{
		Containers: []corev1.Container{
			{
				Name:  "tunnel",
				Image: "cloudflare/cloudflared:2024.12.2",
				Args:  []string{"tunnel", "--no-autoupdate", "run"},
				Env: []corev1.EnvVar{
					{
						Name: "TUNNEL_TOKEN",
						ValueFrom: &corev1.EnvVarSource{
							SecretKeyRef: &corev1.SecretKeySelector{
								LocalObjectReference: corev1.LocalObjectReference{Name: secretName},
								Key:                  "TUNNEL_TOKEN",
							},
						},
					},
				},
				Resources: corev1.ResourceRequirements{
					Limits: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse(cpuLimit),
						corev1.ResourceMemory: resource.MustParse(memLimit),
					},
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse(cpuLimit),
						corev1.ResourceMemory: resource.MustParse(memLimit),
					},
				},
			},
		},
	}

	if err != nil {
		log.Info("Creating deployment for integration", "name", integration.Name)
		newDep := &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      depName,
				Namespace: integration.Namespace,
				Labels:    map[string]string{"gitship.io/integration": integration.Name},
			},
			Spec: appsv1.DeploymentSpec{
				Replicas: &replicas,
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"gitship.io/integration": integration.Name},
				},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Labels: map[string]string{"gitship.io/integration": integration.Name},
					},
					Spec: podSpec,
				},
			},
		}
		if err := ctrl.SetControllerReference(integration, newDep, r.Scheme); err != nil {
			return ctrl.Result{}, err
		}
		if err := r.Create(ctx, newDep); err != nil {
			return ctrl.Result{}, err
		}
		dep = newDep
	} else {
		// Update existing deployment if changed
		changed := false
		if *dep.Spec.Replicas != replicas {
			dep.Spec.Replicas = &replicas
			changed = true
		}

		// Simplified comparison for PodSpec (mainly resources)
		currentCpu := dep.Spec.Template.Spec.Containers[0].Resources.Limits[corev1.ResourceCPU]
		currentMem := dep.Spec.Template.Spec.Containers[0].Resources.Limits[corev1.ResourceMemory]
		
		targetCpu, _ := resource.ParseQuantity(cpuLimit)
		targetMem, _ := resource.ParseQuantity(memLimit)

		if currentCpu.Cmp(targetCpu) != 0 ||
			currentMem.Cmp(targetMem) != 0 {
			dep.Spec.Template.Spec = podSpec
			changed = true
		}

		if changed {
			log.Info("Updating deployment for integration", "name", integration.Name)
			if err := r.Update(ctx, dep); err != nil {
				return ctrl.Result{}, err
			}
		}
	}

	// 3. Update Status
	targetPhase := "Ready"
	targetMessage := "Cloudflare Tunnel is running"

	if dep.Status.ReadyReplicas == 0 && *dep.Spec.Replicas > 0 {
		targetPhase = "Pending"
		targetMessage = "Waiting for pods to start"
	} else if *dep.Spec.Replicas == 0 {
		targetPhase = "Disabled"
		targetMessage = "Integration is scaled to 0"
	}

	if integration.Status.Phase != targetPhase ||
		integration.Status.ReadyReplicas != dep.Status.ReadyReplicas ||
		integration.Status.DesiredReplicas != *dep.Spec.Replicas ||
		integration.Status.Message != targetMessage {

		integration.Status.Phase = targetPhase
		integration.Status.ReadyReplicas = dep.Status.ReadyReplicas
		integration.Status.DesiredReplicas = *dep.Spec.Replicas
		integration.Status.Message = targetMessage

		if err := r.Status().Update(ctx, integration); err != nil {
			return ctrl.Result{}, err
		}
	}

	return ctrl.Result{}, nil
}

func (r *GitshipIntegrationReconciler) cleanupIntegration(ctx context.Context, integration *gitshipiov1alpha1.GitshipIntegration) (ctrl.Result, error) {
	// Resources owned via ControllerReference are deleted automatically by K8s Garbage Collector
	// when the GitshipIntegration is deleted.
	// But if we just 'disable' it (Enabled=false), we should manually delete them.
	depName := fmt.Sprintf("gitship-integration-%s", integration.Name)
	dep := &appsv1.Deployment{}
	if err := r.Get(ctx, types.NamespacedName{Name: depName, Namespace: integration.Namespace}, dep); err == nil {
		_ = r.Delete(ctx, dep)
	}

	if integration.Status.Phase != "Disabled" {
		integration.Status.Phase = "Disabled"
		integration.Status.Message = "Integration is disabled"
		_ = r.Status().Update(ctx, integration)
	}

	return ctrl.Result{}, nil
}

// SetupWithManager sets up the controller with the Manager.
func (r *GitshipIntegrationReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&gitshipiov1alpha1.GitshipIntegration{}).
		Owns(&appsv1.Deployment{}).
		Owns(&corev1.Secret{}).
		Complete(r)
}
