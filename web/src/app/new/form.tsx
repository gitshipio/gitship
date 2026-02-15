"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createApp } from "./actions"
import { useFormStatus } from "react-dom"
import { useState, useMemo, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { GitHubRepo } from "@/lib/github"
import { RegistryConfig } from "@/lib/types"
import { Search, Globe, Lock, Check, Loader2, ChevronDown, Settings2, ArrowRight, Github, Database, Trash2, Plus, Clock, GitBranch, Tag, Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="w-full shadow-xl shadow-primary/20 h-14 text-lg font-bold">
      {pending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Provisioning Resources...</> : "Ship it!"}
    </Button>
  )
}

export function NewAppForm({ repos = [], registries = [] }: { repos?: GitHubRepo[], registries?: RegistryConfig[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  
  // Phase 1 State
  const [searchValue, setSearchValue] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [selectedRegistry, setSelectedRegistry] = useState<string>("internal")
  const [isOpen, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Phase 2 State
  const [isDetected, setIsDetected] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [appName, setAppName] = useState("")
  
  // Discovery Data
  const [branches, setBranches] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [commits, setCommits] = useState<{sha: string, message: string}[]>([])
  const [sourceType, setSourceType] = useState<"branch" | "tag" | "commit">("branch")
  const [sourceValue, setSourceValue] = useState("main")
  
  const [searchQuery, setSearchQuery] = useState("")
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [ports, setPorts] = useState<{ name: string; port: number; targetPort: number; protocol: string }[]>([
    { name: "http", port: 80, targetPort: 8080, protocol: "TCP" }
  ])
  const [imageName, setImageName] = useState("")
  const [domain, setDomain] = useState("")
  const [volumes, setVolumes] = useState<{ name: string; mountPath: string; size: string }[]>([])
  const [updateStrategy, setUpdateStrategy] = useState<"polling" | "webhook">("polling")
  const [pollInterval, setPollInterval] = useState("5m")

  const addPortMapping = () => setPorts([...ports, { name: "", port: 80, targetPort: 80, protocol: "TCP" }])
  const removePortMapping = (idx: number) => setPorts(ports.filter((_, i) => i !== idx))
  const updatePortMapping = (idx: number, field: string, val: any) => {
    const updated = [...ports]
    // @ts-ignore
    updated[idx][field] = val
    setPorts(updated)
  }

  const addVolume = () => setVolumes([...volumes, { name: "", mountPath: "", size: "1Gi" }])
  const removeVolume = (idx: number) => setVolumes(volumes.filter((_, i) => i !== idx))
  const updateVolume = (idx: number, field: string, val: string) => {
    const updated = [...volumes]
    // @ts-ignore
    updated[idx][field] = val
    setVolumes(updated)
  }

  const filteredRepos = useMemo(() => {
    if (!searchValue) return repos.slice(0, 20)
    return repos.filter(r => 
        r.full_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        r.html_url.toLowerCase().includes(searchValue.toLowerCase())
    ).slice(0, 20)
  }, [repos, searchValue])

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const detectRepoInfo = async (url: string) => {
    setIsDetecting(true)
    try {
        const res = await fetch(`/api/github/repo-info?url=${encodeURIComponent(url)}`)
        if (res.ok) {
            const data = await res.json()
            setBranches(data.branches || [])
            setTags(data.tags || [])
            setCommits(data.latestCommits || [])
            setSourceValue(data.branches.includes("main") ? "main" : (data.branches[0] || "main"))
            setPorts([{ name: "http", port: 80, targetPort: data.detectedPort, protocol: "TCP" }])
            setAppName(data.suggestedName)
            setIsDetected(true)
            
            const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/)
            if (match) {
                updateImageName(`${match[1]}/${match[2]}`.toLowerCase(), selectedRegistry)
            }
        } else {
            setAppName(url.split('/').pop()?.replace('.git', '') || "my-app")
            setIsDetected(true)
        }
    } catch {
        setIsDetected(true)
    } finally {
        setIsDetecting(false)
    }
  }

  const updateImageName = (base: string, registryName: string) => {
    if (registryName === "internal") {
      setImageName(base)
    } else {
      const reg = registries.find(r => r.name === registryName)
      if (reg) {
        setImageName(`${reg.server}/${base}`)
      }
    }
  }

  const selectRepo = (url: string, fullName?: string) => {
    setRepoUrl(url)
    setSearchValue(fullName || url)
    setOpen(false)
    detectRepoInfo(url)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    setMessage("")
    setErrors({})

    startTransition(async () => {
        try {
            const result = await createApp(formData)
            if (result?.errors) {
                setErrors(result.errors)
                setMessage(result.message || "Validation failed")
            } else if (result?.message) {
                setMessage(result.message)
            }
        } catch (err: any) {
            setMessage(`Unexpected error: ${err.message}`)
        }
    })
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-8">
            <Card className={cn(
                "border-border/60 shadow-xl bg-card/50 backdrop-blur-md overflow-visible transition-all duration-300",
                isOpen ? "z-50 ring-2 ring-primary/20" : "z-10"
            )}>
                <CardHeader className="bg-muted/20 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Github className="w-5 h-5" />
                        Project Source
                    </CardTitle>
                    <CardDescription>Select the repository you want to deploy to the cluster.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8 space-y-8 overflow-visible">
                    <div className="grid gap-8 md:grid-cols-3 overflow-visible">
                        <div className="md:col-span-2 space-y-2 relative" ref={containerRef}>
                            <Label htmlFor="repoSearch" className="text-sm font-bold uppercase tracking-wider opacity-70">Git Repository</Label>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="repoSearch"
                                    placeholder="Search repositories or paste custom URL..."
                                    className="pl-11 h-12 text-base border-2 focus-visible:ring-primary/20"
                                    value={searchValue}
                                    onChange={(e) => {
                                        setSearchValue(e.target.value)
                                        setRepoUrl(e.target.value)
                                        setOpen(true)
                                    }}
                                    onFocus={() => setOpen(true)}
                                    autoComplete="off"
                                />
                                {isDetecting && (
                                    <div className="absolute right-3.5 top-3.5">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>
                            
                            <input type="hidden" name="repoUrl" value={repoUrl} />

                            {isOpen && (searchValue || repos.length > 0) && (
                                <div className="absolute z-[100] w-[120%] -left-[10%] mt-2 bg-popover text-popover-foreground border-2 rounded-xl shadow-2xl max-h-[500px] overflow-auto animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-2">
                                        {filteredRepos.map((repo) => (
                                            <div
                                                key={repo.id}
                                                className={cn(
                                                    "relative flex cursor-pointer select-none items-center rounded-lg px-4 py-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-all mb-1 last:mb-0",
                                                    repoUrl === repo.html_url && "bg-accent border-l-4 border-l-primary pl-3"
                                                )}
                                                onClick={() => selectRepo(repo.html_url, repo.full_name)}
                                            >
                                                <div className={cn(
                                                    "mr-4 h-10 w-10 rounded-md flex items-center justify-center border shrink-0",
                                                    repo.private ? "bg-amber-500/10 border-amber-500/20 text-amber-600" : "bg-primary/10 border-primary/20 text-primary"
                                                )}>
                                                    {repo.private ? <Lock className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                                                </div>
                                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                                    <span className="font-bold text-base truncate">{repo.full_name}</span>
                                                    <span className="text-xs opacity-60 truncate font-mono">{repo.html_url}</span>
                                                </div>
                                                {repoUrl === repo.html_url && <Check className="ml-auto h-5 w-5 text-primary" />}
                                            </div>
                                        ))}
                                        {searchValue && !repos.find(r => r.html_url === searchValue) && (
                                            <div
                                                className="flex cursor-pointer items-center rounded-lg px-4 py-5 text-sm hover:bg-primary/10 text-primary font-bold border-t-2 border-dashed mt-2"
                                                onClick={() => selectRepo(searchValue)}
                                            >
                                                <ArrowRight className="mr-3 h-5 w-5 animate-pulse" />
                                                Connect custom URL: <span className="ml-2 font-mono opacity-80">{searchValue}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="registryName" className="text-sm font-bold uppercase tracking-wider opacity-70">Destination</Label>
                            <div className="relative">
                                <select
                                    id="registryName"
                                    className="flex h-12 w-full items-center justify-between rounded-md border-2 border-input bg-background px-4 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring appearance-none pr-10 font-medium"
                                    value={selectedRegistry}
                                    onChange={(e) => {
                                        setSelectedRegistry(e.target.value)
                                        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/)
                                        if (match) updateImageName(`${match[1]}/${match[2]}`.toLowerCase(), e.target.value)
                                    }}
                                >
                                    <option value="internal">Gitship Registry</option>
                                    {registries.map(reg => (
                                        <option key={reg.name} value={reg.name}>{reg.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                            <input 
                                type="hidden" 
                                name="registrySecretRef" 
                                value={selectedRegistry === "internal" ? "" : `gitship-registry-${selectedRegistry}`} 
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isDetected && (
                <Card className="border-border/60 shadow-xl bg-card/50 backdrop-blur-md animate-in slide-in-from-top-4 duration-700 overflow-visible">
                    <CardHeader className="bg-muted/20 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <Settings2 className="w-5 h-5" />
                            Application Settings
                        </CardTitle>
                        <CardDescription>Configure how your application should run in the cluster.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8 overflow-visible">
                        <div className="grid gap-8 md:grid-cols-2 overflow-visible">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-semibold">App Name</Label>
                                <Input id="name" name="name" value={appName} onChange={e => setAppName(e.target.value)} required className="h-12 border-2" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Deployment Source</Label>
                                <div className="flex gap-2">
                                    <div className="relative w-32 shrink-0">
                                        <select
                                            className="flex h-12 w-full items-center justify-between rounded-md border-2 border-input bg-background px-3 py-2 text-xs appearance-none pr-8 font-bold"
                                            value={sourceType}
                                            onChange={e => {
                                                setSourceType(e.target.value as any)
                                                setSearchQuery("")
                                            }}
                                            name="sourceType"
                                        >
                                            <option value="branch">Branch</option>
                                            <option value="tag">Tag</option>
                                            <option value="commit">Commit</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-4 h-3 w-3 text-muted-foreground pointer-events-none" />
                                    </div>
                                    
                                    <div className="relative flex-1" ref={dropdownRef}>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground z-10">
                                                {sourceType === "branch" && <GitBranch className="h-5 w-5" />}
                                                {sourceType === "tag" && <Tag className="h-5 w-5" />}
                                                {sourceType === "commit" && <Hash className="h-5 w-5" />}
                                            </div>
                                            <Input
                                                name="sourceValue"
                                                className="h-12 pl-10 border-2 font-mono text-sm pr-10"
                                                placeholder={`Search or enter ${sourceType}...`}
                                                value={isDropdownOpen ? searchQuery : sourceValue}
                                                onChange={e => {
                                                    setSearchQuery(e.target.value)
                                                    setSourceValue(e.target.value)
                                                    setDropdownOpen(true)
                                                }}
                                                onFocus={() => {
                                                    setSearchQuery("")
                                                    setDropdownOpen(true)
                                                }}
                                                required
                                            />
                                            <div 
                                                className="absolute right-3 top-4 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
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
                                                                    "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-all mb-0.5 last:mb-0",
                                                                    sourceValue === opt.value && "bg-accent border-l-4 border-l-primary pl-2"
                                                                )}
                                                                onClick={() => {
                                                                    setSourceValue(opt.value)
                                                                    setSearchQuery("")
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
                                                            No matches found.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 bg-muted/30 p-8 rounded-2xl border-2 border-dashed">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Port Mappings</Label>
                                    <p className="text-[10px] text-muted-foreground italic">Map Service ports to Container ports.</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={addPortMapping} className="h-8">
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Port
                                </Button>
                            </div>
                            
                            <div className="space-y-3">
                                {ports.map((p, idx) => (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border-2 rounded-xl bg-background shadow-sm animate-in zoom-in-95 duration-200">
                                        <div className="md:col-span-3 space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold opacity-70">Name</Label>
                                            <Input 
                                                placeholder="http" 
                                                value={p.name} 
                                                onChange={e => updatePortMapping(idx, "name", e.target.value)} 
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                        <div className="md:col-span-3 space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold opacity-70">Service Port</Label>
                                            <Input 
                                                type="number"
                                                value={p.port} 
                                                onChange={e => updatePortMapping(idx, "port", e.target.value)} 
                                                className="h-9 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex justify-center pb-2.5">
                                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" />
                                        </div>
                                        <div className="md:col-span-3 space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold opacity-70">Target Port</Label>
                                            <Input 
                                                type="number"
                                                value={p.targetPort} 
                                                onChange={e => updatePortMapping(idx, "targetPort", e.target.value)} 
                                                className="h-9 text-xs font-mono"
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex items-center gap-2">
                                            <select 
                                                className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-bold"
                                                value={p.protocol || "TCP"}
                                                onChange={e => updatePortMapping(idx, "protocol", e.target.value)}
                                            >
                                                <option value="TCP">TCP</option>
                                                <option value="UDP">UDP</option>
                                            </select>
                                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removePortMapping(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <input type="hidden" name="ports" value={JSON.stringify(ports)} />
                        </div>

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="imageName" className="text-sm font-semibold">Registry Image Path</Label>
                        <Input 
                            id="imageName" 
                            name="imageName" 
                            value={imageName}
                            onChange={e => setImageName(e.target.value)}
                            className={cn(
                                "h-12 font-mono text-sm border-2",
                                selectedRegistry === "internal" && "bg-muted/50 cursor-default opacity-80"
                            )}
                            required 
                            readOnly={selectedRegistry === "internal"}
                        />
                        {selectedRegistry === "internal" && (
                            <p className="text-[10px] text-muted-foreground italic">
                                Automatically managed for internal registry.
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="domain" className="text-sm font-semibold">Custom Domain (Optional)</Label>
                        <Input id="domain" name="domain" placeholder="myapp.example.com" value={domain} onChange={e => setDomain(e.target.value)} className="h-12 border-2" />
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-dashed">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Update Strategy
                        </Label>
                    </div>
                    <RadioGroup 
                        defaultValue="polling" 
                        value={updateStrategy} 
                        onValueChange={(v: "polling" | "webhook") => setUpdateStrategy(v)}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        <div>
                            <RadioGroupItem value="polling" id="polling" className="peer sr-only" />
                            <Label
                                htmlFor="polling"
                                className="flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
                            >
                                <span className="text-sm font-semibold mb-1">Automatic Polling</span>
                                <span className="text-xs text-muted-foreground mb-3">Checks for updates periodically.</span>
                                {updateStrategy === "polling" && (
                                    <div className="w-full mt-auto pt-2">
                                        <Label htmlFor="interval" className="text-[10px] uppercase font-bold opacity-70 mb-1 block">Check every</Label>
                                        <Input 
                                            id="interval" 
                                            value={pollInterval} 
                                            onChange={e => setPollInterval(e.target.value)} 
                                            className="h-8 font-mono text-sm bg-background" 
                                            placeholder="5m"
                                        />
                                    </div>
                                )}
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="webhook" id="webhook" className="peer sr-only" />
                            <Label
                                htmlFor="webhook"
                                className="flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
                            >
                                <span className="text-sm font-semibold mb-1">Webhook Trigger</span>
                                <span className="text-xs text-muted-foreground">Updates only when Gitship receives a webhook from GitHub. Best for performance.</span>
                            </Label>
                        </div>
                    </RadioGroup>
                    <input type="hidden" name="updateStrategy" value={updateStrategy} />
                    <input type="hidden" name="pollInterval" value={pollInterval} />
                </div>

                <div className="space-y-4 pt-4 border-t border-dashed">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Persistent Storage
                        </Label>
                        <Button type="button" size="sm" variant="outline" onClick={addVolume} className="h-8">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Volume
                        </Button>
                    </div>
                    
                    {volumes.length > 0 && (
                        <div className="grid gap-4">
                            {volumes.map((vol, idx) => (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-xl bg-muted/10 relative group">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Name</Label>
                                        <Input
                                            placeholder="data"
                                            value={vol.name}
                                            onChange={(e) => updateVolume(idx, "name", e.target.value)}
                                            className="h-9 text-sm font-mono bg-background"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Mount Path</Label>
                                        <Input
                                            placeholder="/app/data"
                                            value={vol.mountPath}
                                            onChange={(e) => updateVolume(idx, "mountPath", e.target.value)}
                                            className="h-9 text-sm font-mono bg-background"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase font-bold opacity-70">Size</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="1Gi"
                                                value={vol.size}
                                                onChange={(e) => updateVolume(idx, "size", e.target.value)}
                                                className="h-9 text-sm font-mono bg-background"
                                                required
                                            />
                                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeVolume(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <input type="hidden" name="volumes" value={JSON.stringify(volumes)} />
                </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t p-8">
                        <SubmitButton pending={isPending} />
                    </CardFooter>
                </Card>
            )}
        </div>

        {message && (
            <div className="mt-8 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-bold flex items-center gap-3 border-2 border-destructive/20 animate-in zoom-in-95">
                <AlertCircle className="w-6 h-6 shrink-0" /> {message}
            </div>
        )}
      </form>
    </div>
  )
}

function AlertCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    )
}
