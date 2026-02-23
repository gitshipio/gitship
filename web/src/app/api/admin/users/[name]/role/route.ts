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
  
  // 1. Cluster Admin Check
  const isUserAdmin = await checkAdmin(adminId)
  if (!isUserAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params

  try {
    const { role } = await req.json()
    if (!["admin", "user", "restricted"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // JSON Patch (Array)
    const patch = [
      {
        op: "replace",
        path: "/spec/role",
        value: role,
      },
    ]

    await k8sCustomApi.patchClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      name: name,
      body: patch,
    }, {
      // @ts-expect-error custom headers for JSON Patch
      headers: { "Content-Type": "application/json-patch+json" }
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[Admin] Failed to update role for ${name}:`, e.message)
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
