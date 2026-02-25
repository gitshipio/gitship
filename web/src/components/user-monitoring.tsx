"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cpu, MemoryStick, Box, Zap, Loader2, Settings2, Save, X, Database, Blocks, CheckCircle2, AlertCircle, Info } from "lucide-react"
import { cn, parseResourceValue, stripUnits } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface AppMetrics {
    name: string
    fullName?: string
    type: "app" | "integration"
    namespace: string
    cpuUsage: number
    cpuLimit: string
    memoryUsage: number
    memoryLimit: string
    storageUsage: number
    storageLimit: string
    podCount: number
    replicas: number
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
        buildCPU?: string
        buildMemory?: string
    }
    apps: AppMetrics[]
}

function formatMemory(val: number | string) {
    const bytes = typeof val === 'string' ? parseResourceValue(val, 'mem') : val
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + "Gi"
    return (bytes / (1024 * 1024)).toFixed(0) + "Mi"
}

function formatCpu(millicores: string | number) {
    const m = typeof millicores === 'string' ? parseResourceValue(millicores, 'cpu') : millicores
    return (m / 1000).toFixed(2) + " Cores"
}

export function UserMonitoring() {
    const [data, setData] = useState<MetricsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [editingGlobal, setEditingGlobal] = useState(false)
    const [savingGlobal, setSavingGlobal] = useState(false)
    const [globalBuildCPU, setGlobalBuildCPU] = useState("")
    const [globalBuildMemory, setGlobalBuildMemory] = useState("")

    const fetchData = async () => {
        try {
            const res = await fetch("/api/user/metrics", { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                setData(json)
                if (!editingGlobal) {
                    setGlobalBuildCPU(json.total.buildCPU || "1")
                    setGlobalBuildMemory(json.total.buildMemory || "2Gi")
                }
            }
        } catch (e) {
            console.error("Failed to fetch metrics:", e)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveGlobalQuotas = async () => {
        setSavingGlobal(true)
        try {
            const res = await fetch("/api/user/quotas", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    spec: {
                        quotas: {
                            buildCPU: globalBuildCPU,
                            buildMemory: globalBuildMemory
                        }
                    }
                })
            })
            if (res.ok) {
                setEditingGlobal(false)
                fetchData()
            }
        } catch (e) {
            console.error("Failed to save global quotas:", e)
        } finally {
            setSavingGlobal(false)
        }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 10000)
        return () => clearInterval(interval)
    }, [editingGlobal])

    if (loading && !data) {
        return (
            <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/5 animate-pulse">
                <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-bold uppercase tracking-widest opacity-50">Loading live data...</h3>
            </div>
        )
    }

    const total = data?.total
    const cpuUsageNum = typeof total?.cpuUsage === 'number' ? total.cpuUsage : parseResourceValue(total?.cpuUsage || "0", 'cpu')
    const cpuLimitNum = typeof total?.cpuLimit === 'number' ? total.cpuLimit : parseResourceValue(total?.cpuLimit || "0", 'cpu')
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
                            <span className="text-4xl font-black text-emerald-500 tracking-tighter">{formatCpu(total?.cpuUsage || "0m")}</span>
                            <span className="text-xs font-bold text-muted-foreground">/ {formatCpu(total?.cpuLimit || "0")} total</span>
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

            {/* GLOBAL BUILD RESOURCES */}
            <Card className="border-primary/20 bg-primary/[0.02] shadow-md">
                <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Zap className="w-6 h-6 fill-primary/20" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest opacity-70">Global Build Resources</h3>
                            <p className="text-[10px] text-muted-foreground">Limits applied to every build job in your account.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {editingGlobal ? (
                            <div className="flex items-center gap-3 animate-in zoom-in-95">
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase ml-1 opacity-50">Build CPU</span>
                                    <Input value={globalBuildCPU} onChange={e => setGlobalBuildCPU(e.target.value)} className="h-9 w-20 font-mono text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase ml-1 opacity-50">Build RAM</span>
                                    <Input value={globalBuildMemory} onChange={e => setGlobalBuildMemory(e.target.value)} className="h-9 w-24 font-mono text-xs" />
                                </div>
                                <div className="flex gap-1 pt-4">
                                    <Button size="sm" className="h-9 px-4 gap-2" onClick={handleSaveGlobalQuotas} disabled={savingGlobal}>
                                        {savingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditingGlobal(false)} disabled={savingGlobal}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase opacity-40 mb-0.5">CPU Limit</p>
                                    <p className="font-mono text-sm font-bold">{globalBuildCPU}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase opacity-40 mb-0.5">RAM Limit</p>
                                    <p className="font-mono text-sm font-bold">{globalBuildMemory}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setEditingGlobal(true)} className="gap-2 h-9 px-4">
                                    <Settings2 className="w-3.5 h-3.5" />
                                    Adjust Pipeline
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

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
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    
    // Store raw numbers for editing
    const [cpu, setCpu] = useState(stripUnits(app.cpuLimit, 'cpu'))
    const [mem, setMem] = useState(stripUnits(app.memoryLimit, 'mem'))
    const [storage, setStorage] = useState(stripUnits(app.storageLimit, 'mem'))
    const [replicas, setReplicas] = useState(app.replicas)

    // Sync state when app prop changes, but ONLY when not editing
    useEffect(() => {
        if (!editing) {
            setCpu(stripUnits(app.cpuLimit, 'cpu'))
            setMem(stripUnits(app.memoryLimit, 'mem'))
            setStorage(stripUnits(app.storageLimit, 'mem'))
            setReplicas(app.replicas)
        }
    }, [app, editing])

    const handleSave = async () => {
        setLoading(true)
        try {
            const cpuVal = cpu.trim() + "m"
            const memVal = mem.trim() + "Mi"
            const storageVal = storage.trim() + "Mi"

            let res;
            if (app.type === "app") {
                res = await fetch(`/api/apps/${app.namespace}/${app.name}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        spec: {
                            resources: {
                                cpu: cpuVal,
                                memory: memVal,
                                storage: storageVal
                            },
                            replicas
                        }
                    })
                })
            } else {
                // Integration
                res = await fetch(`/api/user/integrations`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: app.name,
                        patch: {
                            spec: {
                                resources: {
                                    cpu: cpuVal,
                                    memory: memVal
                                },
                                replicas
                            }
                        }
                    })
                })
            }
            if (res && res.ok) {
                setSuccess(true)
                setErrorMsg(null)
                setTimeout(() => setSuccess(false), 3000)
                setEditing(false)
                onUpdate()
            } else if (res) {
                const data = await res.json()
                setErrorMsg(data.error || "Failed to update")
                setTimeout(() => setErrorMsg(null), 5000)
            }
        } catch (e: unknown) {
            // @ts-expect-error known dynamic access
            setErrorMsg(e.message)
            setTimeout(() => setErrorMsg(null), 5000)
        } finally {
            setLoading(false)
        }
    }

    const cpuUsagePct = parseResourceValue(app.cpuLimit, 'cpu') > 0 ? (app.cpuUsage / parseResourceValue(app.cpuLimit, 'cpu')) * 100 : 0
    const memUsagePct = parseResourceValue(app.memoryLimit, 'mem') > 0 ? (app.memoryUsage / parseResourceValue(app.memoryLimit, 'mem')) * 100 : 0
    const storageUsagePct = parseResourceValue(app.storageLimit, 'mem') > 0 ? (app.storageUsage / parseResourceValue(app.storageLimit, 'mem')) * 100 : 0

    return (
        <Card className="overflow-hidden border-border/40 hover:border-primary/30 transition-colors shadow-sm">
            <div className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={cn("p-2 rounded-lg", app.type === "app" ? "bg-primary/10 text-primary" : "bg-sky-500/10 text-sky-600")}>
                            {app.type === "app" ? <Box className="w-4 h-4" /> : <Blocks className="w-4 h-4" />}
                        </div>
                        <h4 className="font-bold text-base truncate">{app.name}</h4>
                        <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0 uppercase opacity-70">{app.type}</Badge>
                        <Badge variant="outline" className="text-[9px] font-black px-1.5 py-0">{app.podCount} Pods</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                <span className="opacity-50 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                                <span>{formatCpu(app.cpuUsage)} <span className="opacity-30">/</span> {formatCpu(app.cpuLimit)}</span>
                            </div>
                            <Progress value={cpuUsagePct} className="h-1.5" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                <span className="opacity-50 flex items-center gap-1"><Zap className="w-3 h-3" /> RAM</span>
                                <span>{formatMemory(app.memoryUsage)} <span className="opacity-30">/</span> {formatMemory(app.memoryLimit)}</span>
                            </div>
                            <Progress value={memUsagePct} className="h-1.5" />
                        </div>
                        <div className="space-y-2">
                            {app.type === "app" ? (
                                <>
                                    <div className="flex justify-between items-end text-[10px] font-black uppercase">
                                        <span className="opacity-50 flex items-center gap-1"><Database className="w-3 h-3" /> Disk</span>
                                        <span>{formatMemory(app.storageUsage)} <span className="opacity-30">/</span> {app.storageLimit}</span>
                                    </div>
                                    <Progress value={storageUsagePct} className="h-1.5" />
                                </>
                            ) : (
                                <div className="h-full flex items-center justify-center opacity-20 italic text-[10px] uppercase font-black">
                                    No persistent storage
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2 md:pt-0">
                    {success && !editing && (
                        <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs animate-in fade-in slide-in-from-right-2">
                            <CheckCircle2 className="w-4 h-4" /> Saved!
                        </div>
                    )}
                    {errorMsg && (
                        <div className="flex items-center gap-1.5 text-destructive font-bold text-[10px] max-w-[150px] animate-in shake-1 duration-300">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {errorMsg}
                        </div>
                    )}
                    {editing ? (
                        <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border animate-in zoom-in-95">
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">mCore</span>
                                <Input value={cpu} onChange={e => setCpu(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">MiB</span>
                                <Input value={mem} onChange={e => setMem(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[8px] font-black uppercase ml-1 opacity-50">Pods</span>
                                <Input type="number" value={replicas} onChange={e => setReplicas(parseInt(e.target.value) || 0)} className="h-8 w-12 font-mono text-[10px]" />
                            </div>
                            {app.type === "app" && (
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black uppercase ml-1 opacity-50">MiB Disk</span>
                                    <Input value={storage} onChange={e => setStorage(e.target.value)} className="h-8 w-16 font-mono text-[10px]" />
                                </div>
                            )}
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
