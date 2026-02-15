"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react"
import { addSecret, loadSecrets, removeSecret } from "@/app/actions/secrets"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface AppSecretsProps {
    appName: string
    namespace: string
    secretRefs?: string[]
}

export function AppSecrets({ appName, namespace, secretRefs }: AppSecretsProps) {
    const [secrets, setSecrets] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    
    // New Secret Form
    const [newSecretName, setNewSecretName] = useState("")
    const [kvPairs, setKvPairs] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }])

    useEffect(() => {
        loadSecrets(namespace, appName).then(setSecrets)
    }, [appName, namespace])

    const handleAddPair = () => {
        setKvPairs([...kvPairs, { key: "", value: "" }])
    }

    const handleCreate = async () => {
        setLoading(true)
        const data: Record<string, string> = {}
        kvPairs.forEach(p => {
            if (p.key && p.value) data[p.key] = p.value
        })

        const res = await addSecret(namespace, appName, newSecretName, data)
        if (res.error) {
            alert(res.error)
        } else {
            setOpen(false)
            setNewSecretName("")
            setKvPairs([{ key: "", value: "" }])
            loadSecrets(namespace, appName).then(setSecrets)
        }
        setLoading(false)
    }

    const handleDelete = async (name: string) => {
        if (!confirm("Are you sure? This will remove the secret from the app and delete it.")) return
        setLoading(true)
        await removeSecret(namespace, appName, name)
        loadSecrets(namespace, appName).then(setSecrets)
        setLoading(false)
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Encrypted Secrets
                    </CardTitle>
                    <CardDescription>
                        Securely stored values injected as environment variables.
                    </CardDescription>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" /> New Secret
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Secret</DialogTitle>
                            <DialogDescription>
                                Defines a set of environment variables that will be encrypted.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Secret Name (Group)</Label>
                                <Input placeholder="e.g. database-creds" value={newSecretName} onChange={e => setNewSecretName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Values</Label>
                                {kvPairs.map((pair, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input placeholder="KEY" value={pair.key} onChange={e => {
                                            const n = [...kvPairs]; n[idx].key = e.target.value; setKvPairs(n)
                                        }} />
                                        <Input type="password" placeholder="VALUE" value={pair.value} onChange={e => {
                                            const n = [...kvPairs]; n[idx].value = e.target.value; setKvPairs(n)
                                        }} />
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={handleAddPair} className="w-full">
                                    <Plus className="w-3 h-3 mr-2" /> Add Value
                                </Button>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={loading || !newSecretName}>
                                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Secret
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {secrets.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                            No secrets configured.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {secrets.map(s => (
                                <div key={s.name} className="flex items-center justify-between p-4 border rounded-lg bg-muted/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <Key className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <div className="font-semibold">{s.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Keys: {s.keys.join(", ")}
                                            </div>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(s.name)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
