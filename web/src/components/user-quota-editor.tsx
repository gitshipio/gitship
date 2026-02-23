"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface UserQuotaEditorProps {
    username: string
    currentQuotas?: { cpu?: string; memory?: string; pods?: string }
}

export function UserQuotaEditor({ username, currentQuotas }: UserQuotaEditorProps) {
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const [cpu, setCpu] = useState(currentQuotas?.cpu || "4")
    const [memory, setMemory] = useState(currentQuotas?.memory || "8Gi")
    const [pods, setPods] = useState(currentQuotas?.pods || "20")

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/users/${username}/quotas`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quotas: { cpu, memory, pods } }),
            })
            if (res.ok) {
                setOpen(false)
                router.refresh()
            } else {
                alert("Failed to update quotas")
            }
        } catch (err: unknown) {
            // @ts-expect-error dynamic access
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings2 className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Resource Quotas for {username}</DialogTitle>
                    <DialogDescription>
                        Set limits for CPU, Memory and total Pods across all user namespaces.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cpu" className="text-right text-xs uppercase font-bold opacity-70">CPU</Label>
                        <Input id="cpu" value={cpu} onChange={e => setCpu(e.target.value)} className="col-span-3 font-mono" placeholder="4" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="memory" className="text-right text-xs uppercase font-bold opacity-70">RAM</Label>
                        <Input id="memory" value={memory} onChange={e => setMemory(e.target.value)} className="col-span-3 font-mono" placeholder="8Gi" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pods" className="text-right text-xs uppercase font-bold opacity-70">Pods</Label>
                        <Input id="pods" value={pods} onChange={e => setPods(e.target.value)} className="col-span-3 font-mono" placeholder="20" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Quotas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
