import { k8sCoreApi, k8sCustomApi } from "@/lib/k8s"
import { GitshipApp } from "@/lib/types"

export async function getAppSecrets(namespace: string, appName: string) {
    try {
        const res = await k8sCoreApi.listNamespacedSecret({ namespace })
        const secrets = res.items || []
        // Manual filter because method signature varies between versions
        return secrets
            .filter(s => s.metadata?.labels?.["gitship.io/app"] === appName)
            .map(s => ({
                name: s.metadata?.name || "unknown",
                keys: Object.keys(s.data || {}),
                created: s.metadata?.creationTimestamp ? s.metadata.creationTimestamp.toISOString() : undefined
            }))
    } catch (e) {
        console.error("Failed to list secrets:", e)
        return []
    }
}

export async function createSecret(namespace: string, appName: string, name: string, data: Record<string, string>) {
    // Base64 encode data
    const encodedData: Record<string, string> = {}
    for (const [k, v] of Object.entries(data)) {
        encodedData[k] = Buffer.from(v).toString('base64')
    }

    const secretName = `${appName}-${name}` // Prefix to avoid collisions

    try {
        await k8sCoreApi.createNamespacedSecret({
            namespace,
            body: {
                metadata: {
                    name: secretName,
                    namespace: namespace,
                    labels: {
                        "gitship.io/app": appName,
                        "gitship.io/managed": "true"
                    }
                },
                type: "Opaque",
                data: encodedData
            }
        })
        return secretName
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    throw new Error(e.body?.message || e.message)
  }
}

export async function deleteSecret(namespace: string, name: string) {
  try {
    await k8sCoreApi.deleteNamespacedSecret({ name, namespace })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    throw new Error(e.body?.message || e.message)
  }
}

export async function bindSecretToApp(namespace: string, appName: string, secretName: string) {
    // Patch GitshipApp to add secretName to secretRefs
    try {
        // Fetch current
        const res = await k8sCustomApi.getNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
            name: appName
        })
        const app = (res.body || res) as GitshipApp
        const refs = app.spec.secretRefs || []
        
        if (!refs.includes(secretName)) {
            refs.push(secretName)
            await k8sCustomApi.patchNamespacedCustomObject({
                group: "gitship.io",
                version: "v1alpha1",
                namespace,
                plural: "gitshipapps",
                name: appName,
                body: [{ op: "replace", path: "/spec/secretRefs", value: refs }]
            }, {
                // @ts-expect-error custom headers
                headers: { "Content-Type": "application/json-patch+json" }
            })
        }
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    throw new Error(e.body?.message || e.message)
  }
}

export async function unbindSecretFromApp(namespace: string, appName: string, secretName: string) {
    try {
        const res = await k8sCustomApi.getNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
            name: appName
        })
        const app = (res.body || res) as GitshipApp
        const refs = app.spec.secretRefs || []
        
        const newRefs = refs.filter(r => r !== secretName)
        
        await k8sCustomApi.patchNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
            name: appName,
                            body: [{ op: "replace", path: "/spec/secretRefs", value: newRefs }]
                        }, {
                            // @ts-expect-error custom headers
                            headers: { "Content-Type": "application/json-patch+json" }
                        })
            
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    throw new Error(e.body?.message || e.message)
  }
}
