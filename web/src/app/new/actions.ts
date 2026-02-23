"use server"

import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { ensureUserNamespace, ensureGitshipUser } from "@/lib/namespace"
import { getGitshipUser } from "@/lib/api"
import { createRepositoryWebhook, addDeployKey } from "@/lib/github"
import { generateSSHKeyPair } from "@/lib/ssh"
import { createSecret } from "@/lib/secrets"
import { redirect } from "next/navigation"
import { z } from "zod"
import { headers } from "next/headers"
import { resolveUserSession } from "@/lib/auth-utils"

const createAppSchema = z.object({
  name: z.string().min(3).regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, "Must be a valid DNS label"),
  repoUrl: z.string().url(),
  sourceType: z.enum(["branch", "tag", "commit"]).default("branch"),
  sourceValue: z.string().min(1),
  imageName: z.string(),
  ports: z.preprocess(
    (val) => (typeof val === "string" ? JSON.parse(val) : val),
    z.array(z.object({
      name: z.string().optional(),
      port: z.coerce.number().min(1).max(65535),
      targetPort: z.coerce.number().min(1).max(65535),
      protocol: z.string().default("TCP"),
    }))
  ),
  domain: z.string().optional(),
  cpu: z.string().default("500"),
  memory: z.string().default("1024"),
  registrySecretRef: z.string().optional(),
  updateStrategy: z.enum(["polling", "webhook"]).optional().default("polling"),
  pollInterval: z.string().optional().default("5m"),
  volumes: z.preprocess(
    (val) => (typeof val === "string" ? JSON.parse(val) : val),
    z.array(z.object({
      name: z.string().min(1),
      mountPath: z.string().min(1),
      size: z.string().min(1),
    })).optional()
  ),
})

export async function createApp(formData: FormData) {
  const session = await auth()
  if (!session || !session.user) {
    return { message: "Unauthorized" }
  }

  const { internalId, email, username, githubId } = resolveUserSession(session)
  const user = await getGitshipUser(internalId)

  if (user?.spec.role === "restricted") {
    return { message: "Access Denied: Your account is restricted. You can manage registries but cannot create new applications." }
  }

  const rawData = {
    name: formData.get("name"),
    repoUrl: formData.get("repoUrl"),
    sourceType: formData.get("sourceType") || "branch",
    sourceValue: formData.get("sourceValue") || formData.get("branch") || "main",
    imageName: formData.get("imageName"),
    ports: formData.get("ports") || "[]",
    domain: formData.get("domain"),
    cpu: formData.get("cpu") || "500",
    memory: formData.get("memory") || "1024",
    registrySecretRef: formData.get("registrySecretRef"),
    updateStrategy: formData.get("updateStrategy"),
    pollInterval: formData.get("pollInterval"),
    volumes: formData.get("volumes") || "[]",
  }

  const validatedFields = createAppSchema.safeParse(rawData)

  if (!validatedFields.success) {
    console.error("[createApp] Validation failed:", validatedFields.error.flatten().fieldErrors)
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Validation Error",
    }
  }

  const data = validatedFields.data

  // Use stable internalId for the namespace, ensure user record is up-to-date with email
  await ensureGitshipUser(username, parseInt(githubId), email)
  const namespace = await ensureUserNamespace(internalId)

  // 1. Setup SSH Authentication
  let authMethod = "token"
  // Try to use token from session
  // @ts-expect-error dynamic property
  const token = session.accessToken

  if (token) {
      try {
          console.log(`[createApp] Generating SSH key for ${data.name}...`)
          const { privateKey, publicKey } = await generateSSHKeyPair(`gitship-${data.name}`)
          
          const urlParts = data.repoUrl.replace("https://github.com/", "").split("/")
          if (urlParts.length >= 2) {
              const owner = urlParts[0]
              const repo = urlParts[1].replace(".git", "")
              
              console.log(`[createApp] Adding deploy key to GitHub repo ${owner}/${repo}...`)
              // @ts-expect-error dynamic property
              const added = await addDeployKey(owner, repo, publicKey, `Gitship Deploy Key (${data.name})`, session.accessToken)
              
              if (added) {
                  // Save Private Key as Secret
                  await createSecret(namespace, data.name, "ssh-key", { "ssh-privatekey": privateKey })
                  authMethod = "ssh"
                  console.log(`[createApp] SUCCESS: SSH Auth configured for ${data.name}`)
              } else {
                  console.warn("[createApp] Failed to add deploy key, falling back to token auth.")
              }
          }
      } catch (e) {
          console.error("[createApp] Failed to setup SSH:", e)
      }
  }

  const gitshipApp = {
    apiVersion: "gitship.io/v1alpha1",
    kind: "GitshipApp",
    metadata: {
      name: data.name,
      namespace: namespace,
    },
    spec: {
      repoUrl: data.repoUrl,
      source: {
        type: data.sourceType,
        value: data.sourceValue,
      },
      authMethod: authMethod,
      imageName: data.imageName,
      ports: data.ports,
      resources: {
        cpu: data.cpu.trim() + "m",
        memory: data.memory.trim() + "Mi",
      },
      ingresses: data.domain ? [{
          host: data.domain,
          path: "/",
          servicePort: data.ports.length > 0 ? data.ports[0].port : 80
      }] : [],
      registrySecretRef: data.registrySecretRef || "",
      replicas: 1,
      volumes: data.volumes?.map(v => ({
        ...v,
        size: v.size.endsWith('Mi') || v.size.endsWith('Gi') ? v.size : v.size + "Mi"
      })),
      updateStrategy: {
        type: data.updateStrategy,
        interval: data.pollInterval,
      },
    },
  }

  try {
    await k8sCustomApi.createNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      body: gitshipApp,
    })
  } catch (e: unknown) {
    console.error("Failed to create app:", e)
    // @ts-expect-error dynamic access
    const statusCode = e.code || e.body?.code || e.response?.statusCode
    if (statusCode === 409) {
      return { message: "An app with this name already exists. Please choose a different name." }
    }
    // @ts-expect-error dynamic access
    return { message: `Error creating app: ${e.body?.message || e.message}` }
  }

  // Attempt to create Webhook if strategy is webhook
  // @ts-expect-error dynamic property
  if (data.updateStrategy === "webhook" && session.accessToken) {
    const headerList = await headers()
    const host = headerList.get("host")
    const proto = headerList.get("x-forwarded-proto") || "http"
    const publicUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

    if (publicUrl) {
        try {
            // Parse owner/repo from URL (e.g. https://github.com/owner/repo)
            const urlParts = data.repoUrl.replace("https://github.com/", "").split("/")
            if (urlParts.length >= 2) {
                const owner = urlParts[0]
                const repo = urlParts[1].replace(".git", "")
                const webhookUrl = `${publicUrl}/api/webhooks/github`
                
                console.log(`[createApp] Attempting to create webhook for ${owner}/${repo} -> ${webhookUrl}`)
                // @ts-expect-error dynamic property
                const success = await createRepositoryWebhook(owner, repo, webhookUrl, session.accessToken)
                if (success) {
                    console.log(`[createApp] Successfully created webhook for ${owner}/${repo}`)
                }
            }
        } catch (e) {
            console.error("[createApp] Failed to parse repo URL for webhook creation:", e)
        }
    } else {
       console.warn("[createApp] Skipping automatic webhook creation: Public URL not configured or is localhost.")
    }
  }

  redirect("/")
}
