import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { kc, k8sCoreApi, k8sCustomApi } from "@/lib/k8s"
import * as k8s from '@kubernetes/client-node'
import { resolveUserSession } from "@/lib/auth-utils"

function parseCpu(val: string): number {
    if (!val) return 0
    if (val.endsWith('n')) return parseInt(val) / 1000000
    if (val.endsWith('u')) return parseInt(val) / 1000
    if (val.endsWith('m')) return parseInt(val)
    return parseInt(val) * 1000
}

function parseMemory(val: any): number {
    if (val === undefined || val === null) return 0
    if (typeof val === 'number') return val
    const s = val.toString()
    if (s.endsWith('Ki')) return parseInt(s) * 1024
    if (s.endsWith('Mi')) return parseInt(s) * 1024 * 1024
    if (s.endsWith('Gi')) return parseInt(s) * 1024 * 1024 * 1024
    return parseInt(s)
}

export async function GET() {
  const session = await auth()
  const { internalId, username } = resolveUserSession(session)
  if (internalId === "unknown") return new NextResponse("Unauthorized", { status: 401 })

  // Use ID-based namespace if available (new standard), fallback to username-based (legacy)
  const namespace = internalId !== "unknown" 
    ? `gitship-${internalId}`
    : `gitship-user-${username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")}`
  
  try {
    const metricsClient = new k8s.Metrics(kc)
    const [quotaResponse, gitshipAppsResponse, pvcResponse]: any = await Promise.all([
        k8sCoreApi.readNamespacedResourceQuota({ name: "user-quota", namespace }).catch(() => null),
        k8sCustomApi.listNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
        }),
        k8sCoreApi.listNamespacedPersistentVolumeClaim({ namespace }).catch(() => ({ body: { items: [] } }))
    ])
    
    const gitshipApps = gitshipAppsResponse?.body || gitshipAppsResponse
    const appsItems = gitshipApps?.items || []
    const quota = quotaResponse?.body || quotaResponse
    const pvcs = pvcResponse?.body?.items || pvcResponse?.items || []

    // 1. Map Apps for easy lookup
    const appsMap: Record<string, any> = {}
    appsItems.forEach((app: any) => {
        appsMap[app.metadata.name] = {
            name: app.metadata.name,
            namespace: app.metadata.namespace,
            cpuLimit: app.spec.resources?.cpu || "500m",
            memoryLimit: app.spec.resources?.memory || "1Gi",
            storageLimit: app.spec.resources?.storage || "1Gi",
            cpuUsage: 0,
            memoryUsage: 0,
            storageUsage: 0,
            podCount: 0
        }
    })

    // 2. Map PVC storage to apps
    pvcs.forEach((pvc: any) => {
        // App PVCs are named appname-volumename
        for (const appName in appsMap) {
            if (pvc.metadata.name.startsWith(`${appName}-`)) {
                const size = pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || "0"
                appsMap[appName].storageUsage += parseMemory(size)
            }
        }
    })

    // 3. Fetch Pod Metrics separately to avoid failing the whole request
    let totalCpu = 0
    let totalMemory = 0
    let totalPods = 0

    try {
        const podMetrics = await metricsClient.getPodMetrics(namespace)
        totalPods = podMetrics.items.length

        podMetrics.items.forEach((pod: any) => {
            const appName = pod.metadata.labels?.app
            const app = appName ? appsMap[appName] : null
            
            pod.containers.forEach((container: any) => {
                const cpu = parseCpu(container.usage.cpu)
                const mem = parseMemory(container.usage.memory)
                
                totalCpu += cpu
                totalMemory += mem
                
                if (app) {
                    app.cpuUsage += cpu
                    app.memoryUsage += mem
                }
            })
            if (app) app.podCount++
        })
    } catch (me: any) {
        console.warn(`[METRICS] Could not fetch pod metrics: ${me.message}. This is normal if metrics-server is starting or missing.`)
    }

    // 3. Resolve Namespace Limits
    const hard = quota?.status?.hard || {}
    const used = quota?.status?.used || {}

    const sUsage = used["requests.storage"] || used["storage"] || "0"
    const sLimit = hard["requests.storage"] || hard["storage"] || "0"

    console.log(`[METRICS] Resolved Storage -> Usage: ${sUsage}, Limit: ${sLimit}`)
    
    return NextResponse.json({
        total: {
            cpuUsage: totalCpu + "m",
            cpuLimit: hard["limits.cpu"] || hard["cpu"] || "0",
            memoryUsage: totalMemory,
            memoryLimit: parseMemory(hard["limits.memory"] || hard["memory"] || "0"),
            podCount: totalPods,
            podLimit: parseInt(hard["pods"] || "0"),
            storageUsage: parseMemory(sUsage),
            storageLimit: parseMemory(sLimit)
        },
        apps: Object.values(appsMap)
    })
  } catch (e: any) {
    console.error(`[METRICS] Failed to fetch metrics for ${namespace}:`, e.message)
    return NextResponse.json({ 
        total: { cpuUsage: "0m", cpuLimit: "0", memoryUsage: 0, memoryLimit: 0, podCount: 0, podLimit: 0 },
        apps: []
    })
  }
}
