// Namespace management utilities

import { k8sCoreApi, k8sNetworkingApi, k8sCustomApi } from "./k8s"

/**
 * Ensure a GitshipUser CRD exists for the given user.
 */
export async function ensureGitshipUser(username: string, githubID: number): Promise<string> {
  const sanitized = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  
  try {
    await k8sCustomApi.createClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      body: {
        apiVersion: "gitship.io/v1alpha1",
        kind: "GitshipUser",
        metadata: {
          name: sanitized,
        },
        spec: {
          githubUsername: username,
          githubID: githubID,
          role: "restricted",
        },
      },
    })
    console.log(`[user] Created GitshipUser: ${sanitized}`)
  } catch (e: any) {
    const code = e.body?.code || e.response?.statusCode
    if (code !== 409) {
      console.error(`[user] Failed to create GitshipUser ${sanitized}:`, e.body?.message || e.message)
    }
  }
  return sanitized
}

/**
 * Ensure a user's namespace exists with proper labels, NetworkPolicy, and ResourceQuota.
 * Safe to call multiple times — uses try-create pattern (ignores 409 AlreadyExists).
 */
export async function ensureUserNamespace(userId: string): Promise<string> {
  // Sanitize: K8s namespace must be lowercase DNS label
  const sanitized = userId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  const namespace = `gitship-user-${sanitized}`

  try {
    await k8sCoreApi.createNamespace({
      body: {
        metadata: {
          name: namespace,
          labels: {
            "gitship.io/user": sanitized,
            "gitship.io/managed": "true",
            "app.kubernetes.io/managed-by": "gitship",
          },
        },
      },
    })
    console.log(`[namespace] Created namespace: ${namespace}`)
  } catch (e: any) {
    const code = e.body?.code || e.response?.statusCode
    if (code === 409) {
      return namespace
    }
    console.error(`[namespace] Failed to create namespace ${namespace}:`, e.body?.message || e.message)
    return namespace
  }

  try {
    await k8sNetworkingApi.createNamespacedNetworkPolicy({
      namespace,
      body: {
        metadata: {
          name: "isolate-user",
          namespace,
        },
        spec: {
          podSelector: {},
          policyTypes: ["Ingress", "Egress"],
          ingress: [
            {
              _from: [
                {
                  namespaceSelector: {
                    matchLabels: {
                      "kubernetes.io/metadata.name": namespace,
                    },
                  },
                },
                {
                  namespaceSelector: {
                    matchLabels: {
                      "kubernetes.io/metadata.name": "gitship-system",
                    },
                  },
                },
              ],
            },
          ],
          egress: [
            {},
          ],
        },
      },
    })
    console.log(`[namespace] Applied NetworkPolicy to: ${namespace}`)
  } catch (e: any) {
    const code = e.body?.code || e.response?.statusCode
    if (code !== 409) {
      console.error(`[namespace] Failed to create NetworkPolicy:`, e.body?.message || e.message)
    }
  }

  try {
    await k8sCoreApi.createNamespacedResourceQuota({
      namespace,
      body: {
        metadata: {
          name: "user-quota",
          namespace,
        },
        spec: {
          hard: {
            pods: "20",
            "requests.cpu": "4",
            "requests.memory": "8Gi",
            "limits.cpu": "8",
            "limits.memory": "16Gi",
          },
        },
      },
    })
    console.log(`[namespace] Applied ResourceQuota to: ${namespace}`)
  } catch (e: any) {
    const code = e.body?.code || e.response?.statusCode
    if (code !== 409) {
      console.error(`[namespace] Failed to create ResourceQuota:`, e.body?.message || e.message)
    }
  }

  return namespace
}

/**
 * Ensure a secret with the user's GitHub access token exists in their namespace.
 */
export async function ensureGitHubSecret(namespace: string, token: string): Promise<void> {
  const secretName = "gitship-github-token"
  console.log(`[namespace] Syncing GitHub secret for ${namespace}... (token length: ${token.length})`)
  
  try {
    const secret = {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: secretName,
        namespace: namespace,
      },
      type: "Opaque",
      stringData: {
        token: token,
      },
    }

    try {
      await k8sCoreApi.createNamespacedSecret({ namespace, body: secret })
      console.log(`[namespace] SUCCESS: Created GitHub token secret in ${namespace}`)
    } catch (e: any) {
      const code = e.body?.code || e.response?.statusCode
      if (code === 409) {
        // Update existing secret to keep token fresh
        await k8sCoreApi.replaceNamespacedSecret({ name: secretName, namespace, body: secret })
        console.log(`[namespace] SUCCESS: Updated GitHub token secret in ${namespace}`)
      } else {
        console.error(`[namespace] ERROR: Failed to create secret:`, e.body?.message || e.message)
        throw e
      }
    }
  } catch (e: any) {
    console.error(`[namespace] CRITICAL: Failed to sync GitHub secret in ${namespace}:`, e.body?.message || e.message)
  }
}

/**
 * Resolve the namespace for the current user from their username.
 */
export function getUserNamespace(username: string): string {
  const sanitized = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  return `gitship-user-${sanitized}`
}
