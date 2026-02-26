import * as k8s from '@kubernetes/client-node';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

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
 * Build auth token for K8s API requests.
 * Handles in-cluster (SA token file) and local dev (kubeconfig token/exec).
 */
function getAuthToken(): string | null {
  // 1. In-cluster: read service account token directly
  const saTokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token";
  try {
    if (fs.existsSync(saTokenPath)) {
      return fs.readFileSync(saTokenPath, "utf8").trim();
    }
  } catch { /* fall through */ }

  // 2. Kubeconfig user token
  const user = kc.getCurrentUser();
  if (user?.token) return user.token;

  return null;
}

/**
 * Make a raw HTTPS request to the K8s API server.
 * Uses node:https directly to avoid all @kubernetes/client-node
 * compatibility issues with fetch / Headers / Symbols.
 */
function k8sRequest(method: string, urlStr: string, body: object): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const token = getAuthToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/merge-patch+json",
      "Accept": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const payload = JSON.stringify(body);
    headers["Content-Length"] = Buffer.byteLength(payload).toString();

    // Build TLS options for in-cluster CA
    const reqOpts: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };

    // In-cluster: trust the cluster CA
    const caPath = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";
    try {
      if (fs.existsSync(caPath)) {
        reqOpts.ca = fs.readFileSync(caPath);
      }
    } catch { /* ignore */ }

    // Check if cluster skips TLS verify
    const cluster = kc.getCurrentCluster();
    if (cluster?.skipTLSVerify) {
      reqOpts.rejectUnauthorized = false;
    }

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, body: data });
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Custom merge-patch for namespaced Kubernetes CRDs.
 * Uses raw node:https to bypass all @kubernetes/client-node issues.
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
  const result = await k8sRequest("PATCH", url, opts.body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`K8s PATCH failed (${result.status}): ${result.body}`);
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
  const result = await k8sRequest("PATCH", url, opts.body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`K8s cluster PATCH failed (${result.status}): ${result.body}`);
  }
}
