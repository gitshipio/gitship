
"use server"

import { k8sCustomApi } from "./k8s"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { getGitshipUser } from "./api"

export async function getCurrentUserRole(): Promise<string> {
  const session = await auth()
  if (!session?.user) return "guest"
  
  const username = (session.user as any).githubUsername || session.user.name || "unknown"
  const sanitized = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  
  const user = await getGitshipUser(sanitized)
  return user?.spec.role || "user"
}

export async function deleteApp(name: string, namespace: string = "default") {
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
