"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, Cloud, Loader2, Settings2, AlertCircle, ShieldCheck } from "lucide-react"
import { GitshipIntegration } from "@/lib/types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function UserIntegrations() {
    const [integrations, setIntegrations] = useState<GitshipIntegration[]>([])
    const [loading, setLoading] = useState(true)
    const [installing, setInstalling] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [cfToken, setCfToken] = useState("")
    const [cmEmail, setCmEmail] = useState("")
    const [cmDnsToken, setCmDnsToken] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogOpenCm, setDialogOpenCm] = useState(false)
    const [editIntegration, setEditIntegration] = useState<GitshipIntegration | null>(null)
    const [editConfig, setEditConfig] = useState<Record<string, string>>({})
    const [error, setError] = useState<string | null>(null)

    const fetchIntegrations = async () => {
        try {
            const res = await fetch("/api/user/integrations")
            if (res.ok) {
                const data = await res.json()
                setIntegrations(data)
            }
        } catch {
            console.error("Failed to fetch integrations")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchIntegrations()
    }, [])

    const installCloudflare = async () => {
        setInstalling(true)
        setError(null)
        try {
            const res = await fetch("/api/user/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "cloudflare-tunnel",
                    name: "cloudflare-tunnel",
                    config: { token: cfToken }
                })
            })
            if (res.ok) {
                await fetchIntegrations()
                setCfToken("")
                setDialogOpen(false)
            } else {
                const data = await res.json()
                setError(data.error || "Failed to install integration")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setInstalling(false)
        }
    }

    const installCertManager = async () => {
        setInstalling(true)
        setError(null)
        try {
            const res = await fetch("/api/user/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "cert-manager",
                    name: "cert-manager",
                    config: { email: cmEmail, dnsToken: cmDnsToken },
                    resources: { 
                        cpu: "100m", 
                        memory: "128Mi" 
                    },
                    replicas: 1
                })
            })
            if (res.ok) {
                await fetchIntegrations()
                setCmEmail("")
                setCmDnsToken("")
                setDialogOpenCm(false)
            } else {
                const data = await res.json()
                setError(data.error || "Failed to install integration")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setInstalling(false)
        }
    }

    const updateIntegrationConfig = async () => {
        if (!editIntegration) return
        setInstalling(true)
        setError(null)
        try {
            const res = await fetch("/api/user/integrations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editIntegration.metadata.name,
                    patch: {
                        spec: {
                            config: editConfig
                        }
                    }
                })
            })
            if (res.ok) {
                await fetchIntegrations()
                setEditIntegration(null)
                setEditConfig({})
            } else {
                const data = await res.json()
                setError(data.error || "Failed to update integration")
            }
        } catch {
            setError("An unexpected error occurred")
        } finally {
            setInstalling(false)
        }
    }

    const deleteIntegration = async (name: string) => {
        setDeleting(name)
        try {
            const res = await fetch(`/api/user/integrations?name=${name}`, {
                method: "DELETE"
            })
            if (res.ok) {
                await fetchIntegrations()
            }
        } catch {
            console.error("Failed to delete integration")
        } finally {
            setDeleting(null)
        }
    }

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

    const availableIntegrations = [
        {
            type: "cloudflare-tunnel",
            name: "Cloudflare Tunnel",
            description: "Expose your apps to the internet without opening ports or managing Ingress.",
            icon: <Cloud className="w-10 h-10 text-sky-500" />,
            setup: (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setError(null)}>Configure & Install</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Install Cloudflare Tunnel</DialogTitle>
                            <DialogDescription>
                                Securely connect your Gitship apps to Cloudflare.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="token">Tunnel Token</Label>
                                <Input 
                                    id="token" 
                                    placeholder="Paste your Cloudflare Tunnel Token" 
                                    value={cfToken}
                                    onChange={(e) => setCfToken(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    You can find this in your Cloudflare Zero Trust dashboard under Networks &rarr; Tunnels.
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={installCloudflare} disabled={!cfToken || installing}>
                                {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Install Integration
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )
        },
        {
            type: "cert-manager",
            name: "Cert-Manager (HTTPS)",
            description: "Provision free Let's Encrypt SSL certificates automatically for your domains. Choose HTTP-01 (Email) or DNS-01 (Cloudflare API Token).",
            icon: <ShieldCheck className="w-10 h-10 text-emerald-500" />,
            setup: (
                <Dialog open={dialogOpenCm} onOpenChange={setDialogOpenCm}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setError(null)}>Configure & Install</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Enable HTTPS Certificates</DialogTitle>
                            <DialogDescription>
                                This will deploy a Let's Encrypt ClusterIssuer for your namespace.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="cmEmail">Email Address (Required)</Label>
                                <Input 
                                    id="cmEmail" 
                                    placeholder="admin@example.com" 
                                    value={cmEmail}
                                    onChange={(e) => setCmEmail(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Let's Encrypt requires a valid email for certificate expiration notices.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cmDnsToken">Cloudflare API Token (Optional, for DNS-01)</Label>
                                <Input 
                                    id="cmDnsToken" 
                                    placeholder="Paste your Cloudflare API Token (Edit zone DNS)" 
                                    value={cmDnsToken}
                                    onChange={(e) => setCmDnsToken(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    If left empty, HTTP-01 challenge will be used (requires public IP routing to port 80).
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={installCertManager} disabled={!cmEmail || installing}>
                                {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enable HTTPS
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )
        }
    ]

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Installed Integrations */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {integrations.map((int) => (
                    <Card key={int.metadata.uid} className="relative overflow-hidden group">
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <div className="p-2 rounded-xl bg-primary/10">
                                {int.spec.type === "cloudflare-tunnel" ? <Cloud className="w-6 h-6 text-primary" /> : <Settings2 className="w-6 h-6 text-primary" />}
                            </div>
                            <div className="space-y-0.5">
                                <CardTitle className="text-base">{int.metadata.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Badge 
                                        variant="outline" 
                                        className={cn(
                                            "text-[10px] uppercase font-bold px-1.5 h-4 border",
                                            int.status?.phase === "Ready" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
                                            int.status?.phase === "Pending" ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                                            int.status?.phase === "Disabled" ? "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" :
                                            "text-red-500 bg-red-500/10 border-red-500/20"
                                        )}
                                    >
                                        {int.status?.phase || "Pending"}
                                    </Badge>
                                    <span className="text-[10px] font-mono text-muted-foreground font-bold">
                                        {int.status?.readyReplicas || 0}/{int.status?.desiredReplicas || 0}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                                {int.status?.message || "Integrating with your cluster..."}
                            </p>
                            
                            {int.spec.type === "cloudflare-tunnel" && int.status?.phase === "Ready" && (
                                <div className="mt-3 p-2 rounded bg-sky-500/5 border border-sky-500/10 text-[10px] text-sky-600 dark:text-sky-400 font-medium">
                                    <strong>Tip:</strong> In Cloudflare, point your hostname to <code>http://app-name:port</code> (e.g. <code>http://my-web-app:80</code>)
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex gap-2">
                                    <Dialog open={!!editIntegration} onOpenChange={(open) => {
                                        if (!open) { setEditIntegration(null); setEditConfig({}); }
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => {
                                                setEditIntegration(int)
                                                setEditConfig(int.spec.config || {})
                                                setError(null)
                                            }}>
                                                <Settings2 className="w-3.5 h-3.5" /> Edit
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Edit: {int.metadata.name}</DialogTitle>
                                                <DialogDescription>
                                                    Update the configuration for this integration.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                {error && (
                                                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-bold flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4" /> {error}
                                                    </div>
                                                )}
                                                {int.spec.type === "cloudflare-tunnel" && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="edit-token">Tunnel Token</Label>
                                                        <Input 
                                                            id="edit-token" 
                                                            placeholder="New Cloudflare Tunnel Token"
                                                            value={editConfig.token || ""} 
                                                            onChange={(e) => setEditConfig({ ...editConfig, token: e.target.value })} 
                                                            className="font-mono text-sm" 
                                                        />
                                                    </div>
                                                )}
                                                {int.spec.type === "cert-manager" && (
                                                    <>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="edit-email">Email Address</Label>
                                                            <Input 
                                                                id="edit-email" 
                                                                placeholder="admin@example.com"
                                                                value={editConfig.email || ""} 
                                                                onChange={(e) => setEditConfig({ ...editConfig, email: e.target.value })} 
                                                                className="text-sm" 
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="edit-dns-token">Cloudflare API Token (Optional)</Label>
                                                            <Input 
                                                                id="edit-dns-token" 
                                                                placeholder="Cloudflare API Token for DNS-01"
                                                                value={editConfig.dnsToken || ""} 
                                                                onChange={(e) => setEditConfig({ ...editConfig, dnsToken: e.target.value })} 
                                                                className="font-mono text-sm" 
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={updateIntegrationConfig} disabled={installing}>
                                                    {installing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save Changes
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={!!deleting}>
                                            {deleting === int.metadata.name ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />} 
                                            Remove
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove the <strong>{int.metadata.name}</strong> integration from your namespace. 
                                                Any apps relying on this integration may lose connectivity.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteIntegration(int.metadata.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Confirm Removal
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Available to install */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground ml-1">Available Integrations</h3>
                <div className="grid gap-6 md:grid-cols-2">
                    {availableIntegrations.filter(ai => !integrations.some(i => i.spec.type === ai.type)).map((ai) => (
                        <Card key={ai.type} className="border-dashed bg-muted/5">
                            <CardHeader className="flex flex-row items-start gap-6">
                                <div className="p-4 rounded-2xl bg-background border shadow-sm">
                                    {ai.icon}
                                </div>
                                <div className="space-y-1">
                                    <CardTitle>{ai.name}</CardTitle>
                                    <CardDescription className="text-xs leading-relaxed">
                                        {ai.description}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="flex justify-end">
                                {ai.setup}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
