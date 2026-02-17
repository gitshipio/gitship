
"use server"

import { k8sCustomApi } from "./k8s"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { getGitshipUser } from "./api"
import { hasNamespaceAccess, resolveUserSession } from "./auth-utils"

export async function getCurrentUserRole(): Promise<string> {
  const session = await auth()
  if (!session?.user) return "guest"
  
  const { internalId } = resolveUserSession(session)
  
  const user = await getGitshipUser(internalId)
  return user?.spec.role || "user"
}

export async function deleteApp(name: string, namespace: string = "default") {
  const session = await auth()
  
  // Security Check
  if (!await hasNamespaceAccess(namespace, session)) {
    throw new Error("Access Denied")
  }

  try {
    await k8sCustomApi.deleteNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
    })
  } catch (error) {
    console.error("Failed to delete app:", error)
    throw new Error("Failed to delete app")
  }
  
  revalidatePath("/")
  redirect("/")
}
