import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { kc, k8sCoreApi, k8sCustomApi } from "@/lib/k8s"
import * as k8s from '@kubernetes/client-node'
import { resolveUserSession } from "@/lib/auth-utils"

import { GitshipApp, GitshipIntegration } from "@/lib/types"

function parseCpu(val: string): number {
    if (!val) return 0
    if (val.endsWith('n')) return parseInt(val) / 1000000
    if (val.endsWith('u')) return parseInt(val) / 1000
    if (val.endsWith('m')) return parseInt(val)
    return parseInt(val) * 1000
}

function parseMemory(val: string | number | undefined | null): number {
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
    const [quotaResponse, gitshipAppsResponse, gitshipIntegrationsResponse, pvcResponse, userResponse] = await Promise.all([
        k8sCoreApi.readNamespacedResourceQuota({ name: "user-quota", namespace }).catch(() => null),
        k8sCustomApi.listNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipapps",
        }),
        k8sCustomApi.listNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipintegrations",
        }).catch(() => ({ body: { items: [] } })),
        k8sCoreApi.listNamespacedPersistentVolumeClaim({ namespace }).catch(() => ({ body: { items: [] } })),
        k8sCustomApi.getClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipusers",
            name: internalId
        }).catch(() => null)
    ])
    
    const gitshipApps = gitshipAppsResponse?.body || gitshipAppsResponse
    const appsItems = gitshipApps?.items || []
    const gitshipIntegrations = gitshipIntegrationsResponse?.body || gitshipIntegrationsResponse
    const integrationItems = gitshipIntegrations?.items || []
    // @ts-expect-error dynamic access
    const quota = quotaResponse?.body || quotaResponse
    // @ts-expect-error dynamic access
    const pvcs = pvcResponse?.body?.items || pvcResponse?.items || []
    const user = (userResponse?.body || userResponse) as any

    // 1. Map Apps for easy lookup
    const appsMap: Record<string, {
        name: string,
        fullName?: string,
        type: string,
        namespace: string,
        cpuLimit: string,
        memoryLimit: string,
        storageLimit: string,
        cpuUsage: number,
        memoryUsage: number,
        storageUsage: number,
        podCount: number,
        replicas: number
    }> = {}

    appsItems.forEach((app: GitshipApp) => {
        appsMap[app.metadata.name] = {
            name: app.metadata.name,
            type: "app",
            namespace: app.metadata.namespace,
            cpuLimit: app.spec.resources?.cpu || "500m",
            memoryLimit: app.spec.resources?.memory || "1Gi",
            storageLimit: app.spec.resources?.storage || "1Gi",
            cpuUsage: 0,
            memoryUsage: 0,
            storageUsage: 0,
            podCount: 0,
            replicas: app.spec.replicas || 1
        }
    })

    // 1b. Map Integrations
    integrationItems.forEach((int: GitshipIntegration) => {
        const name = `gitship-integration-${int.metadata.name}`
        appsMap[name] = {
            name: int.metadata.name,
            fullName: name,
            type: "integration",
            namespace: int.metadata.namespace,
            cpuLimit: int.spec.resources?.cpu || "100m",
            memoryLimit: int.spec.resources?.memory || "128Mi",
            storageLimit: "0",
            cpuUsage: 0,
            memoryUsage: 0,
            storageUsage: 0,
            podCount: 0,
            replicas: int.spec.replicas ?? (int.spec.enabled ? 1 : 0)
        }
    })

    // 2. Map PVC storage to apps
    pvcs.forEach((pvc: { metadata: { name: string }, spec?: { resources?: { requests?: { storage?: string } } }, status?: { capacity?: { storage?: string } } }) => {
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

        podMetrics.items.forEach((pod: unknown) => {
            // Apps use 'app' label, Integrations use 'gitship.io/integration'
            // @ts-expect-error dynamic access
            const appName = pod.metadata.labels?.app
            // @ts-expect-error dynamic access
            const intName = pod.metadata.labels?.["gitship.io/integration"]
            
            const targetName = appName || (intName ? `gitship-integration-${intName}` : null)
            const entry = targetName ? appsMap[targetName] : null
            
            // @ts-expect-error dynamic access
            pod.containers.forEach((container: unknown) => {
                // @ts-expect-error dynamic access
                const cpu = parseCpu(container.usage.cpu)
                // @ts-expect-error dynamic access
                const mem = parseMemory(container.usage.memory)
                
                totalCpu += cpu
                totalMemory += mem
                
                if (entry) {
                    entry.cpuUsage += cpu
                    entry.memoryUsage += mem
                }
            })
            if (entry) entry.podCount++
        })
    } catch (me: unknown) {
        // @ts-expect-error dynamic access
        console.warn(`[METRICS] Could not fetch pod metrics: ${me.message}. This is normal if metrics-server is starting or missing.`)
    }

    // 3. Resolve Namespace Limits
    const hard = quota?.status?.hard || {}
    // const used = quota?.status?.used || {} // removed unused

    const sUsage = quota?.status?.used?.["requests.storage"] || quota?.status?.used?.["storage"] || "0"
    const sLimit = hard["requests.storage"] || hard["storage"] || "0"

    console.log(`[METRICS] Resolved Storage -> Usage: ${sUsage}, Limit: ${sLimit}`)
    
    return NextResponse.json({
        total: {
            cpuUsage: totalCpu,
            cpuLimit: parseCpu(hard["limits.cpu"] || hard["cpu"] || "0"),
            memoryUsage: totalMemory,
            memoryLimit: parseMemory(hard["limits.memory"] || hard["memory"] || "0"),
            podCount: totalPods,
            podLimit: parseInt(hard["pods"] || "0"),
            storageUsage: parseMemory(sUsage),
            storageLimit: parseMemory(sLimit),
            buildCPU: user?.spec?.quotas?.buildCPU || "1",
            buildMemory: user?.spec?.quotas?.buildMemory || "2Gi"
        },
        apps: Object.values(appsMap)
    })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[METRICS] Failed to fetch metrics for ${namespace}:`, e.message)
    return NextResponse.json({ 
        total: { cpuUsage: "0m", cpuLimit: "0", memoryUsage: 0, memoryLimit: 0, podCount: 0, podLimit: 0 },
        apps: []
    })
  }
}
