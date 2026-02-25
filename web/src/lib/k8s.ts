import * as k8s from '@kubernetes/client-node';

export const kc = new k8s.KubeConfig();
try {
  kc.loadFromDefault();
} catch (e) {
  console.warn("Failed to load KubeConfig (ignoring for build):", e);
}

export const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
export const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
export const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
export const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
export const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

/**
 * Custom merge-patch for Kubernetes CRDs that bypasses @kubernetes/client-node's
 * broken Content-Type handling. The library's patchNamespacedCustomObject sends
 * `application/json-patch+json` regardless of what you set, causing decode errors.
 */
export async function k8sMergePatch(opts: {
  group: string;
  version: string;
  namespace: string;
  plural: string;
  name: string;
  body: object;
}): Promise<void> {
  const cluster = kc.getCurrentCluster();
  if (!cluster) throw new Error("No active cluster in KubeConfig");

  const url = `${cluster.server}/apis/${opts.group}/${opts.version}/namespaces/${opts.namespace}/${opts.plural}/${opts.name}`;

  // applyToFetchOptions returns node-fetch RequestInit (incompatible with global fetch)
  // so we only extract headers for auth tokens / certs
  const fetchInit = await kc.applyToFetchOptions({});
  const authHeaders = (fetchInit.headers || {}) as Record<string, string>;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "Content-Type": "application/merge-patch+json",
      "Accept": "application/json",
    },
    body: JSON.stringify(opts.body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`K8s PATCH failed (${res.status}): ${text}`);
  }
}
