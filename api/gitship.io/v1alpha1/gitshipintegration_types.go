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

// GitshipIntegrationSpec defines the desired state of GitshipIntegration
type GitshipIntegrationSpec struct {
	// Type of integration (e.g. "cloudflare-tunnel")
	Type string `json:"type"`

	// Configuration for the integration
	// For cloudflare-tunnel: {"token": "...", "apps": ["myapp"]}
	Config map[string]string `json:"config,omitempty"`

	// Resource limits/requests
	Resources ResourceConfig `json:"resources,omitempty"`

	// Desired number of replicas
	// +kubebuilder:default:=1
	Replicas int32 `json:"replicas,omitempty"`

	// Whether the integration is enabled
	// +kubebuilder:default:=true
	Enabled bool `json:"enabled,omitempty"`
}

// GitshipIntegrationStatus defines the observed state of GitshipIntegration
type GitshipIntegrationStatus struct {
	// "Ready", "Error", "Pending", "Disabled"
	Phase string `json:"phase,omitempty"`
	// Human-readable message
	Message string `json:"message,omitempty"`

	// Actual running pods
	ReadyReplicas int32 `json:"readyReplicas,omitempty"`
	// Desired number of pods
	DesiredReplicas int32 `json:"desiredReplicas,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// GitshipIntegration is the Schema for the gitshipintegrations API
type GitshipIntegration struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   GitshipIntegrationSpec   `json:"spec,omitempty"`
	Status GitshipIntegrationStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// GitshipIntegrationList contains a list of GitshipIntegration
type GitshipIntegrationList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []GitshipIntegration `json:"items"`
}

func init() {
	SchemeBuilder.Register(&GitshipIntegration{}, &GitshipIntegrationList{})
}
