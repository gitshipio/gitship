"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RegistryConfig } from "@/lib/types"
import { Plus, Trash2, Database, Server, Key, User, Lock, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function RegistrySettings({ registries = [] }: { registries?: RegistryConfig[] }) {
    const [name, setName] = useState("")
    const [server, setServer] = useState("")
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [open, setOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [registryToDelete, setRegistryToDelete] = useState<string | null>(null)
    const router = useRouter()

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const res = await fetch("/api/user/registries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, server, username, password }),
            })

            if (res.ok) {
                setName("")
                setServer("")
                setUsername("")
                setPassword("")
                setOpen(false)
                router.refresh()
            } else {
                const data = await res.json()
                setError(data.error || "Failed to add registry")
            }
        } catch (err: unknown) {
            // @ts-expect-error dynamic access
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!registryToDelete) return
        setLoading(true)
        try {
            const res = await fetch("/api/user/registries", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: registryToDelete }),
            })

            if (res.ok) {
                setDeleteConfirmOpen(false)
                setRegistryToDelete(null)
                router.refresh()
            }
        } catch (err: unknown) {
            // @ts-expect-error dynamic access
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40 bg-muted/5">
                <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        Container Registries
                    </CardTitle>
                    <CardDescription>
                        Manage credentials for pushing application images.
                    </CardDescription>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" /> Add Registry
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <form onSubmit={handleAdd}>
                            <DialogHeader>
                                <DialogTitle>Add Container Registry</DialogTitle>
                                <DialogDescription>
                                    Enter your registry credentials. These are stored as Kubernetes Secrets.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-right">Friendly Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="My GHCR"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="server" className="text-right">Server URL</Label>
                                    <div className="relative">
                                        <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="server"
                                            placeholder="ghcr.io"
                                            value={server}
                                            onChange={(e) => setServer(e.target.value)}
                                            className="pl-9"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="username">Username</Label>
                                        <div className="relative">
                                            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="username"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="pl-9"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Token / Password</Label>
                                        <div className="relative">
                                            <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-9"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                {error && (
                                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                                        <AlertCircle className="w-4 h-4" /> {error}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Saving..." : "Save Registry"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="pt-6">
                {registries.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/5">
                        <div className="bg-muted/20 p-3 rounded-full w-fit mx-auto mb-3">
                            <Database className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No registries connected</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                            Add a registry to push images to GitHub Packages, Docker Hub, or your private instance.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {registries.map((reg) => (
                            <div
                                key={reg.name}
                                className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-card hover:bg-muted/5 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                                            {reg.name}
                                            <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {reg.server}
                                            </span>
                                        </h4>
                                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                            <User className="w-3 h-3" /> {reg.username}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                        setRegistryToDelete(reg.name)
                                        setDeleteConfirmOpen(true)
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Remove Registry</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to remove <strong>{registryToDelete}</strong>? 
                                This will delete the associated Kubernetes Secret. Applications using this registry for pulling images might fail if not updated.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                                {loading ? "Deleting..." : "Confirm Removal"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
