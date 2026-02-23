"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutGrid, Activity, Blocks, Plus, PackageOpen } from "lucide-react"
import { AppGrid } from "@/components/app-grid"
import { UserMonitoring } from "@/components/user-monitoring"
import { UserIntegrations } from "@/components/user-integrations"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { GitshipApp } from "@/lib/types"
import { Suspense } from "react"

interface DashboardTabsProps {
    apps: GitshipApp[]
    hasApps: boolean
}

function DashboardTabsContent({ apps, hasApps }: DashboardTabsProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    
    const activeTab = searchParams.get("tab") || "apps"

    const onTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-8">
            <div className="flex items-center justify-between border-b pb-1">
                <TabsList className="bg-transparent h-auto p-0 gap-6">
                    <TabsTrigger 
                        value="apps" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 gap-2 font-bold text-lg"
                    >
                        <LayoutGrid className="w-5 h-5" />
                        Applications
                    </TabsTrigger>
                    <TabsTrigger 
                        value="monitoring" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 gap-2 font-bold text-lg"
                    >
                        <Activity className="w-5 h-5" />
                        Live Stats
                    </TabsTrigger>
                    <TabsTrigger 
                        value="integrations" 
                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 gap-2 font-bold text-lg"
                    >
                        <Blocks className="w-5 h-5" />
                        Integrations
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="apps" className="space-y-8 mt-0 border-none p-0 outline-none">
                {!hasApps ? (
                    <div className="flex h-[450px] shrink-0 items-center justify-center rounded-2xl border-4 border-dashed border-muted bg-muted/5">
                        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-muted/50 mb-6 ring-8 ring-muted/20 rotate-3">
                                <PackageOpen className="h-12 w-12 text-muted-foreground" />
                            </div>
                            <h3 className="text-2xl font-bold">No applications found</h3>
                            <p className="mb-6 mt-2 text-muted-foreground text-pretty">
                                Connect your first Git repository to start deploying to the cluster.
                            </p>
                            <Button asChild size="lg" className="rounded-xl">
                                <Link href="/new">
                                    <Plus className="mr-2 h-5 w-5" /> Deploy your first app
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                        <AppGrid apps={apps} />
                    </div>
                )}
            </TabsContent>

            <TabsContent value="monitoring" className="mt-0 border-none p-0 outline-none">
                <UserMonitoring />
            </TabsContent>

            <TabsContent value="integrations" className="mt-0 border-none p-0 outline-none">
                <UserIntegrations />
            </TabsContent>
        </Tabs>
    )
}

export function DashboardTabs(props: DashboardTabsProps) {
    return (
        <Suspense fallback={<div className="h-20 animate-pulse bg-muted rounded-xl" />}>
            <DashboardTabsContent {...props} />
        </Suspense>
    )
}
