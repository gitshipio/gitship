import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { isAdmin as checkAdmin, resolveUserSession } from "@/lib/auth-utils"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  const { internalId: adminId } = resolveUserSession(session)
  
  // Admin Check
  const isUserAdmin = await checkAdmin(adminId)
  if (!isUserAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params

  try {
    const { quotas } = await req.json()
    
    const patch = {
      spec: {
        quotas: quotas
      }
    }

    await k8sCustomApi.patchClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      name: name,
      body: patch
    }, {
      headers: { "Content-Type": "application/merge-patch+json" }
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[Admin] Failed to update quotas for ${name}:`, e.message)
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
