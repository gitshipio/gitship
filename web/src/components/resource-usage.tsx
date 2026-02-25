"use client"

import { useCallback, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Cpu, MemoryStick, Box, Loader2, Zap, Database } from "lucide-react"
import { cn, parseResourceValue } from "@/lib/utils"

interface QuotaData {
    hard: Record<string, string>
    used: Record<string, string>
}

function UsageDetail({ label, used, hard, unit, icon: Icon, color, isCpu, type = 'mem' }: { 
    label: string, used: string | number, hard: string | number, unit?: string, icon: React.ComponentType<{ className?: string }>, color: string, isCpu?: boolean, type?: 'cpu' | 'mem' | 'raw'
}) {
    const usedNum = parseResourceValue(used, type)
    const hardNum = parseResourceValue(hard, type)
    
    const percent = hardNum > 0 ? Math.min((usedNum / hardNum) * 100, 100) : 0
    const remaining = Math.max(0, hardNum - usedNum)
    
    const format = (v: number) => {
        if (isCpu) {
            return (v / 1000).toFixed(2) + " Cores"
        }
        if (v >= 1024 * 1024 * 1024) return (v / (1024 * 1024 * 1024)).toFixed(1) + "Gi"
        if (v >= 1024 * 1024) return (v / (1024 * 1024)).toFixed(0) + "Mi"
        if (label === "Active Pods" || type === 'raw') return v.toFixed(0)
        return v.toFixed(0) + (unit || "")
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className={cn("p-2 rounded-lg bg-background border shadow-sm", color)}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-tighter opacity-40 leading-none mb-1">{label}</p>
                        <p className="text-sm font-bold leading-none truncate max-w-[120px]" title={String(used)}>{format(usedNum)} used</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-tighter opacity-40 leading-none mb-1">Limit</p>
                    <p className="text-sm font-bold leading-none truncate max-w-[100px]" title={String(hard)}>{format(hardNum)}</p>
                </div>
            </div>
            
            <div className="space-y-1.5">
                <div className="h-2.5 bg-muted rounded-full overflow-hidden border p-0.5">
                    <div 
                        className={cn("h-full rounded-full transition-all duration-1000", 
                            percent > 90 ? "bg-destructive" : percent > 75 ? "bg-amber-500" : color.replace("text-", "bg-")
                        )}
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <div className="flex justify-between items-center px-0.5">
                    <span className="text-[9px] font-bold opacity-50">{percent.toFixed(0)}% consumed</span>
                    <span className={cn("text-[9px] font-bold", remaining === 0 ? "text-destructive" : "text-emerald-500")}>
                        {remaining > 0 ? `${format(remaining)} available` : "Quota reached"}
                    </span>
                </div>
            </div>
        </div>
    )
}

export function ResourceUsage({ data: initialData, username }: { data?: QuotaData, username?: string }) {
    const [data, setData] = useState<QuotaData | null>(initialData || null)
    const [loading, setLoading] = useState(!initialData)

    const fetchQuotas = useCallback(async () => {
        try {
            const url = username ? `/api/admin/users/${username}/quotas` : "/api/user/quotas"
            const res = await fetch(url, { cache: 'no-store' })
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        } catch (e) {
            console.error("Failed to fetch quotas:", e)
        } finally {
            setLoading(false)
        }
    }, [username])

    useEffect(() => {
        fetchQuotas()
        const interval = setInterval(fetchQuotas, 15000)
        return () => clearInterval(interval)
    }, [fetchQuotas])

    if (loading && !data) return (
        <div className="flex items-center gap-3 p-4 border-2 border-dashed rounded-2xl bg-muted/5 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest opacity-50">Syncing Quota...</span>
        </div>
    )

    if (!data) return null

    return (
        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-md overflow-hidden">
            <CardHeader className="py-4 border-b bg-muted/10">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        Resource Quota
                    </CardTitle>
                    <Badge variant="outline" className="text-[9px] h-4 font-bold border-primary/20 bg-primary/5 text-primary">Live</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
                <UsageDetail 
                    label="CPU Compute" 
                    used={data.used["requests.cpu"] || data.used["cpu"]} 
                    hard={data.hard["requests.cpu"] || data.hard["cpu"]} 
                    unit="m" 
                    icon={Cpu} 
                    color="text-blue-500" 
                    isCpu={true}
                    type="cpu"
                />
                <UsageDetail 
                    label="RAM Memory" 
                    used={data.used["requests.memory"] || data.used["memory"]} 
                    hard={data.hard["requests.memory"] || data.hard["memory"]} 
                    unit="" 
                    icon={MemoryStick} 
                    color="text-purple-500" 
                    type="mem"
                />
                <UsageDetail 
                    label="Active Pods" 
                    used={data.used["pods"]} 
                    hard={data.hard["pods"]} 
                    unit="" 
                    icon={Box} 
                    color="text-emerald-500" 
                    type="raw"
                />
                <UsageDetail 
                    label="Disk Storage" 
                    used={data.used["requests.storage"] || data.used["storage"]} 
                    hard={data.hard["requests.storage"] || data.hard["storage"]} 
                    unit="" 
                    icon={Database} 
                    color="text-amber-500" 
                    type="mem"
                />
            </CardContent>
        </Card>
    )
}
