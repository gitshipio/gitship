import { auth } from "@/auth"
import { k8sCoreApi } from "@/lib/k8s"
import { NextResponse } from "next/server"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ namespace: string, name: string }> }
) {
  const session = await auth()
  const { namespace, name } = await params

  if (!(await hasNamespaceAccess(namespace, session))) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    // Fetch all events in the namespace
    const response = await k8sCoreApi.listNamespacedEvent({ namespace })
    const items = response.items || []

    // Filter events related to cert-manager
    const tlsEvents = items.filter(event => {
        const kind = event.involvedObject.kind || ""
        return ["Certificate", "CertificateRequest", "Order", "Challenge", "Issuer", "ClusterIssuer"].includes(kind)
    }).map(event => ({
        lastTimestamp: event.lastTimestamp || event.eventTime || new Date().toISOString(),
        type: event.type,
        reason: event.reason,
        message: event.message,
        kind: event.involvedObject.kind,
        name: event.involvedObject.name
    })).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime())

    return NextResponse.json(tlsEvents)
  } catch (e: any) {
    console.error("[API] Failed to fetch TLS events:", e.body?.message || e.message)
    return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
  }
}
