"use server"

import { auth } from "@/auth"
import { createSecret, deleteSecret, bindSecretToApp, unbindSecretFromApp, getAppSecrets } from "@/lib/secrets"
import { revalidatePath } from "next/cache"
import { generateSSHKeyPair } from "@/lib/ssh"
import { addDeployKey } from "@/lib/github"
import { k8sCustomApi, k8sCoreApi } from "@/lib/k8s"

export async function loadSecrets(namespace: string, appName: string) {
    const session = await auth()
    if (!session) return []
    return await getAppSecrets(namespace, appName)
}

export async function addSecret(namespace: string, appName: string, name: string, data: Record<string, string>) {
    const session = await auth()
    if (!session) return { error: "Unauthorized" }
    
    try {
        const secretName = await createSecret(namespace, appName, name, data)
        await bindSecretToApp(namespace, appName, secretName)
        revalidatePath(`/app/${namespace}/${appName}`)
        return { success: true }
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        return { error: e.message }
    }
}

export async function setupAppSSH(namespace: string, appName: string, repoUrl: string) {
    const session = await auth()
    // @ts-expect-error dynamic property
    const token = session?.accessToken
    if (!token) return { error: "No GitHub token found in session. Please re-login." }

    try {
        // 1. Cleanup existing secret to avoid conflicts/mismatch
        const secretName = `${appName}-ssh-key`
        try {
            await k8sCoreApi.readNamespacedSecret({ name: secretName, namespace })
            await k8sCoreApi.deleteNamespacedSecret({ name: secretName, namespace })
        } catch {
            // Secret likely doesn't exist, ignore
        }

        const { privateKey, publicKey } = await generateSSHKeyPair(`gitship-${appName}`)
        
        const urlParts = repoUrl.replace("https://github.com/", "").split("/")
        if (urlParts.length < 2) return { error: "Invalid repository URL format." }
        
        const owner = urlParts[0]
        const repo = urlParts[1].replace(".git", "")

        console.log(`[SSH] Attempting auto-upload for ${owner}/${repo}...`)
        const added = await addDeployKey(owner, repo, publicKey, `Gitship Deploy Key (${appName})`, token)
        
        // Save Private Key even if addDeployKey failed (user might want to add it manually)
        await createSecret(namespace, appName, "ssh-key", { "ssh-privatekey": privateKey })

        // Update GitshipApp spec
        const patch = {
            spec: {
                authMethod: "ssh"
            }
        }
        await k8sCustomApi.patchNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
            name: appName,
            body: patch
        }, {
            // @ts-expect-error - headers is missing in ConfigurationOptions but supported at runtime
            headers: { "Content-Type": "application/merge-patch+json" }
        })

        revalidatePath(`/app/${namespace}/${appName}`)
        
        return { 
            success: true, 
            autoAdded: added,
            publicKey: publicKey 
        }
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        return { error: e.message }
    }
}

export async function removeSecret(namespace: string, appName: string, secretName: string) {
    const session = await auth()
    if (!session) return { error: "Unauthorized" }

    try {
        await unbindSecretFromApp(namespace, appName, secretName)
        await deleteSecret(namespace, secretName)
        revalidatePath(`/app/${namespace}/${appName}`)
        return { success: true }
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        return { error: e.message }
    }
}
