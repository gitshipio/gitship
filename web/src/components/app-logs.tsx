"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Download, Search, Pause, Play, Server, RefreshCcw, Terminal, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppBuildLogs } from "./app-build-logs"

interface PodInfo {
    name: string
    phase: string
    ready: boolean
    restarts: number
}

interface AppLogsProps {
    appName: string
    namespace: string
    history?: { commitId: string; status: string; completionTime?: string; message?: string }[]
}

export function AppLogs({ appName, namespace, history }: AppLogsProps) {
    const [logType, setLogType] = useState<"runtime" | "build">("runtime")
    const [logs, setLogs] = useState<string[]>([])
    const [pods, setPods] = useState<PodInfo[]>([])
    const [selectedPod, setSelectedPod] = useState<string | null>(null)
    const [isFollowing, setIsFollowing] = useState(true)
    const [filter, setFilter] = useState("")
    const [tailLines] = useState(200)
    const scrollRef = useRef<HTMLDivElement>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchLogs = useCallback(async () => {
        if (logType !== "runtime") return
        try {
            const podQuery = selectedPod ? `&podName=${selectedPod}` : ""
            const res = await fetch(
                `/api/logs?name=${appName}&namespace=${namespace}&tailLines=${tailLines}${podQuery}`
            )
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs || [])
                setPods(data.pods || [])
                
                // Auto-select first pod if none selected
                if (!selectedPod && data.pod) {
                    setSelectedPod(data.pod)
                }
            }
        } catch {
            // Silently fail
        }
    }, [appName, namespace, tailLines, selectedPod, logType])

    useEffect(() => {
        fetchLogs()
        if (isFollowing && logType === "runtime") {
            intervalRef.current = setInterval(fetchLogs, 3000)
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [fetchLogs, isFollowing, logType])

    useEffect(() => {
        if (isFollowing && scrollRef.current && logType === "runtime") {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs, isFollowing, logType])

    const filteredLogs = filter
        ? logs.filter((line) => line.toLowerCase().includes(filter.toLowerCase()))
        : logs

    const downloadLogs = () => {
        const blob = new Blob([filteredLogs.join("\n")], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${selectedPod || appName}-logs.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    const getPhaseColor = (phase: string) => {
        switch (phase) {
            case "Running": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
            case "Pending": return "text-amber-500 bg-amber-500/10 border-amber-500/20"
            case "Failed": return "text-red-500 bg-red-500/10 border-red-500/20"
            default: return "text-muted-foreground bg-muted/10 border-muted/20"
        }
    }

    return (
        <div className="space-y-6">
            {/* Header / Switcher */}
            <div className="flex items-center gap-4 border-b pb-4">
                <button 
                    onClick={() => setLogType("runtime")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                        logType === "runtime" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Activity className="w-4 h-4" /> Runtime Logs
                </button>
                <button 
                    onClick={() => setLogType("build")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                        logType === "build" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
                    )}
                >
                    <Terminal className="w-4 h-4" /> Build Pipeline
                </button>
            </div>

            {logType === "build" ? (
                <AppBuildLogs appName={appName} namespace={namespace} buildHistory={history} />
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    {/* Pod Selector */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground ml-1">
                            <Server className="w-4 h-4" />
                            Active Replicas ({pods.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {pods.map((pod) => (
                                <button
                                    key={pod.name}
                                    onClick={() => setSelectedPod(pod.name)}
                                    className={cn(
                                        "flex flex-col items-start p-2 rounded-lg border-2 text-left transition-all min-w-[140px]",
                                        selectedPod === pod.name 
                                            ? "border-primary bg-primary/5 shadow-sm" 
                                            : "border-border/40 bg-muted/5 hover:border-border hover:bg-muted/10"
                                    )}
                                >
                                    <span className="text-xs font-bold truncate w-full">{pod.name.split('-').pop()}</span>
                                    <div className="flex items-center justify-between w-full mt-1">
                                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 border", getPhaseColor(pod.phase))}>
                                            {pod.phase}
                                        </Badge>
                                        {pod.restarts > 0 && (
                                            <span className="text-[9px] text-red-500 font-bold">
                                                {pod.restarts}R
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-xl border border-border/40">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search in logs..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-9 text-sm h-9 border-none bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                                size="sm"
                                variant="ghost"
                                className={cn("h-8 px-3 gap-2", isFollowing && "text-primary bg-primary/5")}
                                onClick={() => setIsFollowing(!isFollowing)}
                            >
                                {isFollowing ? <><Pause className="w-3.5 h-3.5" /> Following</> : <><Play className="w-3.5 h-3.5" /> Paused</>}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={fetchLogs}>
                                <RefreshCcw className="w-3.5 h-3.5" />
                            </Button>
                            <div className="w-px h-4 bg-border/60 mx-1" />
                            <Button size="sm" variant="ghost" className="h-8 px-3 gap-2" onClick={downloadLogs}>
                                <Download className="w-3.5 h-3.5" /> Export
                            </Button>
                        </div>
                    </div>

                    {/* Log output */}
                    <div
                        ref={scrollRef}
                        className="bg-zinc-950 text-zinc-50 p-6 rounded-2xl h-[600px] overflow-auto font-mono text-[13px] leading-6 select-text shadow-2xl border border-zinc-800 relative"
                    >
                        {filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin opacity-20" />
                                <p className="italic">
                                    {logs.length === 0
                                        ? "Waiting for container logs..."
                                        : "No logs match your filter."}
                                </p>
                            </div>
                        ) : (
                            <div className="grid">
                                {filteredLogs.map((line, i) => (
                                    <div key={i} className="hover:bg-zinc-900/50 px-2 rounded -mx-2 flex gap-4 group">
                                        <span className="text-zinc-700 select-none text-right w-8 shrink-0 group-hover:text-zinc-500 transition-colors">
                                            {i + 1}
                                        </span>
                                        <span className="break-all whitespace-pre-wrap">{line}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            Streaming {selectedPod} · {filteredLogs.length} lines
                        </p>
                        <div className="flex items-center gap-2">
                            <div className={cn("h-1.5 w-1.5 rounded-full", isFollowing ? "bg-emerald-500 animate-pulse" : "bg-zinc-500")} />
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                {isFollowing ? "Live" : "Paused"}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Loader2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    )
}
