import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCoreApi } from "@/lib/k8s"
import { hasNamespaceAccess } from "@/lib/auth-utils"

export async function GET(req: NextRequest) {
  const session = await auth()
  const { searchParams } = new URL(req.url)
  const name = searchParams.get("name")
  const namespace = searchParams.get("namespace") || "default"

  // Security Check
  if (!await hasNamespaceAccess(namespace, session)) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 })
  }

  const podNameParam = searchParams.get("podName")
  const tailLines = parseInt(searchParams.get("tailLines") || "200")

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  try {
    // Find pods for this app
    const podList = await k8sCoreApi.listNamespacedPod({
      namespace,
      labelSelector: `app=${name}`,
    })

    const pods = podList.items || []
    if (pods.length === 0) {
      return NextResponse.json({ 
        logs: ["No pods found for this app."], 
        pods: [] 
      })
    }

    // Map pod info for the UI
    const availablePods = pods.map(p => ({
        name: p.metadata?.name,
        phase: p.status?.phase,
        ready: p.status?.containerStatuses?.[0]?.ready || false,
        restarts: p.status?.containerStatuses?.[0]?.restartCount || 0
    }))

    // Determine target pod
    let targetPodName = podNameParam
    if (!targetPodName) {
        const firstRunning = pods.find(p => p.status?.phase === "Running") || pods[0]
        targetPodName = firstRunning.metadata?.name || ""
    }

    if (!targetPodName) {
      return NextResponse.json({ logs: ["Pod name not available."], pods: availablePods })
    }

    const logResponse = await k8sCoreApi.readNamespacedPodLog({
      name: targetPodName,
      namespace,
      container: "app",
      tailLines,
      timestamps: true
    })

    const logText = typeof logResponse === "string" ? logResponse : String(logResponse)
    const lines = logText.split("\n").filter(Boolean)

    return NextResponse.json({ 
        logs: lines, 
        pod: targetPodName,
        pods: availablePods 
    })
  } catch (e: any) {
    console.error("Failed to fetch logs:", e.body?.message || e.message)
    return NextResponse.json({
      logs: [`Error fetching logs: ${e.body?.message || e.message}`],
    })
  }
}
