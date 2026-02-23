"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
    Github, 
    ArrowLeft, 
    Shield, 
    Cpu, 
    Database, 
    Layout, 
    Loader2, 
    Settings2, 
    Activity,
    ExternalLink,
    Save,
    Blocks
} from "lucide-react"
import Link from "next/link"
import { GitshipUser, GitshipApp, GitshipIntegration } from "@/lib/types"
import { ResourceUsage } from "@/components/resource-usage"

interface UserAdminDetailProps {
    user: GitshipUser
    apps: GitshipApp[]
    integrations: GitshipIntegration[]
    quotas: { hard: Record<string, string>; used: Record<string, string> } | null
}

export function UserAdminDetailUI({ user, apps, integrations, quotas }: UserAdminDetailProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Management State
    const [role, setRole] = useState(user.spec.role)
    const [cpu, setCpu] = useState(user.spec.quotas?.cpu || "4")
    const [memory, setMemory] = useState(user.spec.quotas?.memory || "8Gi")
    const [pods, setPods] = useState(user.spec.quotas?.pods || "20")
    const [storage, setStorage] = useState(user.spec.quotas?.storage || "10Gi")

    const handleSave = async () => {
        setLoading(true)
        try {
            await fetch(`/api/admin/users/${user.metadata.name}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            })

            await fetch(`/api/admin/users/${user.metadata.name}/quotas`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quotas: { cpu, memory, pods, storage } }),
            })

            router.refresh()
        } catch (e: unknown) {
            // @ts-expect-error dynamic access
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container max-w-screen-2xl mx-auto px-4 md:px-8 py-10 space-y-8">
            {/* Back Button */}
            <Button asChild variant="ghost" className="mb-2 -ml-2 text-muted-foreground">
                <Link href="/admin?tab=users">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to User List
                </Link>
            </Button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-extrabold tracking-tight">{user.metadata.name}</h1>
                        <Badge variant={role === "admin" ? "default" : "secondary"} className="uppercase font-black text-[10px]">
                            {role}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1 text-sm font-mono">
                            <Github className="w-4 h-4" /> @{user.spec.githubUsername}
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                            <Activity className="w-4 h-4" /> 
                            {user.status?.namespaces?.length || 1} Namespaces
                        </span>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <Button onClick={handleSave} disabled={loading} className="px-8 shadow-lg shadow-primary/20">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Management & Usage */}
                <div className="lg:col-span-1 space-y-8">
                    {/* Resource Usage (Detailed) */}
                    <Card className="border-primary/10 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider opacity-70">Live Consumption</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResourceUsage data={quotas || undefined} username={user.metadata.name} />
                        </CardContent>
                    </Card>

                    {/* Roles Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider opacity-70">User Role</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-2">
                            {["admin", "user", "restricted"].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={`
                                        p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between
                                        ${role === r 
                                            ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                                            : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"}
                                    `}
                                >
                                    <div className="text-xs uppercase font-black">{r}</div>
                                    {role === r && <Shield className="w-4 h-4" />}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Quotas Card */}
                    <Card className="overflow-hidden border-2">
                        <CardHeader className="bg-muted/50 border-b">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-primary" /> 
                                Quota Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {/* Presets */}
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase font-black opacity-50 tracking-widest">Quick Presets</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: "Starter", cpu: "1", mem: "2Gi", pods: "10", storage: "5Gi" },
                                        { label: "Dev", cpu: "4", mem: "8Gi", pods: "20", storage: "20Gi" },
                                        { label: "Power", cpu: "16", mem: "32Gi", pods: "50", storage: "100Gi" },
                                    ].map((p) => (
                                        <Button 
                                            key={p.label} 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-8 text-[10px] font-bold uppercase tracking-tighter hover:bg-primary hover:text-primary-foreground transition-all"
                                            onClick={() => {
                                                setCpu(p.cpu)
                                                setMemory(p.mem)
                                                setPods(p.pods)
                                                setStorage(p.storage)
                                            }}
                                        >
                                            {p.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] uppercase font-black opacity-70 flex items-center gap-1.5">
                                            <Cpu className="w-3.5 h-3.5" /> CPU Cores
                                        </Label>
                                        <span className="text-[10px] font-mono opacity-40">e.g. 0.5, 4, 16</span>
                                    </div>
                                    <Input value={cpu} onChange={e => setCpu(e.target.value)} className="font-mono h-10 border-2 focus-visible:ring-primary/20" />
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] uppercase font-black opacity-70 flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5" /> RAM Memory
                                        </Label>
                                        <span className="text-[10px] font-mono opacity-40">e.g. 512Mi, 8Gi</span>
                                    </div>
                                    <Input value={memory} onChange={e => setMemory(e.target.value)} className="font-mono h-10 border-2 focus-visible:ring-primary/20" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] uppercase font-black opacity-70 flex items-center gap-1.5">
                                            <Layout className="w-3.5 h-3.5" /> Max Pods
                                        </Label>
                                        <span className="text-[10px] font-mono opacity-40">Total instances</span>
                                    </div>
                                    <Input value={pods} onChange={e => setPods(e.target.value)} className="font-mono h-10 border-2 focus-visible:ring-primary/20" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label className="text-[10px] uppercase font-black opacity-70 flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5" /> Disk Storage
                                        </Label>
                                        <span className="text-[10px] font-mono opacity-40">e.g. 5Gi, 20Gi</span>
                                    </div>
                                    <Input value={storage} onChange={e => setStorage(e.target.value)} className="font-mono h-10 border-2 focus-visible:ring-primary/20" />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button onClick={handleSave} disabled={loading} className="w-full shadow-lg shadow-primary/10">
                                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Apply Quota Limits
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Applications */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Layout className="w-6 h-6 text-primary" />
                            User Applications ({apps.length})
                        </h2>
                    </div>

                    <div className="grid gap-4">
                        {apps.length === 0 ? (
                            <div className="p-12 border-2 border-dashed rounded-2xl text-center text-muted-foreground">
                                No applications deployed by this user yet.
                            </div>
                        ) : (
                            apps.map(app => (
                                <Card key={app.metadata.uid} className="overflow-hidden group hover:border-primary/50 transition-colors">
                                    <div className="flex items-center p-6 gap-6">
                                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                            <Activity className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg truncate">{app.metadata.name}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase">{app.status?.phase}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{app.spec.repoUrl}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <div className="hidden md:block">
                                                <div className="text-xs font-bold uppercase opacity-50">Pods</div>
                                                <div className="font-mono text-sm">{app.status?.readyReplicas || 0}/{app.status?.desiredReplicas || 0}</div>
                                            </div>
                                            <Button asChild size="icon" variant="ghost">
                                                <Link href={`/app/${app.metadata.namespace}/${app.metadata.name}`}>
                                                    <ExternalLink className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Blocks className="w-6 h-6 text-primary" />
                            User Integrations ({integrations.length})
                        </h2>
                    </div>

                    <div className="grid gap-4">
                        {integrations.length === 0 ? (
                            <div className="p-12 border-2 border-dashed rounded-2xl text-center text-muted-foreground">
                                No active integrations for this user.
                            </div>
                        ) : (
                            integrations.map(int => (
                                <Card key={int.metadata.uid} className="overflow-hidden hover:border-primary/50 transition-colors">
                                    <div className="flex items-center p-6 gap-6">
                                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                            <Blocks className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg truncate">{int.metadata.name}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase">{int.spec.type}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">{int.status?.message || "Active"}</p>
                                        </div>
                                        <Badge variant={int.status?.phase === "Ready" ? "default" : "secondary"}>
                                            {int.status?.phase || "Unknown"}
                                        </Badge>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
