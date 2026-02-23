export interface RegistryConfig {
  name: string;
  server: string;
  username: string;
  password?: string; // Optional because we might not want to send it back to UI every time
}

export interface GitshipUser {
  apiVersion: "gitship.io/v1alpha1";
  kind: "GitshipUser";
  metadata: {
    name: string;
    creationTimestamp: string;
    uid: string;
    resourceVersion: string;
  };
  spec: {
    githubUsername: string;
    githubID: number;
    customSpaces?: string[];
    registries?: RegistryConfig[];
    role: string;
    quotas?: {
      cpu?: string;
      memory?: string;
      pods?: string;
      storage?: string;
    };
  };
  status?: {
    ready: boolean;
    namespaces?: string[];
  };
}

export interface GitshipAppSpec {
  repoUrl: string;
  source: {
    type: "branch" | "tag" | "commit";
    value: string;
  };
  authMethod?: string;
  registrySecretRef: string;
  imageName: string;
  ports: PortConfig[];
  resources?: {
    cpu?: string;
    memory?: string;
  };
  healthCheck?: {
    path?: string;
    port?: number;
    initialDelay?: number;
    timeout?: number;
  };
  ingresses: IngressRuleConfig[];
  env?: { [key: string]: string };
  replicas?: number;
  domain?: string;
  ingressPort?: number;
  volumes?: VolumeConfig[];
  secretMounts?: SecretMountConfig[];
  updateStrategy?: {
    type: "polling" | "webhook";
    interval?: string;
  };
  tls?: {
    enabled: boolean;
    issuer?: string;
  };
  secretRefs?: string[];
}

export interface PortConfig {
    name?: string;
    port: number;
    targetPort: number;
    protocol?: string;
}

export interface IngressRuleConfig {
    host: string;
    path?: string;
    servicePort: number;
    tls?: boolean;
}

export interface SecretMountConfig {
    secretName: string;
    mountPath: string;
}

export interface AddonConfig {
    type: string;
    name: string;
    size?: string;
}

export interface VolumeConfig {
  name: string;
  mountPath: string;
  size: string;
  storageClass?: string;
}

export interface BuildRecord {
  commitId: string;
  status: string;
  startTime?: string;
  completionTime?: string;
  message?: string;
}

export interface GitshipAppStatus {
  latestBuildId?: string;
  phase?: string;
  appUrl?: string;
  buildHistory?: BuildRecord[];
  readyReplicas?: number;
  desiredReplicas?: number;
  restartCount?: number;
  lastDeployedAt?: string;
  serviceType?: string;
  ingressHost?: string;
}

export interface GitshipApp {
  apiVersion: "gitship.io/v1alpha1";
  kind: "GitshipApp";
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
    uid: string;
    resourceVersion: string;
    generation: number;
  };
  spec: GitshipAppSpec;
  status?: GitshipAppStatus;
}

export interface GitshipAppList {
  apiVersion: "gitship.io/v1alpha1";
  kind: "GitshipAppList";
  metadata: {
    resourceVersion: string;
  };
  items: GitshipApp[];
}

export interface GitshipIntegration {
    apiVersion: "gitship.io/v1alpha1";
    kind: "GitshipIntegration";
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp?: string;
        uid?: string;
    };
    spec: {
        type: string;
        config?: Record<string, string>;
        resources?: {
            cpu?: string;
            memory?: string;
        };
        replicas?: number;
        enabled?: boolean;
    };
    status?: {
        phase?: string;
        message?: string;
        readyReplicas?: number;
        desiredReplicas?: number;
    };
}
