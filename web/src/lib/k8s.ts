import * as k8s from '@kubernetes/client-node';
import https from 'node:https';

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
 * Build auth headers from KubeConfig. We do this manually because
 * kc.applyToFetchOptions returns node-fetch's RequestInit which contains
 * Symbol-keyed properties that crash the native Headers constructor.
 */
async function getK8sAuthHeaders(): Promise<Record<string, string>> {
  const user = kc.getCurrentUser();
  if (!user) return {};

  const headers: Record<string, string> = {};

  // Token-based auth (most common in-cluster)
  if (user.token) {
    headers["Authorization"] = `Bearer ${user.token}`;
  }

  // Try exec-based auth (for local dev with kubectl proxy, etc.)
  const opts: https.RequestOptions = {};
  await kc.applyToHTTPSOptions(opts);
  if (opts.headers) {
    for (const [key, val] of Object.entries(opts.headers)) {
      if (typeof val === "string") headers[key] = val;
    }
  }

  return headers;
}

/**
 * Custom merge-patch for namespaced Kubernetes CRDs.
 * Bypasses @kubernetes/client-node's broken Content-Type handling.
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
  const authHeaders = await getK8sAuthHeaders();

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "Content-Type": "application/merge-patch+json",
      "Accept": "application/json",
    },
    body: JSON.stringify(opts.body),
    // Skip TLS verification for in-cluster self-signed certs
    ...(cluster.skipTLSVerify ? { dispatcher: undefined } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`K8s PATCH failed (${res.status}): ${text}`);
  }
}

/**
 * Custom merge-patch for cluster-scoped Kubernetes CRDs (e.g., GitshipUser).
 */
export async function k8sClusterMergePatch(opts: {
  group: string;
  version: string;
  plural: string;
  name: string;
  body: object;
}): Promise<void> {
  const cluster = kc.getCurrentCluster();
  if (!cluster) throw new Error("No active cluster in KubeConfig");

  const url = `${cluster.server}/apis/${opts.group}/${opts.version}/${opts.plural}/${opts.name}`;
  const authHeaders = await getK8sAuthHeaders();

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "Content-Type": "application/merge-patch+json",
      "Accept": "application/json",
    },
    body: JSON.stringify(opts.body),
    ...(cluster.skipTLSVerify ? { dispatcher: undefined } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`K8s cluster PATCH failed (${res.status}): ${text}`);
  }
}

