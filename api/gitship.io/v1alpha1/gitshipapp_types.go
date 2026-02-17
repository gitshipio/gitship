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

// EDIT THIS FILE!  THIS IS SCAFFOLDING FOR YOU TO OWN!
// NOTE: json tags are required.  Any new fields you add must have json tags for the fields to be serialized.

// GitshipAppSpec defines the desired state of GitshipApp.
type GitshipAppSpec struct {
	// Git Configuration
	RepoURL string `json:"repoUrl"`
	// Source configuration: branch, tag, or commit
	// +kubebuilder:default:={type:"branch", value:"main"}
	Source SourceConfig `json:"source,omitempty"`
	// Authentication method: "ssh" or "token"
	// +kubebuilder:default:="token"
	AuthMethod string `json:"authMethod,omitempty"`

	// Build Configuration
	RegistrySecretRef string `json:"registrySecretRef"` // Name of K8s Secret with docker-creds
	ImageName         string `json:"imageName"`         // e.g. "ghcr.io/user/image"

	// Run Configuration
	Ports       []PortConfig        `json:"ports,omitempty"` // Multiple port mappings
	Env         map[string]string   `json:"env,omitempty"`
	Resources   ResourceConfig      `json:"resources,omitempty"` // Resource requests/limits
	Replicas    int32               `json:"replicas,omitempty"`
	Ingresses   []IngressRuleConfig `json:"ingresses,omitempty"` // Multiple domains/paths
	HealthCheck HealthCheckConfig   `json:"healthCheck,omitempty"`

	// Storage Configuration
	Volumes []VolumeConfig `json:"volumes,omitempty"`

	// Update Strategy
	// +kubebuilder:default:={type:"polling", interval:"5m"}
	UpdateStrategy UpdateStrategy `json:"updateStrategy,omitempty"`

	// TLS Configuration
	TLS TLSConfig `json:"tls,omitempty"`

	// List of Kubernetes Secret names to inject as environment variables
	SecretRefs []string `json:"secretRefs,omitempty"`

	// List of Secrets to mount as files
	SecretMounts []SecretMountConfig `json:"secretMounts,omitempty"`

	// Addons (Managed Databases, etc)
	Addons []AddonConfig `json:"addons,omitempty"`
}

type AddonConfig struct {
	// Type of addon (e.g. "postgres", "redis")
	Type string `json:"type"`
	// Name of the addon instance
	Name string `json:"name"`
	// Size of the addon instance (e.g. "small", "medium")
	// +kubebuilder:default:="small"
	Size string `json:"size,omitempty"`
}

type SecretMountConfig struct {
	// Name of the Kubernetes Secret
	SecretName string `json:"secretName"`
	// Path where the secret should be mounted (e.g. "/app/config")
	MountPath string `json:"mountPath"`
}

type PortConfig struct {
	// Name of the port (e.g. "http", "admin")
	Name string `json:"name,omitempty"`
	// External port on the Service
	Port int32 `json:"port"`
	// Internal port on the Container
	TargetPort int32 `json:"targetPort"`
	// Protocol: "TCP" or "UDP"
	// +kubebuilder:default:="TCP"
	Protocol string `json:"protocol,omitempty"`
}

type IngressRuleConfig struct {
	// Domain host (e.g. "myapp.com")
	Host string `json:"host"`
	// Path prefix (e.g. "/", "/api")
	// +kubebuilder:default:="/"
	Path string `json:"path,omitempty"`
	// Which Service port to route to
	ServicePort int32 `json:"servicePort"`
	// Enable HTTPS for this specific domain
	// +kubebuilder:default:=false
	TLS bool `json:"tls,omitempty"`
}

type HealthCheckConfig struct {
	// HTTP Path for the health check (e.g. "/health")
	Path string `json:"path,omitempty"`
	// Port for the health check
	Port int32 `json:"port,omitempty"`
	// Initial delay in seconds before the first probe
	// +kubebuilder:default:=10
	InitialDelay int32 `json:"initialDelay,omitempty"`
	// Timeout in seconds for each probe
	// +kubebuilder:default:=5
	Timeout int32 `json:"timeout,omitempty"`
}

type ResourceConfig struct {
	// CPU limit (e.g. "500m", "1")
	// +kubebuilder:default:="500m"
	CPU string `json:"cpu,omitempty"`
	// Memory limit (e.g. "512Mi", "1Gi")
	// +kubebuilder:default:="1Gi"
	Memory string `json:"memory,omitempty"`
	// Storage limit (e.g. "1Gi", "10Gi")
	// +kubebuilder:default:="1Gi"
	Storage string `json:"storage,omitempty"`
}

type SourceConfig struct {
	// Type: "branch", "tag", or "commit"
	Type string `json:"type"`
	// Value: branch name, tag name, or commit hash
	Value string `json:"value"`
}

type TLSConfig struct {
	// Optional: Custom ClusterIssuer name (defaults to "letsencrypt-prod" if empty)
	Issuer string `json:"issuer,omitempty"`
}

type UpdateStrategy struct {
	// Type: "polling" or "webhook"
	Type string `json:"type"`
	// Interval for polling (e.g. "5m", "1h"). Ignored if type is "webhook".
	Interval string `json:"interval,omitempty"`
}

type VolumeConfig struct {
	Name         string `json:"name"`
	MountPath    string `json:"mountPath"`
	Size         string `json:"size"` // e.g. "1Gi"
	StorageClass string `json:"storageClass,omitempty"`
}

type BuildRecord struct {
	// Commit ID of this build
	CommitID string `json:"commitId"`
	// Status: "Succeeded", "Failed"
	Status string `json:"status"`
	// When the build started
	StartTime string `json:"startTime,omitempty"`
	// When the build finished
	CompletionTime string `json:"completionTime,omitempty"`
	// Optional log summary or reference
	Message string `json:"message,omitempty"`
}

// GitshipAppStatus defines the observed state of GitshipApp.
type GitshipAppStatus struct {
	LatestBuildID string `json:"latestBuildId"`
	Phase         string `json:"phase"` // "Building", "Running", "Failed"
	AppURL        string `json:"appUrl,omitempty"`

	BuildHistory []BuildRecord `json:"buildHistory,omitempty"`

	// Enhanced status fields (Phase 9)
	ReadyReplicas   int32  `json:"readyReplicas,omitempty"`
	DesiredReplicas int32  `json:"desiredReplicas,omitempty"`
	RestartCount    int32  `json:"restartCount,omitempty"`
	LastDeployedAt  string `json:"lastDeployedAt,omitempty"`
	ServiceType     string `json:"serviceType,omitempty"` // "ClusterIP", "NodePort", "LoadBalancer"
	IngressHost     string `json:"ingressHost,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

// GitshipApp is the Schema for the gitshipapps API.
type GitshipApp struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   GitshipAppSpec   `json:"spec,omitempty"`
	Status GitshipAppStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

// GitshipAppList contains a list of GitshipApp.
type GitshipAppList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []GitshipApp `json:"items"`
}

func init() {
	SchemeBuilder.Register(&GitshipApp{}, &GitshipAppList{})
}
