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

package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GitshipUserSpec defines the desired state of GitshipUser
type GitshipUserSpec struct {
	GitHubUsername string `json:"githubUsername"`
	GitHubID       int64  `json:"githubID"`
	// Email for Let's Encrypt notifications and Issuer registration
	Email string `json:"email,omitempty"`

	// Saved registries for this user
	Registries []RegistryConfig `json:"registries,omitempty"`

	// User role: admin, user, restricted
	// +kubebuilder:default:="restricted"
	Role string `json:"role,omitempty"`

	// Resource Quotas for this user's namespaces
	Quotas UserQuotas `json:"quotas,omitempty"`
}

type UserQuotas struct {
	// Maximum CPU cores (e.g. "4")
	CPU string `json:"cpu,omitempty"`
	// Maximum Memory (e.g. "8Gi")
	Memory string `json:"memory,omitempty"`
	// Maximum number of Pods
	Pods string `json:"pods,omitempty"`
	// Maximum Storage (e.g. "10Gi")
	Storage string `json:"storage,omitempty"`
}

type RegistryConfig struct {
	Name     string `json:"name"`
	Server   string `json:"server"` // e.g. ghcr.io, index.docker.io
	Username string `json:"username"`
	Password string `json:"password"` // Sensitive: used to generate K8s Secrets
}

// GitshipUserStatus defines the observed state of GitshipUser.
type GitshipUserStatus struct {
	Ready bool `json:"ready"`
	// List of actually created namespaces
	Namespaces []string `json:"namespaces,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:resource:scope=Cluster

// GitshipUser is the Schema for the gitshipusers API.
type GitshipUser struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   GitshipUserSpec   `json:"spec,omitempty"`
	Status GitshipUserStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// GitshipUserList contains a list of GitshipUser.
type GitshipUserList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []GitshipUser `json:"items"`
}

func init() {
	SchemeBuilder.Register(&GitshipUser{}, &GitshipUserList{})
}
