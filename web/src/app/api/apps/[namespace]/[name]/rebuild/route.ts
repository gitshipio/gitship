import { auth } from "@/auth"
import { k8sAppsApi, k8sCoreApi, k8sMergePatch } from "@/lib/k8s"
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
    // 1. Delete existing deployment so it gets fully re-created after build
    try {
      await k8sAppsApi.deleteNamespacedDeployment({ name, namespace })
      console.log(`[API] Deleted deployment ${name} in ${namespace} for full rebuild`)
    } catch (e: any) {
      // Ignore 404 (deployment doesn't exist yet)
      if (e?.response?.statusCode !== 404 && e?.statusCode !== 404) {
        console.warn(`[API] Failed to delete deployment (non-fatal):`, e.body?.message || e.message)
      }
    }

    // 2. Delete all pods for this app to ensure clean state
    try {
      await k8sCoreApi.deleteCollectionNamespacedPod({
        namespace,
        labelSelector: `app=${name}`
      })
      console.log(`[API] Deleted pods for ${name} in ${namespace}`)
    } catch (e: any) {
      console.warn(`[API] Failed to delete pods (non-fatal):`, e.body?.message || e.message)
    }

    // 3. Set rebuild token to trigger a fresh build (no cache)
    await k8sMergePatch({
      group: "gitship.io",
      version: "v1alpha1",
      namespace,
      plural: "gitshipapps",
      name,
      body: {
        spec: {
          rebuildToken: Date.now().toString()
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[API] Failed to trigger rebuild:", e.body?.message || e.message)
    return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
  }
}
