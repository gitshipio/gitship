"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Cpu, MemoryStick, Box, Activity, Zap, TrendingUp, Info, Loader2, Settings2, Save, X, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface AppMetrics {
    name: string
    namespace: string
    cpuUsage: number
    cpuLimit: string
    memoryUsage: number
    memoryLimit: string
    storageUsage: number
    storageLimit: string
    podCount: number
}

interface MetricsData {
    total: {
        cpuUsage: string
        cpuLimit: string
        memoryUsage: number
        memoryLimit: number
        podCount: number
        podLimit: number
        storageUsage: number
        storageLimit: number
    }
    apps: AppMetrics[]
}

function parseResourceValue(val: string): number {
    if (!val) return 0
    const s = val.toString().toLowerCase()
    if (s.endsWith("m")) return parseFloat(s)
    if (s.endsWith("gi")) return parseFloat(s) * 1024 * 1024 * 1024
    if (s.endsWith("mi")) return parseFloat(s) * 1024 * 1024
    if (s.endsWith("ki")) return parseFloat(s) * 1024
    return parseFloat(s)
}

function formatMemory(bytes: number) {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + "Gi"
    return (bytes / (1024 * 1024)).toFixed(0) + "Mi"
}

export function UserMonitoring() {
    const [data, setData] = useState<MetricsData | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const res = await fetch("/api/user/metrics", { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        } catch (e) {
            console.error("Failed to fetch metrics:", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [])

    if (loading && !data) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5 animate-pulse">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-bold uppercase tracking-widest opacity-50">Loading live data...</h3>
            </div>
        )
    }

    const total = data?.total
    const cpuUsageNum = parseResourceValue(total?.cpuUsage || "0")
    const cpuLimitNum = parseResourceValue(total?.cpuLimit || "0")
    const cpuPercent = cpuLimitNum > 0 ? (cpuUsageNum / cpuLimitNum) * 100 : 0

    const memUsageNum = total?.memoryUsage || 0
    const memLimitNum = total?.memoryLimit || 0
    const memPercent = memLimitNum > 0 ? (memUsageNum / memLimitNum) * 100 : 0

    const podCount = total?.podCount || 0
    const podLimit = total?.podLimit || 0
    const podPercent = podLimit > 0 ? (podCount / podLimit) * 100 : 0

    const storageUsageNum = total?.storageUsage || 0
    const storageLimitNum = total?.storageLimit || 0
    const storagePercent = storageLimitNum > 0 ? (storageUsageNum / storageLimitNum) * 100 : 0

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* CPU CARD */}
                <Card className="border-emerald-500/20 bg-emerald-500/[0.03] overflow-hidden shadow-lg">
                    <CardHeader className="pb-2 border-b border-emerald-500/10">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" />
                            CPU Utilization
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-emerald-500 tracking-tighter">{total?.cpuUsage}</span>
                            <span className="text-xs font-bold text-muted-foreground">/ {total?.cpuLimit} cores</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-[9px] font-bold uppercase opacity-50">
                                <span>Usage</span>
                                <span>{cpuPercent.toFixed(1)}%</span>
                            </div>
                            <Progress value={cpuPercent} className="h-1.5 bg-emerald-500/10" />
                        </div>
                    </CardContent>
                </Card>

                {/* MEMORY CARD */}
                <Card className="border-blue-500/20 bg-blue-500/[0.03] overflow-hidden shadow-lg">
                    <CardHeader className="pb-2 border-b border-blue-500/10">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
                            <MemoryStick className="w-3.5 h-3.5" />
                            Memory Usage
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-blue-500 tracking-tighter">{formatMemory(memUsageNum)}</span>
                            <span className="text-xs font-bold text-muted-foreground">/ {formatMemory(memLimitNum)} total</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-[9px] font-bold uppercase opacity-50">
                                <span>Consumption</span>
                                <span>{memPercent.toFixed(1)}%</span>
                            </div>
                            <Progress value={memPercent} className="h-1.5 bg-blue-500/10" />
                        </div>
                    </CardContent>
                </Card>

                {/* PODS CARD */}
                <Card className="border-purple-500/20 bg-purple-500/[0.03] overflow-hidden shadow-lg">
                    <CardHeader className="pb-2 border-b border-purple-500/10">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-purple-600 flex items-center gap-2">
                            <Box className="w-3.5 h-3.5" />
                            Active Instances
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-purple-500 tracking-tighter">{podCount}</span>
                            <span className="text-xs font-bold text-muted-foreground">/ {podLimit} pods</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-[9px] font-bold uppercase opacity-50">
                                <span>Capacity</span>
                                <span>{podPercent.toFixed(1)}%</span>
                            </div>
                            <Progress value={podPercent} className="h-1.5 bg-purple-500/10" />
                        </div>
                    </CardContent>
                </Card>

                {/* STORAGE CARD */}
                <Card className="border-amber-500/20 bg-amber-500/[0.03] overflow-hidden shadow-lg">
                    <CardHeader className="pb-2 border-b border-amber-500/10">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                            <Database className="w-3.5 h-3.5" />
                            Disk Storage
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-amber-500 tracking-tighter">{formatMemory(storageUsageNum)}</span>
                            <span className="text-xs font-bold text-muted-foreground">/ {formatMemory(storageLimitNum)} total</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <div className="flex justify-between text-[9px] font-bold uppercase opacity-50">
                                <span>Provisioned</span>
                                <span>{storagePercent.toFixed(1)}%</span>
                            </div>
                            <Progress value={storagePercent} className="h-1.5 bg-amber-500/10" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* APPS SECTION */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-primary" />
                            Application Resource Management
                        </h3>
                        <p className="text-xs text-muted-foreground">Manage individual app limits and monitor real-time consumption.</p>
                    </div>
                </div>

                <div className="grid gap-4">
                    {data?.apps.map(app => (
                        <AppResourceRow key={app.name} app={app} onUpdate={fetchData} />
                    ))}
                    {data?.apps.length === 0 && (
                        <div className="p-10 text-center border-2 border-dashed rounded-2xl bg-muted/5 italic text-muted-foreground">
                            No active applications found in this namespace.
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 rounded-2xl border bg-muted/5 border-dashed flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">About these stats</h4>
                        <p className="text-xs text-muted-foreground">These metrics represent the actual real-time consumption of your running applications and the limits enforced by Kubernetes.</p>
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

function AppResourceRow({ app, onUpdate }: { app: AppMetrics, onUpdate: () => void }) {
    const [editing, setEditing] = useState(false)
    const [saving, setLoading] = useState(false)
    
    const [cpu, setCpu] = useState(app.cpuLimit)
    const [mem, setMem] = useState(app.memoryLimit)
    const [storage, setStorage] = useState(app.storageLimit)

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/apps/${app.namespace}/${app.name}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spec: {
                        resources: {
                            cpu,
                            memory: mem,
                            storage: storage
                        }
                    }
                })
            })
            if (res.ok) {
                setEditing(false)
                onUpdate()
            }
        } catch (e) {
            console.error("Update failed", e)
        } finally {
            setLoading(false)
        }
    }

    const cpuUsagePct = parseResourceValue(app.cpuLimit) > 0 ? (app.cpuUsage / parseResourceValue(app.cpuLimit)) * 100 : 0
    const memUsagePct = parseResourceValue(app.memoryLimit) > 0 ? (app.memoryUsage / parseResourceValue(app.memoryLimit)) * 100 : 0
    const storageUsagePct = parseResourceValue(app.storageLimit) > 0 ? (app.storageUsage / parseResourceValue(app.storageLimit)) * 100 : 0

    return (
        <Card className="overflow-hidden border-border/40 hover:border-primary/30 transition-colors shadow-sm">
            <div className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Box className="w-4 h-4 text-primary" />
                        </div>
                        <h4 className="font-bold text-base truncate">{app.name}</h4>
                        <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0">{app.podCount} Pods</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                <span className="opacity-50 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                                <span>{app.cpuUsage}m <span className="opacity-30">/</span> {app.cpuLimit}</span>
                            </div>
                            <Progress value={cpuUsagePct} className="h-1.5" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                <span className="opacity-50 flex items-center gap-1"><Zap className="w-3 h-3" /> RAM</span>
                                <span>{formatMemory(app.memoryUsage)} <span className="opacity-30">/</span> {app.memoryLimit}</span>
                            </div>
                            <Progress value={memUsagePct} className="h-1.5" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                <span className="opacity-50 flex items-center gap-1"><Database className="w-3 h-3" /> Disk</span>
                                <span>{formatMemory(app.storageUsage)} <span className="opacity-30">/</span> {app.storageLimit}</span>
                            </div>
                            <Progress value={storageUsagePct} className="h-1.5" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2 md:pt-0">
                    {editing ? (
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border animate-in zoom-in-95">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">CPU</span>
                                <Input value={cpu} onChange={e => setCpu(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">RAM</span>
                                <Input value={mem} onChange={e => setMem(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">Disk</span>
                                <Input value={storage} onChange={e => setStorage(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                            </div>
                            <div className="flex gap-1 pl-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={handleSave} disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditing(false)} disabled={saving}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2 font-bold h-9">
                            <Settings2 className="w-3.5 h-3.5" />
                            Adjust Limits
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}
