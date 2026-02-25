import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { NextResponse } from "next/server"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ namespace: string, name: string }> }
) {
  const session = await auth()
  const { namespace, name } = await params

  if (!(await hasNamespaceAccess(namespace, session))) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const patch = {
        spec: {
            rebuildToken: Date.now().toString()
        }
    }

    await k8sCustomApi.patchNamespacedCustomObject({
        group: "gitship.io",
        version: "v1alpha1",
        namespace,
        plural: "gitshipapps",
        name,
        body: patch
            }, {
                // @ts-expect-error - headers is missing in ConfigurationOptions but supported at runtime
                headers: { "Content-Type": "application/merge-patch+json" }
            })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[API] Failed to trigger rebuild:", e.body?.message || e.message)
    return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
  }
}
