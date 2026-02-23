"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, LayoutGrid, Server, Database, ShieldCheck, Activity, Github, ArrowRight, Blocks } from "lucide-react"
import { GitshipAppCard } from "@/components/gitship-app-card"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { GitshipAppList, GitshipUser, GitshipIntegration } from "@/lib/types"

interface AdminDashboardProps {
    users: GitshipUser[]
    apps: GitshipAppList
    integrations: GitshipIntegration[]
    nodes: any[]
    storageClasses: any[]
}

export function AdminDashboardUI({ users, apps, integrations, nodes, storageClasses }: AdminDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const activeTab = searchParams.get("tab") || "apps"

    const onTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("tab", value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <main className="flex-1 container max-w-screen-2xl mx-auto px-4 md:px-8 py-10 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight">Admin Control</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" /> 
                        Cluster-wide resource management
                    </p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Running Apps</CardTitle>
                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{apps.items.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Integrations</CardTitle>
                        <Blocks className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{integrations.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nodes Online</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{nodes.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Storage Classes</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{storageClasses.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="apps" className="gap-2">
                        <LayoutGrid className="w-4 h-4" /> All Applications
                    </TabsTrigger>
                    <TabsTrigger value="users" className="gap-2">
                        <Users className="w-4 h-4" /> Gitship Users
                    </TabsTrigger>
                    <TabsTrigger value="infra" className="gap-2">
                        <Activity className="w-4 h-4" /> Infrastructure
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="apps" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {apps.items.map(app => (
                            <GitshipAppCard key={app.metadata.uid} app={app} />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="users">
                    <Card>
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>All developers registered on this Gitship instance.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full overflow-auto">
                                <table className="w-full caption-bottom text-sm">
                                    <thead>
                                        <tr className="border-b transition-colors hover:bg-muted/50">
                                            <th className="h-12 px-4 text-left align-middle font-medium">User</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium">Role</th>
                                            <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground opacity-50 italic">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.metadata.uid} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{u.metadata.name}</span>
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Github className="w-2.5 h-2.5" /> @{u.spec.githubUsername}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <Badge 
                                                        variant={u.spec.role === "admin" ? "default" : "secondary"}
                                                        className={u.spec.role === "admin" ? "bg-primary/90" : ""}
                                                    >
                                                        {u.spec.role}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    {u.status?.ready ? (
                                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] uppercase font-bold">Active</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold">Pending</Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 hover:text-primary">
                                                        <Link href={`/admin/users/${u.metadata.name}`}>
                                                            Manage <ArrowRight className="w-3.5 h-3.5" />
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="infra" className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                Storage Classes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {storageClasses.map((sc: any) => (
                                <div key={sc.metadata.name} className="flex items-center justify-between p-3 rounded border bg-muted/10">
                                    <div className="font-mono font-bold">{sc.metadata.name}</div>
                                    <Badge variant="outline">{sc.provisioner.split('/').pop()}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5 text-primary" />
                                Cluster Nodes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {nodes.map((node: any) => (
                                <div key={node.metadata.name} className="flex items-center justify-between p-3 rounded border bg-muted/10">
                                    <div>
                                        <div className="font-mono font-bold">{node.metadata.name}</div>
                                        <div className="text-[10px] text-muted-foreground">{node.status.nodeInfo.kubeletVersion}</div>
                                    </div>
                                    <Badge className="bg-emerald-500/10 text-emerald-500">{node.status.conditions.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
    )
}
