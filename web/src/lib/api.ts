import { k8sCustomApi, k8sAppsApi, k8sCoreApi, k8sNetworkingApi } from "./k8s";
import { GitshipAppList, GitshipApp, GitshipUser, GitshipIntegration } from "./types";

export async function getGitshipUser(username: string): Promise<GitshipUser | null> {
  try {
    const response = await k8sCustomApi.getClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      name: username,
    });
    return (response.body || response) as GitshipUser;
  } catch (error) {
    console.error(`Failed to fetch GitshipUser ${username}:`, error);
    return null;
  }
}

export async function getGitshipUsers(): Promise<GitshipUser[]> {
  try {
    const response = await k8sCustomApi.listClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
    });
    const data = (response.body || response) as { items: GitshipUser[] };
    return data.items || [];
  } catch (error) {
    console.error("Failed to fetch all GitshipUsers:", error);
    return [];
  }
}

export async function getStorageClasses() {
    try {
        const resp = await k8sCustomApi.listClusterCustomObject({
            group: "storage.k8s.io",
            version: "v1",
            plural: "storageclasses"
        })
        const data = (resp.body || resp) as { items: unknown[] }
        return data.items || []
    } catch {
        return []
    }
}

export async function getClusterNodes() {
    try {
        const resp = await k8sCoreApi.listNode()
        return resp.items || []
    } catch {
        return []
    }
}

export async function getGitshipApps(namespace: string): Promise<GitshipAppList> {
  try {
    console.log(`[API] getGitshipApps called. Namespace: '${namespace}'`)
    if (!namespace) {
        console.warn("[API] getGitshipApps called without namespace. Returning empty list for security.")
        return { apiVersion: "gitship.io/v1alpha1", kind: "GitshipAppList", metadata: { resourceVersion: "0" }, items: [] }
    }

    const response = await k8sCustomApi.listNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
    });
    
    const data = (response.body || response) as GitshipAppList;
    const items = data.items || [];
    
    console.log(`[API] getGitshipApps success. Items found: ${items.length}.`)
    
    return data;
  } catch (error: unknown) {
    // @ts-expect-error dynamic access
    console.error("[API] Failed to fetch GitshipApps:", error.body?.message || error.message);
    
    return {
      apiVersion: "gitship.io/v1alpha1",
      kind: "GitshipAppList",
      metadata: { resourceVersion: "0" },
      items: [],
    };
  }
}

export async function getGitshipAppsAdmin(): Promise<GitshipAppList> {
    try {
        console.log(`[API] getGitshipAppsAdmin called.`)
        const response = await k8sCustomApi.listClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipapps",
        });
        const data = (response.body || response) as GitshipAppList;
        return data;
    } catch (error: unknown) {
        // @ts-expect-error dynamic access
        console.error("[API] Failed to fetch all GitshipApps (Admin):", error.message);
        return { items: [] } as unknown as GitshipAppList;
    }
}

export async function getGitshipApp(name: string, namespace: string = "default"): Promise<GitshipApp | null> {
  try {
    const response = await k8sCustomApi.getNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
    });
    return (response.body || response) as GitshipApp;
  } catch (error) {
    console.error(`Failed to fetch GitshipApp ${name}:`, error);
    return null;
  }
}

export async function getAppDeployment(name: string, namespace: string) {
  try {
    const resp = await k8sAppsApi.readNamespacedDeployment({ name, namespace });
    return resp;
  } catch {
    return null;
  }
}

export async function getAppPods(name: string, namespace: string) {
  try {
    const resp = await k8sCoreApi.listNamespacedPod({
      namespace,
      labelSelector: `app=${name}`,
    });
    return resp.items ?? [];
  } catch {
    return [];
  }
}

export async function getAppService(name: string, namespace: string) {
  try {
    const resp = await k8sCoreApi.readNamespacedService({ name, namespace });
    return resp;
  } catch {
    return null;
  }
}

export async function getAppIngress(name: string, namespace: string) {
  try {
    const resp = await k8sNetworkingApi.readNamespacedIngress({ name, namespace });
    return resp;
  } catch {
    return null;
  }
}

export async function getUserQuotas(username: string) {
    // try new ID-based naming first, then fallback to legacy
    const namespace = username.startsWith("u-") ? `gitship-${username}` : `gitship-user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")}`
    console.log(`[QUOTA] Fetching quotas for user '${username}' in namespace '${namespace}'`)
    try {
        const quota = await k8sCoreApi.readNamespacedResourceQuota({ name: "user-quota", namespace })
        console.log(`[QUOTA] Successfully fetched quota for ${namespace}. Hard keys: ${Object.keys(quota.status?.hard || {}).join(",")}`)
        return {
            hard: quota.status?.hard || {},
            used: quota.status?.used || {}
        }
    } catch (err: unknown) {
        // @ts-expect-error dynamic access
        console.error(`[QUOTA] Failed to fetch quota for ${namespace}:`, err.body?.message || err.message)
        return null
    }
}

export async function getGitshipIntegrations(namespace: string): Promise<GitshipIntegration[]> {
    try {
        console.log(`[API] getGitshipIntegrations called. Namespace: '${namespace}'`)
        const response = await k8sCustomApi.listNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipintegrations",
        });
        const data = (response.body || response) as { items: GitshipIntegration[] };
        return data.items || [];
    } catch (error: unknown) {
        // @ts-expect-error dynamic access
        console.error(`[API] Failed to fetch integrations for ${namespace}:`, error.message);
        return [];
    }
}

export async function getGitshipIntegrationsAdmin(): Promise<GitshipIntegration[]> {
    try {
        console.log(`[API] getGitshipIntegrationsAdmin called.`)
        const response = await k8sCustomApi.listClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipintegrations",
        });
        const data = (response.body || response) as { items: GitshipIntegration[] };
        return data.items || [];
    } catch (error: unknown) {
        // @ts-expect-error dynamic access
        console.error("[API] Failed to fetch all GitshipIntegrations (Admin):", error.message);
        return [];
    }
}

