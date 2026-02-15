import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { kc } from "@/lib/k8s"
import * as k8s from '@kubernetes/client-node'

export async function GET() {
  const session = await auth()
  const username = (session?.user as any)?.githubUsername || session?.user?.name
  if (!username) return new NextResponse("Unauthorized", { status: 401 })

  const namespace = `gitship-user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")}`
  
  try {
    const metricsClient = new k8s.Metrics(kc)
    const podMetrics = await metricsClient.getPodMetrics(namespace)
    
    // Sum up usage across all pods
    let totalCpu = 0
    let totalMemory = 0

    podMetrics.items.forEach(pod => {
        pod.containers.forEach(container => {
            // CPU is in nanocores or millicores
            const cpu = container.usage.cpu
            if (cpu.endsWith('n')) totalCpu += parseInt(cpu) / 1000000
            else if (cpu.endsWith('u')) totalCpu += parseInt(cpu) / 1000
            else if (cpu.endsWith('m')) totalCpu += parseInt(cpu)
            else totalCpu += parseInt(cpu) * 1000

            // Memory is in Ki, Mi, Gi
            const mem = container.usage.memory
            if (mem.endsWith('Ki')) totalMemory += parseInt(mem) * 1024
            else if (mem.endsWith('Mi')) totalMemory += parseInt(mem) * 1024 * 1024
            else if (mem.endsWith('Gi')) totalMemory += parseInt(mem) * 1024 * 1024 * 1024
            else totalMemory += parseInt(mem)
        })
    })

    return NextResponse.json({
        cpu: totalCpu + "m",
        memory: totalMemory,
        podCount: podMetrics.items.length
    })
  } catch (e: any) {
    console.error(`[METRICS] Failed to fetch metrics for ${namespace}:`, e.message)
    return NextResponse.json({ cpu: "0m", memory: 0, podCount: 0 })
  }
}
