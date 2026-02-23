"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe, Network, Save, Loader2, Lock, Plus, Trash2, ArrowRight, ChevronDown, Copy, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface AppServicesProps {
  appName: string
  namespace: string
  serviceType?: string
  initialIngresses?: { host: string; path?: string; servicePort: number; tls?: boolean }[]
  initialPorts?: { name?: string; port: number; targetPort: number; protocol?: string }[]
  tls?: { issuer?: string } // Global TLS settings like issuer
}

interface ServiceInfo {
  name: string
  type: string
  clusterIP: string
  ports: { port: number; targetPort: number; protocol: string }[]
}

interface IngressInfo {
  name: string
  hosts: string[]
  paths: { path: string; service: string; port: number }[]
}

export function AppServices({ appName, namespace, initialIngresses, initialPorts }: AppServicesProps) {
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [ingressesStatus, setIngressStatus] = useState<IngressInfo[]>([])
  const [loading, setLoading] = useState(true)
  
  const [ports, setPorts] = useState(initialPorts || [{ name: "http", port: 80, targetPort: 8080, protocol: "TCP" }])
  const [ingresses, setIngresses] = useState(initialIngresses || [])
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState("")

  const addPortMapping = () => setPorts([...ports, { name: "", port: 80, targetPort: 80, protocol: "TCP" }])
  const removePortMapping = (idx: number) => setPorts(ports.filter((_, i) => i !== idx))
  const updatePortMapping = (idx: number, field: string, val: string | number) => {
    const updated = [...ports]
    // @ts-expect-error known dynamic access
    updated[idx][field] = val
    setPorts(updated)
  }

  const addIngressRule = () => setIngresses([...ingresses, { host: "", path: "/", servicePort: ports[0]?.port || 80, tls: false }])
  const removeIngressRule = (idx: number) => setIngresses(ingresses.filter((_, i) => i !== idx))
  const updateIngressRule = (idx: number, field: string, val: string | number | boolean) => {
    const updated = [...ingresses]
    // @ts-expect-error known dynamic access
    updated[idx][field] = val
    setIngresses(updated)
  }

  const fetchNetworking = useCallback(async () => {
    if (!appName || !namespace) return
    try {
      const res = await fetch(`/api/apps/${namespace}/${appName}/networking`)
      if (res.ok) {
        const data = await res.json()
        setServices(data.services || [])
        setIngressStatus(data.ingresses || [])
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }, [appName, namespace])

  useEffect(() => {
    fetchNetworking()
  }, [fetchNetworking])

  // GUARD
  if (!appName || !namespace) return <div className="p-8 text-center text-muted-foreground italic">Networking info unavailable.</div>

  const handleSave = () => {
    startTransition(async () => {
        try {
            const patch = {
                spec: {
                    ports: ports.map(p => ({
                        ...p,
                        port: Number(p.port) || 80,
                        targetPort: Number(p.targetPort) || 80,
                    })),
                    ingresses: ingresses.map(ing => ({
                        ...ing,
                        servicePort: Number(ing.servicePort) || 80,
                        tls: !!ing.tls
                    })),
                    // Set global TLS enabled if at least one ingress has it
                    tls: {
                        enabled: ingresses.some(i => i.tls)
                    }
                },
            }
            const res = await fetch(`/api/apps/${namespace}/${appName}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            })
            if (res.ok) {
                setMessage("Networking settings saved!")
                fetchNetworking()
            } else {
                setMessage("Failed to save.")
            }
        } catch (e: unknown) {
            // @ts-expect-error dynamic access
            setMessage(`Error: ${e.message}`)
        }
    })
  }

  return (
    <div className="space-y-8">
      {/* 1. Internal Service & Ports */}
      <Card className="border-primary/10 shadow-sm overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/5 py-4">
            <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Network className="w-5 h-5 text-primary" />
                    Service Port Mappings
                </CardTitle>
                <CardDescription className="text-xs">Map external Service ports to internal Container ports.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addPortMapping} className="h-8 font-bold border-2">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Mapping
            </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
            {ports.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4">No ports configured.</p>
            )}
            <div className="grid gap-3">
                {ports.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 border-2 rounded-2xl bg-background hover:border-primary/20 transition-colors animate-in zoom-in-95 duration-200">
                        <div className="md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold opacity-70">Port Name (Optional)</Label>
                            <Input 
                                placeholder="e.g. web, api" 
                                value={p.name} 
                                onChange={e => updatePortMapping(idx, "name", e.target.value)} 
                                className="h-10 text-xs border-2 shadow-sm"
                            />
                        </div>
                        <div className="md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold opacity-70">Service Port</Label>
                            <Input 
                                type="number"
                                value={p.port} 
                                onChange={e => updatePortMapping(idx, "port", e.target.value)} 
                                className="h-10 text-sm font-mono border-2"
                            />
                        </div>
                        <div className="md:col-span-1 flex justify-center pb-2.5">
                            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-20" />
                        </div>
                        <div className="md:col-span-3 space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold opacity-70">Container Port</Label>
                            <Input 
                                type="number"
                                value={p.targetPort} 
                                onChange={e => updatePortMapping(idx, "targetPort", e.target.value)} 
                                className="h-10 text-sm font-mono border-2"
                            />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2">
                            <select 
                                className="flex h-10 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                value={p.protocol || "TCP"}
                                onChange={e => updatePortMapping(idx, "protocol", e.target.value)}
                            >
                                <option value="TCP">TCP</option>
                                <option value="UDP">UDP</option>
                            </select>
                            <Button size="icon" variant="ghost" onClick={() => removePortMapping(idx)} className="text-destructive h-10 w-10 hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      {/* 2. Public Access (Ingress) */}
      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/5 py-4 flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Public Access (Ingress)
                </CardTitle>
                <CardDescription className="text-xs">Configure your domains and map them to specific service ports.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addIngressRule} className="h-8 font-bold border-2">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Domain Rule
            </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
            {ingresses.length === 0 && (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-muted/5">
                    <p className="text-sm text-muted-foreground italic">No domains configured. Your app is only reachable internally.</p>
                </div>
            )}
            
            <div className="space-y-4">
                {ingresses.map((ing, idx) => (
                    <IngressRuleRow 
                        key={idx}
                        rule={ing}
                        availablePorts={ports}
                        onUpdate={(field: string, val: string | number | boolean) => updateIngressRule(idx, field, val)}
                        onRemove={() => removeIngressRule(idx)}
                    />
                ))}
            </div>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-4 flex items-center justify-between">
            <Button onClick={handleSave} disabled={isPending} className="gap-2 px-8 shadow-lg shadow-primary/20 h-11">
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Apply Networking Changes
            </Button>
            {message && (
                <span className={`text-sm font-bold animate-in fade-in slide-in-from-right-2 ${message.includes("Error") || message.includes("Failed") ? "text-destructive" : "text-emerald-600"}`}>
                    {message}
                </span>
            )}
        </CardFooter>
      </Card>

      {/* 3. Status Overview (Read-Only) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-80 scale-95 origin-top transition-transform hover:scale-100 duration-500">
          <Card>
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-xs uppercase font-black opacity-50">Live K8s Services</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : services.length > 0 ? (
                    <div className="space-y-3">
                        {services.map(svc => (
                            <div key={svc.name} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs p-2 border rounded bg-muted/5">
                                    <span className="font-bold">{svc.name}</span>
                                    <div className="flex gap-1">
                                        {svc.ports.map((p, i) => (
                                            <Badge key={i} variant="outline" className="text-[9px]">{p.port}:{p.targetPort}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <InternalDomainItem domain={`${svc.name}.${namespace}.svc.cluster.local`} />
                            </div>
                        ))}
                    </div>
                ) : <p className="text-[10px] text-center italic">No services discovered.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-xs uppercase font-black opacity-50">Live K8s Ingress</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : ingressesStatus.length > 0 ? (
                    <div className="space-y-2">
                        {ingressesStatus.map(ing => (
                            <div key={ing.name} className="p-2 border rounded bg-muted/5 space-y-1">
                                <p className="text-[10px] font-bold">{ing.name}</p>
                                {ing.hosts.map(h => <p key={h} className="text-[10px] text-blue-500 underline truncate">{h}</p>)}
                            </div>
                        ))}
                    </div>
                ) : <p className="text-[10px] text-center italic">No ingress discovered.</p>}
            </CardContent>
          </Card>
      </div>
    </div>
  )
}

function IngressRuleRow({ rule, availablePorts, onUpdate, onRemove }: {
    rule: { host: string; path?: string; servicePort: number; tls?: boolean },
    availablePorts: { name?: string; port: number }[],
    onUpdate: (field: string, val: string | number | boolean) => void,
    onRemove: () => void
}) {
    const [advanced, setAdvanced] = useState(!!rule.path && rule.path !== "/")

    return (
        <div className="p-4 border-2 rounded-2xl bg-background hover:border-primary/20 transition-colors space-y-4 shadow-sm animate-in fade-in zoom-in-95">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold opacity-70">Domain Host</Label>
                    <Input 
                        placeholder="myapp.example.com" 
                        value={rule.host} 
                        onChange={e => onUpdate("host", e.target.value)} 
                        className="h-10 text-sm font-mono border-2"
                    />
                </div>
                
                <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold opacity-70">Target Service Port</Label>
                    <div className="relative">
                        <select
                            className="flex h-10 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-xs appearance-none pr-8 font-bold outline-none"
                            value={rule.servicePort}
                            onChange={(e) => onUpdate("servicePort", Number(e.target.value))}
                        >
                            {availablePorts.map((p, i) => (
                                <option key={i} value={p.port}>
                                    {p.name || `Port ${p.port}`} ({p.port})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-3.5 h-3 w-3 text-muted-foreground pointer-events-none" />
                    </div>
                </div>

                <div className="md:col-span-3 flex items-center justify-between p-2 border-2 rounded-lg bg-muted/5 h-10">
                    <div className="flex items-center gap-2">
                        <Lock className={cn("w-3.5 h-3.5", rule.tls ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-[10px] font-bold uppercase opacity-70">HTTPS</span>
                    </div>
                    <Switch checked={!!rule.tls} onCheckedChange={(v) => onUpdate("tls", v)} className="scale-75" />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2">
                    <div className="flex flex-col items-center gap-1 group/adv">
                        <Label className="text-[8px] uppercase font-black opacity-30 group-hover/adv:opacity-60 transition-opacity">Adv</Label>
                        <Switch checked={advanced} onCheckedChange={setAdvanced} className="scale-75" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={onRemove} className="text-destructive h-10 w-10 hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {advanced && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="md:col-span-5 space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold opacity-70">Path Prefix</Label>
                        <Input 
                            placeholder="/" 
                            value={rule.path} 
                            onChange={e => onUpdate("path", e.target.value)} 
                            className="h-9 text-xs font-mono bg-muted/30 border-2"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

function InternalDomainItem({ domain }: { domain: string }) {
    const [copied, setCopied] = useState(false)

    const copyToClipboard = () => {
        navigator.clipboard.writeText(domain)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="group/item flex items-center gap-2 p-1.5 px-2 rounded-md bg-sky-500/5 border border-sky-500/10 transition-colors hover:bg-sky-500/10">
            <Badge variant="outline" className="text-[8px] uppercase font-black bg-sky-500/10 text-sky-600 border-sky-500/20 px-1 h-3.5 shrink-0">Internal DNS</Badge>
            <code className="text-[9px] font-mono text-sky-700 dark:text-sky-300 truncate flex-1">{domain}</code>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 opacity-0 group-hover/item:opacity-100 transition-opacity" 
                onClick={copyToClipboard}
            >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-sky-600" />}
            </Button>
        </div>
    )
}
