"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Save, Cpu, HardDrive, LayoutGrid, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserQuotaSettingsProps {
    userId: string
    quotas: {
        cpu?: string
        memory?: string
        pods?: string
        storage?: string
        buildCPU?: string
        buildMemory?: string
    }
}

export function UserQuotaSettings({ userId, quotas }: UserQuotaSettingsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState("")

    const [cpu, setCpu] = useState(quotas?.cpu || "4")
    const [memory, setMemory] = useState(quotas?.memory || "8Gi")
    const [pods, setPods] = useState(quotas?.pods || "20")
    const [storage, setStorage] = useState(quotas?.storage || "10Gi")
    const [buildCPU, setBuildCPU] = useState(quotas?.buildCPU || "1")
    const [buildMemory, setBuildMemory] = useState(quotas?.buildMemory || "2Gi")

    const handleSave = () => {
        startTransition(async () => {
            const patch = {
                spec: {
                    quotas: {
                        cpu,
                        memory,
                        pods,
                        storage,
                        buildCPU,
                        buildMemory
                    }
                }
            }

            try {
                const res = await fetch(`/api/user/${userId}/quotas`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                })
                if (res.ok) {
                    setMessage("Quotas updated!")
                    router.refresh()
                } else {
                    const data = await res.json()
                    setMessage(`Error: ${data.error || "Failed to update"}`)
                }
            } catch (e: any) {
                setMessage(`Error: ${e.message}`)
            }
        })
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                    Resource Quotas
                </CardTitle>
                <CardDescription>
                    Configure global resource limits for your account. These apply across all your apps.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* App Quotas */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">Running App Quotas</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    <Cpu className="w-3 h-3" /> Total CPU
                                </Label>
                                <Input value={cpu} onChange={e => setCpu(e.target.value)} className="font-mono h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    <Zap className="w-3 h-3" /> Total RAM
                                </Label>
                                <Input value={memory} onChange={e => setMemory(e.target.value)} className="font-mono h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    Max Pods
                                </Label>
                                <Input value={pods} onChange={e => setPods(e.target.value)} className="font-mono h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    <HardDrive className="w-3 h-3" /> Storage
                                </Label>
                                <Input value={storage} onChange={e => setStorage(e.target.value)} className="font-mono h-10" />
                            </div>
                        </div>
                    </div>

                    {/* Build Quotas */}
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary border-b border-primary/20 pb-1">Global Build Pipeline Limits</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    <Cpu className="w-3 h-3" /> Build CPU
                                </Label>
                                <Input value={buildCPU} onChange={e => setBuildCPU(e.target.value)} className="font-mono h-10" />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs">
                                    <Zap className="w-3 h-3" /> Build RAM
                                </Label>
                                <Input value={buildMemory} onChange={e => setBuildMemory(e.target.value)} className="font-mono h-10" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight italic">
                            These limits apply to every single build job. Increasing these will make your builds faster but consume more cluster resources.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                    <p className={cn("text-xs font-medium animate-in fade-in", message.startsWith("Error") ? "text-destructive" : "text-emerald-600")}>
                        {message}
                    </p>
                    <Button onClick={handleSave} disabled={isPending} className="gap-2 px-6">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Quotas
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
