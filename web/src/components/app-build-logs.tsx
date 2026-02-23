"use client"

import { useCallback, useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Terminal, Loader2, RefreshCcw, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface AppBuildLogsProps {
    appName: string
    namespace: string
    buildHistory?: { commitId: string; status: string; completionTime?: string; message?: string }[]
}

interface BuildStatus {
    succeeded?: number
    failed?: number
    active?: number
}

export function AppBuildLogs({ appName, namespace, buildHistory }: AppBuildLogsProps) {
    const [logs, setLogs] = useState<string>("Loading build logs...")
    const [loading, setLoading] = useState(true)
    const [jobName, setJobName] = useState<string | null>(null)
    const [status, setStatus] = useState<BuildStatus | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(`/api/apps/${namespace}/${appName}/build-logs`)
            const data = await res.json()
            if (data.error) {
                setLogs(`Error: ${data.error}`)
            } else {
                setLogs(data.logs || "No logs available.")
                setJobName(data.jobName)
                setStatus(data.status)
            }
        } catch (e: unknown) {
            // @ts-expect-error dynamic access
            setLogs(`Failed to fetch logs: ${e.message}`)
        } finally {
            setLoading(false)
        }
    }, [appName, namespace])

    useEffect(() => {
        fetchLogs()
        const interval = setInterval(() => {
            // Only auto-refresh if job is active
            if (status && !status.succeeded && !status.failed) {
                fetchLogs()
            }
        }, 3000)
        return () => clearInterval(interval)
    }, [fetchLogs, status])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    const isSuccess = (status?.succeeded ?? 0) > 0
    const isFailed = (status?.failed ?? 0) > 0
    const isActive = status && !isSuccess && !isFailed

    const handleRollback = async (commitId: string) => {
        if (!confirm(`Are you sure you want to rollback to commit ${commitId.substring(0, 7)}?`)) return
        try {
            const res = await fetch(`/api/apps/${namespace}/${appName}/rollback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commitId }),
            })
            if (res.ok) {
                alert("Rollback initiated!")
            } else {
                alert("Failed to initiate rollback.")
            }
        } catch (e: unknown) {
            // @ts-expect-error dynamic access
            alert(`Error: ${e.message}`)
        }
    }

    return (
        <Card className="border-border/60 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4">
                <div className="space-y-1">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-primary" />
                        Build Logs
                        {jobName && <span className="text-xs font-mono font-normal opacity-50 ml-2">({jobName})</span>}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {isActive && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-bold uppercase animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> Building...
                            </div>
                        )}
                        {isSuccess && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase">
                                <CheckCircle2 className="w-3 h-3" /> Succeeded
                            </div>
                        )}
                        {isFailed && (
                            <div className="flex items-center gap-1.5 text-[10px] text-destructive font-bold uppercase">
                                <XCircle className="w-3 h-3" /> Failed
                            </div>
                        )}
                    </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setLoading(true); fetchLogs(); }}>
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div 
                    ref={scrollRef}
                    className="h-[500px] overflow-auto bg-black/95 p-4 font-mono text-xs leading-relaxed text-zinc-300"
                >
                    <pre className="whitespace-pre-wrap break-all">{logs}</pre>
                </div>
            </CardContent>

            {buildHistory && buildHistory.length > 0 && (
                <div className="border-t border-border/40 p-4 bg-muted/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-3 ml-1">Previous Builds</h4>
                    <div className="space-y-2">
                        {buildHistory.map((record, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg border bg-background/50 hover:bg-background transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center border",
                                        record.status === "Succeeded" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600"
                                    )}>
                                        {record.status === "Succeeded" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-bold font-mono">{record.commitId.substring(0, 7)}</span>
                                        <span className="text-[9px] opacity-50">{record.status}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {record.completionTime && (
                                        <div className="flex items-center gap-1.5 text-[10px] opacity-40 group-hover:opacity-70 transition-opacity">
                                            <Clock className="w-3 h-3" />
                                            {new Date(record.completionTime).toLocaleString()}
                                        </div>
                                    )}
                                    <Badge variant="outline" className="text-[9px] h-4 font-mono opacity-50">
                                        {record.commitId.substring(0, 7)}
                                    </Badge>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-7 text-[10px] gap-1 font-bold hover:bg-amber-500 hover:text-white transition-all"
                                        onClick={() => handleRollback(record.commitId)}
                                    >
                                        <RotateCcw className="w-3 h-3" /> Rollback
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    )
}
