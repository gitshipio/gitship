import { auth } from "@/auth"
import { k8sCoreApi } from "@/lib/k8s"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { namespace, name } = await params

  try {
    // 1. Find pods for this app
    const podsRes = await k8sCoreApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${name}`
    })

    const pods = podsRes.items || []
    if (pods.length === 0) return NextResponse.json({ logs: "No running pods found for this application." })

    // 2. Get logs from the first pod's 'app' container
    const podName = pods[0].metadata?.name
    if (!podName) return NextResponse.json({ logs: "Pod has no name." })

    // readNamespacedPodLog(name, namespace, container, follow, previous, sinceSeconds, sinceTime, timestamps, tailLines, limitBytes, pretty)
    const logRes = await k8sCoreApi.readNamespacedPodLog({
        name: podName,
        namespace,
        container: "app",
        tailLines: 500,
        timestamps: true
    })

    return NextResponse.json({ 
        logs: (logRes as any).body || logRes,
        podName
    })
  } catch (e: any) {
    console.error(`[Runtime Logs] Failed to fetch logs for ${name}:`, e.message)
    // If "app" container doesn't exist yet or is restarting
    return NextResponse.json({ logs: `Waiting for container 'app' to start...
(${e.message})` })
  }
}
