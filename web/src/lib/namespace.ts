// Namespace management utilities

import { k8sCoreApi, k8sNetworkingApi, k8sCustomApi } from "./k8s"

import { GitshipUser } from "./types"

const SYSTEM_NAMESPACE = process.env.SYSTEM_NAMESPACE || "gitship-system"
const QUOTA_PODS = process.env.QUOTA_PODS || "20"
const QUOTA_CPU_REQ = process.env.QUOTA_CPU_REQ || "4"
const QUOTA_MEM_REQ = process.env.QUOTA_MEM_REQ || "8Gi"
const QUOTA_CPU_LIM = process.env.QUOTA_CPU_LIM || "8"
const QUOTA_MEM_LIM = process.env.QUOTA_MEM_LIM || "16Gi"
const QUOTA_STORAGE = process.env.QUOTA_STORAGE || "10Gi"

/**
 * Ensure a GitshipUser CRD exists for the given user.
 * Keyed by GitHub ID for permanence.
 */
export async function ensureGitshipUser(username: string, githubID: number, email: string = ""): Promise<string> {
  const resourceName = `u-${githubID}`
  
  try {
    const resp = await k8sCustomApi.getClusterCustomObject({
        group: "gitship.io",
        version: "v1alpha1",
        plural: "gitshipusers",
        name: resourceName,
    }).catch(() => null) as any
    
    const existing = resp?.body || resp

    const body = {
        apiVersion: "gitship.io/v1alpha1",
        kind: "GitshipUser",
        metadata: {
          name: resourceName,
          labels: {
            "gitship.io/github-username": username.toLowerCase()
          }
        },
        spec: {
          githubUsername: username,
          githubID: githubID,
          email: email,
          role: existing ? existing.spec.role : "restricted",
          quotas: existing ? existing.spec.quotas : undefined,
          registries: existing ? existing.spec.registries : undefined,
        },
    }

    if (!existing) {
        // Migration logic: Check if a legacy record (username-based) exists
        const legacyName = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
        const legacyResp = await k8sCustomApi.getClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipusers",
            name: legacyName,
        }).catch(() => null) as any
        
        const legacy = legacyResp?.body || legacyResp

        // Migrate if ID matches OR if Username matches (for very old records)
        if (legacy && (legacy.spec.githubID === githubID || legacy.spec.githubUsername?.toLowerCase() === username.toLowerCase())) {
            console.log(`[user] Migrating legacy user ${legacyName} to ${resourceName}`)
            body.spec.role = legacy.spec.role
            body.spec.quotas = legacy.spec.quotas
            body.spec.registries = legacy.spec.registries
            
            // Clean up legacy record
            await k8sCustomApi.deleteClusterCustomObject({
                group: "gitship.io",
                version: "v1alpha1",
                plural: "gitshipusers",
                name: legacyName,
            }).catch(e => console.warn(`[user] Failed to cleanup legacy user ${legacyName}:`, e.message))
        }

        await k8sCustomApi.createClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipusers",
            body,
        })
        console.log(`[user] Created GitshipUser: ${resourceName} (@${username})`)
    } else {
        // Update username or email if they changed
        const patch: any = { spec: {} }
        let needsPatch = false

        if (existing.spec.githubUsername !== username) {
            patch.spec.githubUsername = username
            needsPatch = true
        }

        if (email && existing.spec.email !== email) {
            patch.spec.email = email
            needsPatch = true
        }

        if (needsPatch) {
            await k8sCustomApi.patchClusterCustomObject({
                group: "gitship.io",
                version: "v1alpha1",
                plural: "gitshipusers",
                name: resourceName,
                body: patch,
            }, {
                headers: { "Content-Type": "application/merge-patch+json" }
            })
            console.log(`[user] Updated metadata for ${resourceName}: ${username} (${email || "no email"})`)
        }
    }
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[user] Failed to ensure GitshipUser ${resourceName}:`, e.body?.message || e.message)
  }
  return resourceName
}

/**
 * Ensure a user's namespace exists with proper labels, NetworkPolicy, and ResourceQuota.
 * Safe to call multiple times — uses try-create pattern (ignores 409 AlreadyExists).
 */
export async function ensureUserNamespace(userId: string): Promise<string> {
  // userId is now 'u-ID'
  const namespace = `gitship-${userId}`

  try {
    await k8sCoreApi.createNamespace({
      body: {
        metadata: {
          name: namespace,
          labels: {
            "gitship.io/user": userId,
            "gitship.io/managed": "true",
            "app.kubernetes.io/managed-by": "gitship",
          },
        },
      },
    })
    console.log(`[namespace] Created namespace: ${namespace}`)
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    const code = e.body?.code || e.response?.statusCode
    if (code === 409) {
      return namespace
    }
    // @ts-expect-error dynamic access
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
                      "kubernetes.io/metadata.name": SYSTEM_NAMESPACE,
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
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    const code = e.body?.code || e.response?.statusCode
    if (code !== 409) {
      // @ts-expect-error dynamic access
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
            pods: QUOTA_PODS,
            "requests.cpu": QUOTA_CPU_REQ,
            "requests.memory": QUOTA_MEM_REQ,
            "limits.cpu": QUOTA_CPU_LIM,
            "limits.memory": QUOTA_MEM_LIM,
            "requests.storage": QUOTA_STORAGE,
          },
        },
      },
    })
    console.log(`[namespace] Applied ResourceQuota to: ${namespace}`)
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    const code = e.body?.code || e.response?.statusCode
    if (code !== 409) {
      // @ts-expect-error dynamic access
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
      let code = e.body?.code || e.response?.statusCode
      
      // Handle string-based error bodies
      if (!code && typeof e.body === 'string') {
          try {
              const parsed = JSON.parse(e.body)
              code = parsed.code
          } catch { /* ignore */ }
      }

      if (code === 409) {
        // Update existing secret to keep token fresh
        await k8sCoreApi.replaceNamespacedSecret({ name: secretName, namespace, body: secret })
        console.log(`[namespace] SUCCESS: Updated GitHub token secret in ${namespace}`)
      } else {
        console.error(`[namespace] ERROR: Failed to create secret:`, e.body?.message || e.message)
        throw e
      }
    }
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[namespace] CRITICAL: Failed to sync GitHub secret in ${namespace}:`, e.body?.message || e.message)
  }
}

/**
 * Resolve the namespace for the current user from their internal ID.
 */
export function getUserNamespace(userInternalId: string): string {
  return `gitship-${userInternalId}`
}
