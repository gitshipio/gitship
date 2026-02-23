"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Cpu, MemoryStick } from "lucide-react"

interface AppStatsProps {
    appName: string
    namespace: string
    limits?: { cpu?: string; memory?: string }
}

interface PodMetrics {
    name: string
    cpu: string // e.g. "50m" or "100m"
    memory: string // e.g. "128Mi" or "256Mi"
    cpuPercent?: number
    memPercent?: number
}

function parseCpu(cpu: string): number {
    if (cpu.endsWith("n")) return parseInt(cpu) / 1_000_000 // nanocores to millicores
    if (cpu.endsWith("m")) return parseInt(cpu)
    return parseFloat(cpu) * 1000 // cores to millicores
}

function parseMemory(mem: string): number {
    if (mem.endsWith("Ki")) return parseInt(mem) / 1024 // to Mi
    if (mem.endsWith("Mi")) return parseInt(mem)
    if (mem.endsWith("Gi")) return parseInt(mem) * 1024
    return parseInt(mem) / (1024 * 1024) // bytes to Mi
}

function BarChart({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
    const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
    
    let displayValue = value.toFixed(1)
    let displayMax = max.toFixed(0)
    let displayUnit = unit

    if (unit === "m") {
        displayValue = (value / 1000).toFixed(2)
        displayMax = (max / 1000).toFixed(2)
        displayUnit = " Cores"
    } else if (unit === "Mi") {
        if (value >= 1024) {
            displayValue = (value / 1024).toFixed(1)
            displayUnit = " Gi"
        }
        if (max >= 1024) {
            displayMax = (max / 1024).toFixed(1)
        }
    }

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <span>{displayValue}{displayUnit} / {displayMax}{displayUnit}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

export function AppStats({ appName, namespace, limits }: AppStatsProps) {
    const [metrics, setMetrics] = useState<PodMetrics[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const maxCpu = parseCpu(limits?.cpu || "500m")
    const maxMem = parseMemory(limits?.memory || "1Gi")

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch(`/api/apps/${namespace}/${appName}/metrics`)
            if (res.ok) {
                const data = await res.json()
                setMetrics(data.pods || [])
                setError("")
            } else if (res.status === 404) {
                setError("Metrics Server not available. Deploy metrics-server to enable stats.")
            } else {
                setError("Failed to fetch metrics.")
            }
        } catch {
            setError("Failed to connect to metrics API.")
        } finally {
            setLoading(false)
        }
    }, [appName, namespace])

    useEffect(() => {
        fetchMetrics()
        const interval = setInterval(fetchMetrics, 10000) // Refresh every 10s
        return () => clearInterval(interval)
    }, [fetchMetrics])

    if (loading) {
        return <p className="text-sm text-muted-foreground">Loading metrics...</p>
    }

    if (error) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {metrics.map((pod) => {
                const cpuMillis = parseCpu(pod.cpu)
                const memMi = parseMemory(pod.memory)
                return (
                    <Card key={pod.name}>
                        <CardContent className="pt-4 space-y-3">
                            <p className="text-sm font-medium font-mono">{pod.name}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-2">
                                    <Cpu className="w-4 h-4 mt-0.5 text-blue-500" />
                                    <div className="flex-1">
                                        <BarChart value={cpuMillis} max={maxCpu} label="CPU" unit="m" color="bg-blue-500" />
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <MemoryStick className="w-4 h-4 mt-0.5 text-purple-500" />
                                    <div className="flex-1">
                                        <BarChart value={memMi} max={maxMem} label="Memory" unit="Mi" color="bg-purple-500" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
            {metrics.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                    No pod metrics available yet.
                </p>
            )}
            <p className="text-xs text-muted-foreground">Auto-refreshing every 10s</p>
        </div>
    )
}
