"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldAlert, ShieldCheck, RefreshCw, Clock, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface TlsEvent {
    lastTimestamp: string
    type: string
    reason: string
    message: string
    kind: string
    name: string
}

export function AppTlsLogs({ appName, namespace }: { appName: string, namespace: string }) {
    const [events, setEvents] = useState<TlsEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/apps/${namespace}/${appName}/tls-events`)
            if (res.ok) {
                const data = await res.json()
                setEvents(data)
                setError(null)
            } else {
                setError("Failed to fetch TLS logs")
            }
        } catch (err) {
            setError("Failed to connect to API")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents()
        const interval = setInterval(fetchEvents, 30000)
        return () => clearInterval(interval)
    }, [appName, namespace])

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            TLS Certificates Logs
                        </CardTitle>
                        <CardDescription>
                            Real-time events from Cert-Manager for CertificateRequests, Orders and Challenges.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/20 text-destructive text-sm font-medium mb-4">
                            {error}
                        </div>
                    )}

                    {!loading && events.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed rounded-xl">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                                <Info className="w-10 h-10" />
                                <p className="text-sm font-medium">No TLS events found for this app.</p>
                                <p className="text-xs">Cert-Manager logs appear here once you enable HTTPS.</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {events.map((event, i) => (
                            <div key={i} className={cn(
                                "p-3 rounded-lg border-2 flex gap-4 items-start transition-all animate-in fade-in slide-in-from-top-1",
                                event.type === "Warning" ? "bg-amber-500/5 border-amber-500/10" : "bg-muted/5 border-muted"
                            )}>
                                <div className="shrink-0 mt-1">
                                    {event.type === "Warning" ? (
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                    ) : (
                                        <Info className="w-4 h-4 text-blue-500" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs uppercase opacity-70 tracking-wider">{event.reason}</span>
                                            <Badge variant="outline" className="text-[10px] h-4 py-0 font-mono">{event.kind}: {event.name}</Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {new Date(event.lastTimestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-snug">{event.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
