import * as k8s from '@kubernetes/client-node';

export const kc = new k8s.KubeConfig();
try {
  kc.loadFromDefault();
} catch (e) {
  console.warn("Failed to load KubeConfig (ignoring for build):", e);
}

export const k8sCoreApi = kc.makeApiClient(k8s.ObjectCoreV1Api);
export const k8sAppsApi = kc.makeApiClient(k8s.ObjectAppsV1Api);
export const k8sBatchApi = kc.makeApiClient(k8s.ObjectBatchV1Api);
export const k8sCustomApi = kc.makeApiClient(k8s.ObjectCustomObjectsApi);
export const k8sNetworkingApi = kc.makeApiClient(k8s.ObjectNetworkingV1Api);

