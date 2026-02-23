"use server"

import { auth } from "@/auth"
import { hasNamespaceAccess, resolveUserSession } from "@/lib/auth-utils"
import { createConsoleToken } from "@/lib/tokens"

export async function generateConsoleTokenAction(namespace: string, podName: string) {
  const session = await auth()
  
  if (!await hasNamespaceAccess(namespace, session)) {
    throw new Error("Access Denied")
  }

  const { internalId } = resolveUserSession(session)

  return await createConsoleToken(namespace, podName, internalId)
}
