import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  const { namespace, name } = await params

  // Security Check: Ensure user has access to this namespace
  if (!await hasNamespaceAccess(namespace, session)) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  try {
    const patchData = await req.json()
    console.log(`[API] PATCH GitshipApp ${name} in ${namespace}:`, JSON.stringify(patchData))

    // Build JSON Patch operations for every spec field sent by the frontend.
    // Uses "add" op which creates the path if missing, or replaces if it exists.
    const patch: { op: string; path: string; value: unknown }[] = []

    if (patchData.spec) {
      for (const [key, value] of Object.entries(patchData.spec)) {
        if (value !== undefined) {
          patch.push({ op: "add", path: `/spec/${key}`, value })
        }
      }
    }

    if (patch.length === 0) return NextResponse.json({ ok: true })

    await k8sCustomApi.patchNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
      body: patch,
    }, {
      // @ts-expect-error custom headers for JSON Patch
      headers: { "Content-Type": "application/json-patch+json" }
    })

    console.log(`[API] SUCCESS: Patched GitshipApp ${name} in ${namespace}`)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error("Failed to patch app:", e.body?.message || e.message)
    return NextResponse.json(
      // @ts-expect-error dynamic access
      { error: e.body?.message || e.message },
      { status: 500 }
    )
  }
}

