"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cpu, MemoryStick, Box, Activity, Zap, TrendingUp, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

interface QuotaData {
    hard: Record<string, string>
    used: Record<string, string>
}

interface MetricsData {
    cpu: string
    memory: number
    podCount: number
}

export function UserMonitoring({ data: initialData }: { data?: QuotaData }) {
    const [metrics, setMetrics] = useState<MetricsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/user/metrics")
                if (res.ok) {
                    const json = await res.json()
                    setMetrics(json)
                }
            } catch (e) {
                console.error("Failed to fetch metrics:", e)
            } finally {
                setLoading(false)
            }
        }
        
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    if (loading && !metrics) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5 animate-pulse">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-bold uppercase tracking-widest opacity-50">Loading live data...</h3>
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden shadow-lg shadow-emerald-500/5">
                        <CardHeader className="pb-2 border-b border-emerald-500/10 bg-emerald-500/[0.02]">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                <Cpu className="w-3.5 h-3.5" />
                                Current CPU Usage
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pb-8">
                            <div className="text-5xl font-black text-emerald-500 tracking-tighter">
                                {metrics?.cpu || "0m"}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground mt-2 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-emerald-500" />
                                Real-time millicores
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-500/20 bg-blue-500/[0.03] overflow-hidden shadow-lg shadow-blue-500/5">
                        <CardHeader className="pb-2 border-b border-blue-500/10 bg-blue-500/[0.02]">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                <MemoryStick className="w-3.5 h-3.5" />
                                Memory Footprint
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pb-8">
                            <div className="text-5xl font-black text-blue-500 tracking-tighter">
                                {metrics ? (metrics.memory / (1024 * 1024)).toFixed(1) + "Mi" : "0Mi"}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground mt-2 flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-blue-500" />
                                Physical RAM in use
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-purple-500/20 bg-purple-500/[0.03] overflow-hidden shadow-lg shadow-purple-500/5">
                        <CardHeader className="pb-2 border-b border-purple-500/10 bg-purple-500/[0.02]">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                <Box className="w-3.5 h-3.5" />
                                Running Instances
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 pb-8">
                            <div className="text-5xl font-black text-purple-500 tracking-tighter">
                                {metrics?.podCount || 0}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground mt-2 flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3 text-purple-500" />
                                Active application pods
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="p-6 rounded-2xl border bg-muted/5 border-dashed flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">About these stats</h4>
                        <p className="text-xs text-muted-foreground">These metrics represent the actual real-time consumption of your running applications, updated every 10 seconds.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Live Feedback</span>
                </div>
            </div>
        </div>
    )
}
