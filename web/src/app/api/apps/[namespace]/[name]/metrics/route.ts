import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCoreApi } from "@/lib/k8s"
import * as k8s from "@kubernetes/client-node"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { namespace, name } = await params

  try {
    // Use metrics API via KubeConfig
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()
    const metricsClient = new k8s.Metrics(kc)

    const podMetrics = await metricsClient.getPodMetrics(namespace)

    // Filter pods for this app
    const appPods = await k8sCoreApi.listNamespacedPod({
      namespace,
      labelSelector: `app=${name}`,
    })
    const podNames = new Set((appPods.items || []).map(p => p.metadata?.name))

    const pods = (podMetrics.items || [])
      .filter(m => podNames.has(m.metadata?.name))
      .map(m => ({
        name: m.metadata?.name,
        cpu: m.containers?.[0]?.usage?.cpu || "0m",
        memory: m.containers?.[0]?.usage?.memory || "0Mi",
      }))

    return NextResponse.json({ pods })
  } catch (e: any) {
    console.error("Metrics error:", e.message)
    return NextResponse.json({ error: "Metrics not available" }, { status: 404 })
  }
}
