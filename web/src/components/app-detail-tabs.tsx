"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitshipApp } from "@/lib/types"
import { Github, Server, RotateCcw, Clock, Globe, GitBranch, Tag, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppLogs } from "@/components/app-logs"
import { AppServices } from "@/components/app-services"
import { AppStats } from "@/components/app-stats"
import { AppConfiguration } from "@/components/app-configuration"
import { AppTlsLogs } from "@/components/app-tls-logs"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTransition } from "react"
import { Button } from "@/components/ui/button"

function timeAgo(dateStr?: string): string {
    if (!dateStr) return "n/a"
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

export function AppDetailTabs({ app }: { app: GitshipApp }) {
    const ready = app.status?.readyReplicas ?? 0
    const desired = app.status?.desiredReplicas ?? 0
    
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const activeTab = searchParams.get("tab") || "overview"
    const [isPending, startTransition] = useTransition()

    const onTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("tab", value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleRebuild = () => {
        startTransition(async () => {
            try {
                await fetch(`/api/apps/${app.metadata.namespace}/${app.metadata.name}/rebuild`, {
                    method: "POST",
                })
                router.refresh()
            } catch (e) {
                console.error("Failed to trigger rebuild:", e)
            }
        })
    }

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="tls">TLS Logs</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main info */}
                    <Card className="md:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
                            <CardTitle>Overview</CardTitle>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleRebuild} 
                                disabled={isPending}
                                className="h-8 gap-2 font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                            >
                                <RotateCcw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
                                {isPending ? "Syncing..." : "Rebuild & Resync"}
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Repository</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Github className="w-4 h-4" />
                                        <a href={app.spec.repoUrl} target="_blank" className="hover:underline text-sm">
                                            {app.spec.repoUrl}
                                        </a>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Latest Build</label>
                                    <div className="mt-1 font-mono bg-muted px-2 py-1 rounded w-fit text-sm">
                                        {app.status?.latestBuildId?.substring(0, 12) || "No builds yet"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Image</label>
                                    <div className="mt-1 text-sm font-mono">{app.spec?.imageName || "n/a"}</div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Ports</label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {app.spec?.ports?.length ? app.spec.ports.map((p, i) => (
                                            <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                                                {p.port}→{p.targetPort}
                                            </Badge>
                                        )) : <span className="text-sm">n/a</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Source</label>
                                    <div className="mt-1 text-sm flex items-center gap-1.5">
                                        {app.spec?.source?.type === "branch" && <GitBranch className="w-3.5 h-3.5" />}
                                        {app.spec?.source?.type === "tag" && <Tag className="w-3.5 h-3.5" />}
                                        {app.spec?.source?.type === "commit" && <Hash className="w-3.5 h-3.5" />}
                                        <span className="font-medium">{app.spec?.source?.value || "main"}</span>
                                        <Badge variant="outline" className="text-[10px] h-4 px-1 lowercase opacity-70">
                                            {app.spec?.source?.type || "branch"}
                                        </Badge>
                                    </div>
                                </div>
                                {app.spec?.ingresses?.length ? (
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-muted-foreground">Domains (Ingress)</label>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {app.spec.ingresses.map((ing, i) => (
                                                <a key={i} href={`https://${ing.host}`} target="_blank" className="text-xs text-blue-500 hover:underline bg-blue-500/5 px-2 py-1 rounded border border-blue-500/20 font-mono">
                                                    {ing.host}{ing.path !== "/" ? ing.path : ""}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status sidebar */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Server className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                    <strong>{ready}</strong>/{desired} pods ready
                                </span>
                            </div>

                            {(app.status?.restartCount ?? 0) > 0 && (
                                <div className="flex items-center gap-2">
                                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm">{app.status?.restartCount} restarts</span>
                                </div>
                            )}

                            {app.status?.serviceType && (
                                <div className="flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <Badge variant="outline">{app.status.serviceType}</Badge>
                                </div>
                            )}

                            {app.status?.lastDeployedAt && (
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm" title={app.status.lastDeployedAt}>
                                        Deployed {timeAgo(app.status.lastDeployedAt)}
                                    </span>
                                </div>
                            )}

                            {/* Deployment Config JSON */}
                            <div className="pt-2 border-t">
                                <label className="text-xs font-medium text-muted-foreground">Spec (raw)</label>
                                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-48">
                                    {JSON.stringify(app.spec || {}, null, 2)}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-6">
                <AppLogs 
                    appName={app.metadata.name} 
                    namespace={app.metadata.namespace} 
                    history={app.status?.buildHistory}
                />
            </TabsContent>

            {/* Services & Ingress Tab */}
            <TabsContent value="services" className="mt-6">
                <AppServices
                    appName={app.metadata.name}
                    namespace={app.metadata.namespace}
                    serviceType={app.status?.serviceType}
                    initialIngresses={app.spec?.ingresses}
                    initialPorts={app.spec?.ports}
                    tls={app.spec?.tls}
                />
            </TabsContent>

            {/* TLS Tab */}
            <TabsContent value="tls" className="mt-6">
                <AppTlsLogs
                    appName={app.metadata.name}
                    namespace={app.metadata.namespace}
                />
            </TabsContent>

            {/* Configuration Tab (Merged Env, Secrets, Volumes) */}
            <TabsContent value="config" className="mt-6">
                <AppConfiguration
                    appName={app.metadata.name}
                    namespace={app.metadata.namespace}
                    spec={app.spec}
                />
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats" className="mt-6">
                <AppStats 
                    appName={app.metadata.name} 
                    namespace={app.metadata.namespace} 
                    limits={app.spec.resources}
                />
            </TabsContent>
        </Tabs>
    )
}
