import { k8sCustomApi, k8sAppsApi, k8sCoreApi, k8sNetworkingApi } from "./k8s";
import { GitshipAppList, GitshipApp, GitshipUser } from "./types";
import * as k8s from '@kubernetes/client-node';

export async function getGitshipUser(username: string): Promise<GitshipUser | null> {
  try {
    const response: any = await k8sCustomApi.getClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      name: username,
    });
    return (response?.body ?? response) as GitshipUser;
  } catch (error) {
    console.error(`Failed to fetch GitshipUser ${username}:`, error);
    return null;
  }
}

export async function getGitshipUsers(): Promise<GitshipUser[]> {
  try {
    const response: any = await k8sCustomApi.listClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
    });
    const data = response?.body ?? response;
    return (data.items || []) as GitshipUser[];
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
        const data: any = resp.body || resp
        return data.items || []
    } catch {
        return []
    }
}

export async function getClusterNodes() {
    try {
        const resp = await k8sCoreApi.listNode({})
        return resp.items || []
    } catch {
        return []
    }
}

export async function getGitshipApps(namespace: string = ""): Promise<GitshipAppList> {
  try {
    console.log(`[API] getGitshipApps called. Namespace: '${namespace || "ALL"}'`)
    let response: any;
    if (namespace) {
      // Scoped to user namespace
      response = await k8sCustomApi.listNamespacedCustomObject({
        group: "gitship.io",
        version: "v1alpha1",
        namespace,
        plural: "gitshipapps",
      });
    } else {
      // List all (admin/fallback)
      response = await k8sCustomApi.listClusterCustomObject({
        group: "gitship.io",
        version: "v1alpha1",
        plural: "gitshipapps",
      });
    }
    
    // Handle both response formats
    const data = response?.body ?? response;
    const items = (data as any)?.items || [];
    
    console.log(`[API] getGitshipApps success. Items found: ${items.length}. Response keys: ${Object.keys(data || {}).join(",")}`)
    
    return data as GitshipAppList;
  } catch (error: any) {
    console.error("[API] Failed to fetch GitshipApps:", error.body?.message || error.message);
    if (error.body) console.error("[API] Error body:", JSON.stringify(error.body));
    
    return {
      apiVersion: "gitship.io/v1alpha1",
      kind: "GitshipAppList",
      metadata: { resourceVersion: "0" },
      items: [],
    };
  }
}

export async function getGitshipApp(name: string, namespace: string = "default"): Promise<GitshipApp | null> {
  try {
    const response: any = await k8sCustomApi.getNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
    });
    return (response?.body ?? response) as GitshipApp;
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
    const namespace = `gitship-user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")}`
    console.log(`[QUOTA] Fetching quotas for user '${username}' in namespace '${namespace}'`)
    try {
        const resp = await k8sCoreApi.readNamespacedResourceQuota({ name: "user-quota", namespace })
        console.log(`[QUOTA] Successfully fetched quota for ${namespace}. Hard keys: ${Object.keys(resp.status?.hard || {}).join(",")}`)
        return {
            hard: resp.status?.hard || {},
            used: resp.status?.used || {}
        }
    } catch (err: any) {
        console.error(`[QUOTA] Failed to fetch quota for ${namespace}:`, err.body?.message || err.message)
        return null
    }
}

