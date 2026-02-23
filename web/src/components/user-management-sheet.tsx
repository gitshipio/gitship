"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { 
    Sheet, 
    SheetContent, 
    SheetDescription, 
    SheetHeader, 
    SheetTitle, 
    SheetTrigger,
    SheetFooter
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
    Settings2, 
    User as UserIcon, 
    Github, 
    Cpu, 
    Database, 
    Layout, 
    Loader2
} from "lucide-react"
import { GitshipUser } from "@/lib/types"

interface UserManagementSheetProps {
    user: GitshipUser
}

export function UserManagementSheet({ user }: UserManagementSheetProps) {
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    // States for Editing
    const [role, setRole] = useState(user.spec.role)
    const [cpu, setCpu] = useState(user.spec.quotas?.cpu || "4")
    const [memory, setMemory] = useState(user.spec.quotas?.memory || "8Gi")
    const [pods, setPods] = useState(user.spec.quotas?.pods || "20")
    const [storage, setStorage] = useState(user.spec.quotas?.storage || "10Gi")

    const handleSave = async () => {
        setLoading(true)
        try {
            // Update Role
            const roleRes = await fetch(`/api/admin/users/${user.metadata.name}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            })

            // Update Quotas
            const quotaRes = await fetch(`/api/admin/users/${user.metadata.name}/quotas`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quotas: { cpu, memory, pods, storage } }),
            })

            if (roleRes.ok && quotaRes.ok) {
                setOpen(false)
                router.refresh()
            } else {
                alert("Failed to update some settings")
            }
        } catch (e: unknown) {
            // @ts-expect-error dynamic access
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                    Manage
                </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader className="space-y-1">
                    <SheetTitle className="text-2xl flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-primary" />
                        Manage User
                    </SheetTitle>
                    <SheetDescription>
                        Configuration for {user.metadata.name}
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-8">
                    {/* Identity Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Identity</h4>
                        <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Github className="w-4 h-4" /> GitHub
                                </span>
                                <span className="text-sm font-mono font-bold">@{user.spec.githubUsername}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status</span>
                                {user.status?.ready ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] uppercase font-black">Active</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] uppercase font-black">Pending</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Permissions Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Permissions</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {["admin", "user", "restricted"].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={`
                                        p-3 rounded-lg border-2 text-center transition-all
                                        ${role === r 
                                            ? "border-primary bg-primary/5 text-primary font-bold shadow-sm" 
                                            : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"}
                                    `}
                                >
                                    <div className="text-[10px] uppercase tracking-tighter">{r}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quotas Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Settings2 className="w-4 h-4" /> Resource Quotas
                            </h4>
                        </div>
                        
                        {/* Presets */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: "Starter", cpu: "1", mem: "2Gi", pods: "10", storage: "5Gi" },
                                { label: "Dev", cpu: "4", mem: "8Gi", pods: "20", storage: "20Gi" },
                                { label: "Power", cpu: "16", mem: "32Gi", pods: "50", storage: "100Gi" },
                            ].map((p) => (
                                <Button 
                                    key={p.label} 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-7 text-[9px] font-black uppercase tracking-tighter"
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

                        <div className="space-y-4 p-4 rounded-xl border bg-muted/5">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1.5">
                                    <Cpu className="w-3 h-3" /> CPU Limit
                                </Label>
                                <Input value={cpu} onChange={e => setCpu(e.target.value)} className="font-mono h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1.5">
                                    <Database className="w-3 h-3" /> RAM Limit
                                </Label>
                                <Input value={memory} onChange={e => setMemory(e.target.value)} className="font-mono h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1.5">
                                    <Layout className="w-3 h-3" /> Max Pods
                                </Label>
                                <Input value={pods} onChange={e => setPods(e.target.value)} className="font-mono h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1.5">
                                    <Database className="w-3 h-3" /> Disk Storage
                                </Label>
                                <Input value={storage} onChange={e => setStorage(e.target.value)} className="font-mono h-9" />
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="mt-6">
                    <Button className="w-full" onClick={handleSave} disabled={loading}>
                        {loading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            "Apply Changes"
                        )}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
