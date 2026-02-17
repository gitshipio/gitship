"use client"

import { useState, useTransition, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Trash2, Plus, Save, RotateCcw, Database, Clock, Lock, GitBranch, Tag, Hash, ChevronDown, Key, Loader2, CheckCircle2, Search, Check, AlertCircle, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AppSecrets } from "./app-secrets"
import { setupAppSSH } from "@/app/actions/secrets"

interface AppConfigurationProps {
    appName: string
    namespace: string
    spec: {
        repoUrl: string
        source: { type: "branch" | "tag" | "commit"; value: string }
        authMethod?: string
        imageName: string
        ports: { name?: string; port: number; targetPort: number; protocol?: string }[]
        resources?: { cpu?: string; memory?: string }
        healthCheck?: { path?: string; port?: number; initialDelay?: number; timeout?: number }
        domain?: string
        replicas?: number
        env?: Record<string, string>
        volumes?: { name: string; mountPath: string; size: string; storageClass?: string }[]
        updateStrategy?: { type: "polling" | "webhook"; interval?: string }
        tls?: { enabled: boolean; issuer?: string }
        secretRefs?: string[]
        secretMounts?: { secretName: string; mountPath: string }[]
        addons?: { type: string; name: string; size?: string }[]
    }
}

export function AppConfiguration({ appName, namespace, spec }: AppConfigurationProps) {
    const router = useRouter()
    
    if (!spec) return <div className="p-8 text-center text-muted-foreground italic">Configuration temporarily unavailable.</div>

    const [replicas, setReplicas] = useState(spec?.replicas ?? 1)
    const [cpu, setCpu] = useState(spec?.resources?.cpu ?? "500m")
    const [memory, setMemory] = useState(spec?.resources?.memory ?? "1Gi")
    const [hcPath, setHcPath] = useState(spec?.healthCheck?.path ?? "")
    const [hcPort, setHcPort] = useState(spec?.healthCheck?.port ?? 8080)
    const [sourceType, setSourceType] = useState<"branch" | "tag" | "commit">(spec?.source?.type ?? "branch")
    const [sourceValue, setSourceValue] = useState(spec?.source?.value ?? "main")
    
    const [branches, setBranches] = useState<string[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [commits, setCommits] = useState<{sha: string, message: string}[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchValue] = useState("")
    const [isDropdownOpen, setDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [authMethod, setAuthMethod] = useState(spec?.authMethod || "token")
    const [setupLoading, setSetupLoading] = useState(false)
    const [sshResult, setSshResult] = useState<{ success: boolean, autoAdded: boolean, publicKey?: string } | null>(null)

    const [updateStrategy, setUpdateStrategy] = useState<"polling" | "webhook">(spec?.updateStrategy?.type ?? "polling")
    const [pollInterval, setPollInterval] = useState(spec?.updateStrategy?.interval ?? "5m")
    
    const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>(() => {
        try {
            return Object.entries(spec?.env || {}).map(([key, value]) => ({ key, value }))
        } catch {
            return []
        }
    })
    
    const [volumes, setVolumes] = useState(spec?.volumes || [])
    const [secretMounts, setSecretMounts] = useState<{ secretName: string; mountPath: string }[]>(spec?.secretMounts || [])
    const [addons, setAddons] = useState<{ type: string; name: string; size?: string }[]>(spec?.addons || [])
    
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState("")

    const addAddon = (type: string) => {
        const id = Math.random().toString(36).substring(7)
        setAddons([...addons, { type, name: `${type}-${id}`, size: "small" }])
    }
    const removeAddon = (idx: number) => setAddons(addons.filter((_, i) => i !== idx))

    useEffect(() => {
        const fetchRepoInfo = async () => {
            if (!spec.repoUrl) return
            setIsSearching(true)
            try {
                const res = await fetch(`/api/github/repo-info?url=${encodeURIComponent(spec.repoUrl)}`)
                if (res.ok) {
                    const data = await res.json()
                    setBranches(data.branches || [])
                    setTags(data.tags || [])
                    setCommits(data.latestCommits || [])
                }
            } catch (err) {
                console.error("Failed to fetch repo info:", err)
            } finally {
                setIsSearching(false)
            }
        }
        fetchRepoInfo()
    }, [spec.repoUrl])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredOptions = useMemo(() => {
        let options: { value: string, label?: string, sub?: string }[] = []
        if (sourceType === "branch") options = branches.map(b => ({ value: b }))
        else if (sourceType === "tag") options = tags.map(t => ({ value: t }))
        else if (sourceType === "commit") options = commits.map(c => ({ value: c.sha, label: c.sha.substring(0, 7), sub: c.message }))

        if (!searchQuery) return options
        return options.filter(o => 
            o.value.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (o.sub && o.sub.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    }, [sourceType, branches, tags, commits, searchQuery])

    // 2. Proper Side-Effect handling for SSH Check
    useEffect(() => {
        let isMounted = true
        if (!namespace || !appName) return

        const checkSSH = async () => {
            try {
                const res = await fetch(`/api/apps/${namespace}/${appName}/ssh-status`)
                if (!res.ok) return
                const data = await res.json()
                if (isMounted && data?.exists) {
                    setAuthMethod("ssh")
                }
            } catch (err) {
                // Ignore background errors
            }
        }
        checkSSH()
        return () => { isMounted = false }
    }, [namespace, appName])

    const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }])
    const removeEnvVar = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx))
    const updateEnvVar = (idx: number, field: "key" | "value", val: string) => {
        const updated = [...envVars]
        updated[idx][field] = val
        setEnvVars(updated)
    }

    const addSecretMount = () => setSecretMounts([...secretMounts, { secretName: "", mountPath: "" }])
    const removeSecretMount = (idx: number) => setSecretMounts(secretMounts.filter((_, i) => i !== idx))
    const updateSecretMount = (idx: number, field: string, val: string) => {
        const updated = [...secretMounts]
        // @ts-ignore
        updated[idx][field] = val
        setSecretMounts(updated)
    }

    const addVolume = () => setVolumes([...volumes, { name: "", mountPath: "", size: "1Gi" }])
    const removeVolume = (idx: number) => setVolumes(volumes.filter((_, i) => i !== idx))
    const updateVolume = (idx: number, field: string, val: string) => {
        const updated = [...volumes]
        // @ts-ignore
        updated[idx][field] = val
        setVolumes(updated)
    }

    const handleSetupSSH = async () => {
        setSetupLoading(true)
        setSshResult(null)
        try {
            const res = await setupAppSSH(namespace, appName, spec.repoUrl)
            if (res.error) {
                setMessage(`Error: ${res.error}`)
            } else {
                setSshResult({ 
                    success: true, 
                    autoAdded: !!res.autoAdded, 
                    publicKey: res.publicKey 
                })
                setAuthMethod("ssh")
                router.refresh()
            }
        } catch (e: any) {
            setMessage(`Error: ${e.message}`)
        } finally {
            setSetupLoading(false)
        }
    }

    const handleSave = () => {
        startTransition(async () => {
            const env: Record<string, string> = {}
            envVars.forEach(({ key, value }) => {
                if (key.trim()) env[key.trim()] = value
            })

            const patch = {
                spec: {
                    replicas,
                    resources: {
                        cpu,
                        memory,
                    },
                    healthCheck: {
                        path: hcPath,
                        port: hcPort,
                    },
                    source: {
                        type: sourceType,
                        value: sourceValue,
                    },
                    authMethod,
                    env: Object.keys(env).length > 0 ? env : undefined,
                    volumes: volumes.length > 0 ? volumes : undefined,
                    secretMounts: secretMounts.length > 0 ? secretMounts : undefined,
                    addons: addons.length > 0 ? addons : undefined,
                    updateStrategy: {
                        type: updateStrategy,
                        interval: pollInterval,
                    },
                },
            }

            try {
                const res = await fetch(`/api/apps/${namespace}/${appName}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                })
                if (res.ok) {
                    setMessage("Configuration saved!")
                } else {
                    const data = await res.json()
                    setMessage(`Error: ${data.error || "Failed to save"}`)
                }
            } catch (e: any) {
                setMessage(`Error: ${e.message}`)
            }
        })
    }

    return (
        <div className="space-y-8">
            {/* 1. Resources & Scaling */}
            <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Database className="w-5 h-5 text-primary" />
                    Resources & Scaling
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Deployment Scale</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="replicas">Number of Instances (Replicas)</Label>
                                <Input
                                    id="replicas"
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={replicas}
                                    onChange={(e) => setReplicas(parseInt(e.target.value) || 1)}
                                    className="h-11 border-2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cpu">CPU Limit</Label>
                                    <Input
                                        id="cpu"
                                        placeholder="500m"
                                        value={cpu}
                                        onChange={(e) => setCpu(e.target.value)}
                                        className="h-11 border-2 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="memory">Memory Limit</Label>
                                    <Input
                                        id="memory"
                                        placeholder="1Gi"
                                        value={memory}
                                        onChange={(e) => setMemory(e.target.value)}
                                        className="h-11 border-2 font-mono"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider flex items-center justify-between">
                                Source Version
                                {isSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <div className="relative w-28 shrink-0">
                                    <select
                                        className="flex h-11 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-xs appearance-none pr-8 font-bold"
                                        value={sourceType}
                                        onChange={e => {
                                            setSourceType(e.target.value as any)
                                            setSearchValue("")
                                        }}
                                    >
                                        <option value="branch">Branch</option>
                                        <option value="tag">Tag</option>
                                        <option value="commit">Commit</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-3.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                                </div>
                                
                                {/* Searchable Combobox */}
                                <div className="relative flex-1" ref={dropdownRef}>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground z-10">
                                            {sourceType === "branch" && <GitBranch className="h-4 w-4" />}
                                            {sourceType === "tag" && <Tag className="h-4 w-4" />}
                                            {sourceType === "commit" && <Hash className="h-4 w-4" />}
                                        </div>
                                        <Input
                                            className="h-11 pl-9 border-2 font-mono text-sm pr-10"
                                            placeholder={`Search or enter ${sourceType}...`}
                                            value={isDropdownOpen ? searchQuery : sourceValue}
                                            onChange={e => {
                                                setSearchValue(e.target.value)
                                                setSourceValue(e.target.value)
                                                setDropdownOpen(true)
                                            }}
                                            onFocus={() => {
                                                setSearchValue("")
                                                setDropdownOpen(true)
                                            }}
                                        />
                                        <div 
                                            className="absolute right-3 top-3.5 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                                            onClick={() => setDropdownOpen(!isDropdownOpen)}
                                        >
                                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isDropdownOpen && "rotate-180")} />
                                        </div>
                                    </div>

                                    {isDropdownOpen && (
                                        <div className="absolute z-[100] w-full mt-2 bg-popover text-popover-foreground border-2 rounded-xl shadow-2xl max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-1">
                                                {filteredOptions.length > 0 ? (
                                                    filteredOptions.map((opt) => (
                                                        <div
                                                            key={opt.value}
                                                            className={cn(
                                                                "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-all mb-0.5 last:mb-0",
                                                                sourceValue === opt.value && "bg-accent border-l-4 border-l-primary pl-2"
                                                            )}
                                                            onClick={() => {
                                                                setSourceValue(opt.value)
                                                                setSearchValue("")
                                                                setDropdownOpen(false)
                                                            }}
                                                        >
                                                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                                                <span className="font-bold font-mono">{opt.label || opt.value}</span>
                                                                {opt.sub && <span className="text-[10px] opacity-60 truncate">{opt.sub}</span>}
                                                            </div>
                                                            {sourceValue === opt.value && <Check className="ml-auto h-4 w-4 text-primary" />}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-muted-foreground italic">
                                                        No matches found. Press enter to use custom value.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SSH Authentication Card */}
                    <Card className={cn(authMethod === "ssh" ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5")}>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider flex items-center justify-between">
                                SSH Authentication
                                <Badge variant={authMethod === "ssh" ? "default" : "outline"} className={authMethod === "ssh" ? "bg-emerald-500 hover:bg-emerald-600" : "text-amber-600 border-amber-600"}>
                                    {authMethod === "ssh" ? "Secure" : "Using Token"}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button 
                                variant="outline" 
                                className="w-full h-11 gap-2 font-bold" 
                                onClick={handleSetupSSH}
                                disabled={setupLoading}
                            >
                                {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                                {authMethod === "ssh" ? "Re-setup SSH Deploy Key" : "Setup SSH Deploy Key"}
                            </Button>

                            {sshResult?.success && (
                                <div className="p-4 rounded-lg bg-background border-2 border-dashed space-y-3 animate-in zoom-in-95">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase">
                                        <CheckCircle2 className="w-4 h-4" /> 
                                        {sshResult.autoAdded ? "Auto-configured successfully!" : "Manual setup required"}
                                    </div>
                                    
                                    {!sshResult.autoAdded && sshResult.publicKey && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-muted-foreground leading-tight">
                                                Automatic upload failed (likely disabled in GitHub settings). 
                                                Please add this Public Key manually to your repository <strong>Settings &gt; Deploy keys</strong>:
                                            </p>
                                            <textarea 
                                                readOnly 
                                                value={sshResult.publicKey} 
                                                className="w-full h-24 p-2 text-[10px] font-mono bg-muted rounded border border-input focus:outline-none"
                                            />
                                            <Button size="sm" variant="secondary" className="w-full text-[10px] h-7" onClick={() => {
                                                navigator.clipboard.writeText(sshResult.publicKey!)
                                                alert("Public key copied to clipboard!")
                                            }}>
                                                Copy Public Key
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 2. Environment Configuration */}
            <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Key className="w-5 h-5 text-primary" />
                    Environment & Secrets
                </h3>
                <div className="grid grid-cols-1 gap-6">
                    {/* Encrypted Secrets */}
                    <AppSecrets appName={appName} namespace={namespace} secretRefs={spec.secretRefs} />

                    {/* Standard Env Vars */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                            <div>
                                <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Environment Variables</CardTitle>
                                <CardDescription className="text-[10px]">Standard key-value pairs (publicly visible in spec).</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" onClick={addEnvVar}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Var
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-3">
                            {envVars.length === 0 && (
                                <p className="text-sm text-muted-foreground italic text-center py-4">No environment variables configured.</p>
                            )}
                            {envVars.map((ev, idx) => (
                                <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <Input
                                        placeholder="KEY"
                                        value={ev.key}
                                        onChange={(e) => updateEnvVar(idx, "key", e.target.value)}
                                        className="font-mono text-sm h-10 border-2"
                                    />
                                    <span className="text-muted-foreground font-bold">=</span>
                                    <Input
                                        placeholder="value"
                                        value={ev.value}
                                        onChange={(e) => updateEnvVar(idx, "value", e.target.value)}
                                        className="font-mono text-sm h-10 border-2"
                                    />
                                    <Button size="icon" variant="ghost" onClick={() => removeEnvVar(idx)} className="text-destructive">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Secret Mounts (Files) */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                            <div>
                                <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Secret File Mounts</CardTitle>
                                <CardDescription className="text-[10px]">Mount existing secrets as files in your container.</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" onClick={addSecretMount}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Mount
                            </Button>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-3">
                            {secretMounts.length === 0 && (
                                <p className="text-sm text-muted-foreground italic text-center py-4">No secrets mounted as files.</p>
                            )}
                            {secretMounts.map((sm, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-2 rounded-xl bg-muted/5 relative group animate-in zoom-in-95 duration-300">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Secret Name</Label>
                                        <Input
                                            placeholder="my-secret"
                                            value={sm.secretName}
                                            onChange={(e) => updateSecretMount(idx, "secretName", e.target.value)}
                                            className="h-10 text-sm font-mono bg-background"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Mount Path</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="/app/config"
                                                value={sm.mountPath}
                                                onChange={(e) => updateSecretMount(idx, "mountPath", e.target.value)}
                                                className="h-10 text-sm font-mono bg-background flex-1"
                                            />
                                            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeSecretMount(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 3. Storage */}
            <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Database className="w-5 h-5 text-primary" />
                    Persistent Storage
                </h3>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between border-b py-4">
                        <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Volumes (PVC)</CardTitle>
                        <Button size="sm" variant="outline" onClick={addVolume}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Volume
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {volumes.length === 0 && (
                            <p className="text-sm text-muted-foreground italic text-center py-4">No persistent volumes configured.</p>
                        )}
                        {volumes.map((vol, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border-2 rounded-xl relative group bg-muted/5 animate-in zoom-in-95 duration-300">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Name</Label>
                                    <Input
                                        placeholder="data"
                                        value={vol.name}
                                        onChange={(e) => updateVolume(idx, "name", e.target.value)}
                                        className="h-10 text-sm font-mono bg-background"
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Mount Path</Label>
                                    <Input
                                        placeholder="/app/data"
                                        value={vol.mountPath}
                                        onChange={(e) => updateVolume(idx, "mountPath", e.target.value)}
                                        className="h-10 text-sm font-mono bg-background"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold opacity-70">Size</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="1Gi"
                                            value={vol.size}
                                            onChange={(e) => updateVolume(idx, "size", e.target.value)}
                                            className="h-10 text-sm font-mono bg-background"
                                        />
                                        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeVolume(idx)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </section>

            {/* 4. Automation & Health */}
            <section className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Activity className="w-5 h-5 text-primary" />
                    Automation & Reliability
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Health Checks (HTTP)</CardTitle>
                            <CardDescription className="text-[10px]">Configure liveness and readiness probes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="hcPath">Probe Path</Label>
                                <Input
                                    id="hcPath"
                                    placeholder="/health (leave empty to disable)"
                                    value={hcPath}
                                    onChange={(e) => setHcPath(e.target.value)}
                                    className="h-11 border-2 font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="hcPort">Probe Port</Label>
                                <Input
                                    id="hcPort"
                                    type="number"
                                    value={hcPort}
                                    onChange={(e) => setHcPort(parseInt(e.target.value) || 8080)}
                                    className="h-11 border-2 font-mono"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-semibold opacity-70 uppercase tracking-wider">Update Strategy</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <RadioGroup 
                                value={updateStrategy} 
                                onValueChange={(v: "polling" | "webhook") => setUpdateStrategy(v)}
                                className="grid grid-cols-1 gap-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="polling" id="polling-c" />
                                    <Label htmlFor="polling-c" className="text-sm font-medium">Automatic Polling</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="webhook" id="webhook-c" />
                                    <Label htmlFor="webhook-c" className="text-sm font-medium">Webhook Trigger</Label>
                                </div>
                            </RadioGroup>
                            
                            {updateStrategy === "polling" && (
                                <div className="pt-2 animate-in slide-in-from-top-1">
                                    <Label className="text-[10px] uppercase font-bold opacity-70 mb-1 block">Interval</Label>
                                    <Input 
                                        value={pollInterval} 
                                        onChange={e => setPollInterval(e.target.value)} 
                                        className="h-10 font-mono text-sm border-2" 
                                        placeholder="5m"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 5. Marketplace & Addons */}
            <section className="space-y-4 pb-20">
                <h3 className="text-lg font-bold flex items-center gap-2 px-1">
                    <Plus className="w-5 h-5 text-primary" />
                    Marketplace & Addons
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Catalog */}
                    <Card className="md:col-span-1">
                        <CardHeader className="py-4">
                            <CardTitle className="text-xs font-bold uppercase opacity-50">Available Addons</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <button 
                                onClick={() => addAddon("postgres")}
                                className="w-full flex items-center justify-between p-3 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold group-hover:scale-110 transition-transform">PS</div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">PostgreSQL</p>
                                        <p className="text-[10px] text-muted-foreground italic">Relational Database</p>
                                    </div>
                                </div>
                                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </button>

                            <button 
                                onClick={() => addAddon("redis")}
                                className="w-full flex items-center justify-between p-3 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 font-bold group-hover:scale-110 transition-transform">RD</div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold">Redis</p>
                                        <p className="text-[10px] text-muted-foreground italic">In-memory Cache</p>
                                    </div>
                                </div>
                                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </button>
                        </CardContent>
                    </Card>

                    {/* Active Addons */}
                    <Card className="md:col-span-2">
                        <CardHeader className="py-4">
                            <CardTitle className="text-xs font-bold uppercase opacity-50">Active Instances</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {addons.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                                    <p className="text-sm text-muted-foreground italic">No addons provisioned. Select an addon from the catalog to get started.</p>
                                </div>
                            )}
                            {addons.map((a, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 border-2 rounded-2xl bg-background shadow-sm animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs",
                                            a.type === "postgres" ? "bg-blue-500/10 text-blue-600" : "bg-red-500/10 text-red-600"
                                        )}>
                                            {a.type.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{a.name}</p>
                                            <div className="flex gap-2 mt-1">
                                                <Badge variant="outline" className="text-[9px] h-4">{a.type}</Badge>
                                                <Badge variant="secondary" className="text-[9px] h-4">Size: {a.size}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground italic mr-4">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Linked to App
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-destructive h-10 w-10" onClick={() => removeAddon(idx)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {addons.length > 0 && (
                                <p className="text-[10px] text-muted-foreground italic pt-2 px-1">
                                    Credentials (e.g. DATABASE_URL) are automatically injected into your app environment.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Global Actions Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 flex items-center justify-center gap-4">
                <Button onClick={handleSave} disabled={isPending} size="lg" className="shadow-xl shadow-primary/20 px-8">
                    {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Configuration</>}
                </Button>
                <Button variant="outline" size="lg" onClick={() => window.location.reload()} className="px-8">
                    Discard Changes
                </Button>
                {message && (
                    <div className={cn(
                        "absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold animate-in slide-in-from-bottom-2",
                        message.startsWith("Error") ? "bg-destructive text-destructive-foreground" : "bg-emerald-500 text-white"
                    )}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    )
}
