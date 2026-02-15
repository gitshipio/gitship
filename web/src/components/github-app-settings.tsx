"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Github, ExternalLink, ShieldCheck, ShieldAlert, Lock, Globe, ChevronDown, ChevronUp, Plus } from "lucide-react"
import { GitHubRepo } from "@/lib/github"

interface GitHubInstallation {
    id: number
    account: string
    account_avatar: string
    repository_selection: string
    repositories: GitHubRepo[]
    html_url: string
}

interface GitHubAppSettingsProps {
    installations: GitHubInstallation[] | null
}

export function GitHubAppSettings({ installations }: GitHubAppSettingsProps) {
    const [expandedInst, setExpandedInst] = useState<number | null>(null)
    const githubAppName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    if (!installations || installations.length === 0) {
        return (
            <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        GitHub App not installed
                    </CardTitle>
                    <CardDescription>
                        Gitship needs to be installed on your account or organization to access repositories.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="bg-amber-600 hover:bg-amber-700">
                        <a href={`https://github.com/apps/${githubAppName}/installations/new`} target="_blank">
                            Install GitHub App
                        </a>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {installations.map((inst) => {
                const isExpanded = expandedInst === inst.id
                const displayedRepos = isExpanded ? inst.repositories : inst.repositories.slice(0, 5)
                const hasMore = inst.repositories.length > 5

                return (
                    <Card key={inst.id} className="overflow-hidden border-border/60">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/5">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full overflow-hidden border">
                                    <img src={inst.account_avatar} alt={inst.account} className="h-full w-full object-cover" />
                                </div>
                                <div className="space-y-0.5">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        {inst.account}
                                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight py-0">
                                            {inst.repository_selection}
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        ID: {inst.id}
                                    </CardDescription>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                                <a href={inst.html_url} target="_blank">
                                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Manage
                                </a>
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-2">
                                {inst.repositories.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No repositories shared with Gitship.</p>
                                ) : (
                                    <>
                                        <div className="grid gap-1.5">
                                            {displayedRepos.map(repo => (
                                                <div key={repo.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs border border-transparent hover:border-border transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        {repo.private ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                                                        <span className="font-mono">{repo.full_name}</span>
                                                    </div>
                                                    <a href={repo.html_url} target="_blank" className="text-muted-foreground hover:text-primary">
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {hasMore && (
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="w-full mt-2 h-8 text-[10px] text-muted-foreground hover:text-foreground"
                                                onClick={() => setExpandedInst(isExpanded ? null : inst.id)}
                                            >
                                                {isExpanded ? (
                                                    <><ChevronUp className="w-3 h-3 mr-1.5" /> Show less</>
                                                ) : (
                                                    <><ChevronDown className="w-3 h-3 mr-1.5" /> Show all {inst.repositories.length} repos</>
                                                )}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}

            <div className="pt-2">
                <Button variant="outline" asChild className="w-full border-dashed">
                    <a href={`https://github.com/apps/${githubAppName}/installations/new`} target="_blank">
                        <Plus className="w-4 h-4 mr-2" /> Add Gitship to another organization
                    </a>
                </Button>
            </div>
        </div>
    )
}
