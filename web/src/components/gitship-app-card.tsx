import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitshipApp } from "@/lib/types"
import { GitBranch, Github, Activity, ArrowRight, AlertCircle, Loader2, Tag, Hash } from "lucide-react"
import Link from "next/link"

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

function StatusIndicator({ app }: { app: GitshipApp }) {
  const ready = app.status?.readyReplicas ?? 0
  const desired = app.status?.desiredReplicas ?? 0
  const phase = app.status?.phase ?? "Unknown"

  if (phase === "Building" || phase === "Deploying") {
    return (
      <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full text-xs font-medium border border-amber-500/20">
        <Loader2 className="w-3 h-3 animate-spin" />
        {phase}
      </div>
    )
  }

  if (phase === "Failed" || (desired > 0 && ready === 0)) {
    return (
        <div className="flex items-center gap-1.5 text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full text-xs font-medium border border-red-500/20">
        <AlertCircle className="w-3 h-3" />
        Failed
      </div>
    )
  }

  if (phase === "Running" && ready > 0) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-500/20">
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        Running
      </div>
    )
  }

  return (
    <Badge variant="secondary" className="text-xs font-normal">
      {phase}
    </Badge>
  )
}

export function GitshipAppCard({ app }: { app: GitshipApp }) {
  const repoName = app.spec.repoUrl.split("/").pop()?.replace(".git", "") || app.spec.repoUrl
  const source = app.spec.source
  const commit = app.status?.latestBuildId?.substring(0, 7)
  
  // Security/UX: Filter out internal K8s URLs
  const rawUrl = app.status?.appUrl || ""
  const isInternal = rawUrl.includes(".svc.cluster.local") || rawUrl.includes("http://gitship-")
  const appUrl = (rawUrl && !isInternal) ? rawUrl : null

  return (
    <Card className="w-full relative group hover:shadow-md transition-all duration-300 border-border/60 bg-card/50 hover:bg-card flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
                <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight tracking-tight group-hover:text-primary transition-colors truncate max-w-[140px] md:max-w-[180px]" title={app.metadata.name}>
                  {app.metadata.name}
              </h3>
              <div className="text-sm text-muted-foreground mt-1 truncate max-w-[140px] md:max-w-[180px]">
                {appUrl ? (
                    <span className="flex items-center gap-1" title={appUrl.replace(/^https?:\/\//, '')}>
                        {appUrl.replace(/^https?:\/\//, '')}
                    </span>
                ) : (
                    <Badge variant="outline" className="text-[9px] uppercase font-bold opacity-50">Internal Only</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <StatusIndicator app={app} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-4 flex-1">
        <div className="flex flex-col gap-2.5 text-sm text-muted-foreground/80">
            <div className="flex items-center gap-2 overflow-hidden">
                <Github className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-foreground truncate" title={repoName}>{repoName}</span>
                <span className="text-muted-foreground/50 flex-shrink-0">•</span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {source.type === "branch" && <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />}
                  {source.type === "tag" && <Tag className="w-3.5 h-3.5 flex-shrink-0" />}
                  {source.type === "commit" && <Hash className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate" title={source.value}>{source.value}</span>
                </div>
            </div>
            
            {commit && (
                <div className="flex items-center gap-2 font-mono text-[11px] pl-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                    <span className="flex-shrink-0">{commit}</span>
                    <span className="text-muted-foreground/50 flex-shrink-0">•</span>
                    <span className="truncate">{timeAgo(app.status?.lastDeployedAt || app.metadata.creationTimestamp)}</span>
                </div>
            )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/40 bg-muted/20 flex justify-between items-center text-xs">
        <div className="text-muted-foreground">
            {app.status?.readyReplicas ?? 0}/{app.status?.desiredReplicas ?? 0} instances
        </div>
        <div className="flex items-center text-primary font-medium group-hover:translate-x-1 transition-transform duration-300">
            Manage <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </div>
      </CardFooter>
      
      {/* Absolute Link covering the card - No nested <a> tags! */}
      <Link 
        href={`/app/${app.metadata.namespace}/${app.metadata.name}`} 
        className="absolute inset-0 z-10"
        aria-label={`Manage ${app.metadata.name}`}
      />
    </Card>
  )
}
