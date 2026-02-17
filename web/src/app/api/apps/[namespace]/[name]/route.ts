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

    // Create individual patch operations for each field in spec
    // This avoids overwriting the entire spec and losing required fields like repoUrl
    const patch: any[] = []
    
    if (patchData.spec) {
      for (const [key, value] of Object.entries(patchData.spec)) {
        patch.push({
          op: "add", // 'add' is safer as it works even if the path doesn't exist yet
          path: `/spec/${key}`,
          value: value,
        })
      }
    }

    await k8sCustomApi.patchNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
      body: patch,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Failed to patch app:", e.body?.message || e.message)
    return NextResponse.json(
      { error: e.body?.message || e.message },
      { status: 500 }
    )
  }
}
