import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  const { namespace, name } = await params

  // Security Check
  if (!await hasNamespaceAccess(namespace, session)) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  try {
    // Get the current state to see if annotations exist
    const response: any = await k8sCustomApi.getNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
    })
    const app = response.body || response

    const patch: any[] = []
    
    // If annotations don't exist, we must add the object first
    if (!app.metadata.annotations) {
      patch.push({
        op: "add",
        path: "/metadata/annotations",
        value: { "gitship.io/rebuild": new Date().toISOString() }
      })
    } else {
      // Annotations exist, we can just add/replace the specific key
      // In JSON Patch, 'add' on an existing object key acts as 'replace'
      patch.push({
        op: "add",
        path: "/metadata/annotations/gitship.io~1rebuild",
        value: new Date().toISOString(),
      })
    }

    await k8sCustomApi.patchNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
      body: patch,
    }, { headers: { "Content-Type": "application/json-patch+json" } } as any)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Failed to trigger rebuild:", e.body?.message || e.message)
    return NextResponse.json(
      { error: e.body?.message || e.message },
      { status: 500 }
    )
  }
}
