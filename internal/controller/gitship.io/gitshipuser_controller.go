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
	"encoding/base64"
	"encoding/json"
	"fmt"

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
}

// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=gitship.io,resources=gitshipusers/finalizers,verbs=update
// +kubebuilder:rbac:groups="",resources=namespaces,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=secrets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups="",resources=resourcequotas,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=networking.k8s.io,resources=networkpolicies,verbs=get;list;watch;create;update;patch;delete

// Reconcile is part of the main kubernetes reconciliation loop which aims to
// move the current state of the cluster closer to the desired state.
func (r *GitshipUserReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := logf.FromContext(ctx)

	// Fetch the GitshipUser instance
	gitshipUser := &gitshipiov1alpha1.GitshipUser{}
	if err := r.Get(ctx, req.NamespacedName, gitshipUser); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}

	log.Info("Reconciling GitshipUser", "user", gitshipUser.Spec.GitHubUsername)

	expectedNamespaces := []string{}
	baseNamespace := "gitship-user-" + gitshipUser.Spec.GitHubUsername
	expectedNamespaces = append(expectedNamespaces, baseNamespace)

	for _, suffix := range gitshipUser.Spec.CustomSpaces {
		expectedNamespaces = append(expectedNamespaces, baseNamespace+"-"+suffix)
	}

	createdNamespaces := []string{}
	for _, nsName := range expectedNamespaces {
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
						"gitship.io/user":              gitshipUser.Spec.GitHubUsername,
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
			}
		}

		// Ensure ResourceQuotas exist
		if err := r.ensureResourceQuota(ctx, nsName, gitshipUser.Spec.Quotas); err != nil {
			log.Error(err, "Failed to sync resource quota", "namespace", nsName)
		}

		// Ensure NetworkPolicy exists
		if err := r.ensureNetworkPolicy(ctx, nsName); err != nil {
			log.Error(err, "Failed to sync network policy", "namespace", nsName)
		}

		createdNamespaces = append(createdNamespaces, nsName)
	}

	gitshipUser.Status.Ready = true
	gitshipUser.Status.Namespaces = createdNamespaces
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
	
	// Default values if not set
	cpu := quotas.CPU
	if cpu == "" { cpu = "4" }
	mem := quotas.Memory
	if mem == "" { mem = "8Gi" }
	pods := quotas.Pods
	if pods == "" { pods = "20" }

	targetResources := corev1.ResourceList{
		corev1.ResourceRequestsCPU:    resource.MustParse(cpu),
		corev1.ResourceLimitsCPU:      resource.MustParse(cpu),
		corev1.ResourceRequestsMemory: resource.MustParse(mem),
		corev1.ResourceLimitsMemory:   resource.MustParse(mem),
		corev1.ResourcePods:           resource.MustParse(pods),
	}

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

	// Create default policy: Allow all in namespace, allow from gitship-system (Ingress), deny others
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
					// Allow from gitship-system (for Ingress/Health probes)
					From: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"kubernetes.io/metadata.name": "gitship-system",
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

func createDockerConfigJSON(server, username, password string) ([]byte, error) {
	auth := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	config := map[string]interface{}{
		"auths": map[string]interface{}{
			server: map[string]interface{}{
				"username": username,
				"password": password,
				"auth":     auth,
			},
		},
	}
	return json.Marshal(config)
}

// SetupWithManager sets up the controller with the Manager.
func (r *GitshipUserReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&gitshipiov1alpha1.GitshipUser{}).
		Named("gitship.io-gitshipuser").
		Complete(r)
}
