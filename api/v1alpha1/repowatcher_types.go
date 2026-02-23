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

// RepoWatcherSpec defines the desired state of RepoWatcher
type RepoWatcherSpec struct {
	// INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
	// Important: Run "make" to regenerate code after modifying this file

	// RepoURL is the URL of the repository to watch
	RepoURL string `json:"repoUrl,omitempty"`

	// Branch is the branch to match
	Branch string `json:"branch,omitempty"`

	// WebhookSecretRef is the reference to the secret containing the webhook token
	WebhookSecretRef string `json:"webhookSecretRef,omitempty"`
}

// RepoWatcherStatus defines the observed state of RepoWatcher
type RepoWatcherStatus struct {
	// INSERT ADDITIONAL STATUS FIELD - define observed state of cluster
	// Important: Run "make" to regenerate code after modifying this file
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// RepoWatcher is the Schema for the repowatchers API
type RepoWatcher struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   RepoWatcherSpec   `json:"spec,omitempty"`
	Status RepoWatcherStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// RepoWatcherList contains a list of RepoWatcher
type RepoWatcherList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []RepoWatcher `json:"items"`
}

func init() {
	SchemeBuilder.Register(&RepoWatcher{}, &RepoWatcherList{})
}
