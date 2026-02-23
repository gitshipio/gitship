import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { NextResponse } from "next/server"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  const { namespace, name } = await params

  // Security Check
  if (!await hasNamespaceAccess(namespace, session)) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  const { commitId } = await request.json()

  if (!commitId) return NextResponse.json({ error: "commitId is required" }, { status: 400 })

  try {
    const patch = [
      {
        op: "replace",
        path: "/spec/source",
        value: {
          type: "commit",
          value: commitId
        },
      },
    ]

    await k8sCustomApi.patchNamespacedCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
      body: patch
    }, {
      // @ts-expect-error custom headers for JSON Patch
      headers: { "Content-Type": "application/json-patch+json" }
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[Rollback] Failed for ${name}:`, e.message)
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
