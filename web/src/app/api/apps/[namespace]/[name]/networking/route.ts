import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCoreApi, k8sNetworkingApi } from "@/lib/k8s"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { namespace, name } = await params

  const services: any[] = []
  const ingresses: any[] = []

  try {
    // Get services with matching label
    const svcList = await k8sCoreApi.listNamespacedService({
      namespace,
      labelSelector: `app=${name}`,
    })

    for (const svc of svcList.items || []) {
      services.push({
        name: svc.metadata?.name,
        type: svc.spec?.type,
        clusterIP: svc.spec?.clusterIP,
        ports: (svc.spec?.ports || []).map(p => ({
          port: p.port,
          targetPort: typeof p.targetPort === "object" ? (p.targetPort as any).intVal : p.targetPort,
          protocol: p.protocol,
        })),
      })
    }
  } catch (e: any) {
    console.error("Failed to list services:", e.body?.message || e.message)
  }

  try {
    // Try to get ingress by name
    const ing = await k8sNetworkingApi.readNamespacedIngress({ name, namespace })
    if (ing) {
      ingresses.push({
        name: ing.metadata?.name,
        hosts: (ing.spec?.rules || []).map(r => r.host).filter(Boolean),
        paths: (ing.spec?.rules || []).flatMap(r =>
          (r.http?.paths || []).map(p => ({
            path: p.path,
            service: p.backend?.service?.name,
            port: p.backend?.service?.port?.number,
          }))
        ),
      })
    }
  } catch {
    // Ingress might not exist
  }

  return NextResponse.json({ services, ingresses })
}
