import { auth } from "@/auth"
import { getGitshipApps, getUserQuotas } from "@/lib/api"
import { AppGrid } from "@/components/app-grid"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, PackageOpen, LayoutGrid, Activity, ShieldAlert } from "lucide-react"
import { ensureGitshipUser, ensureGitHubSecret } from "@/lib/namespace"
import { RefreshTrigger } from "@/components/refresh-trigger"
import { ResourceUsage } from "@/components/resource-usage"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserMonitoring } from "@/components/user-monitoring"
import { getUserRole, resolveUserSession } from "@/lib/auth-utils"

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()
  let quotas = null
  let role = "restricted"

  if (session?.user) {
    const { githubId, username, internalId } = resolveUserSession(session)
    
    // Ensure user record exists, keyed by GitHub ID
    await ensureGitshipUser(username, parseInt(githubId))
    const namespace = `gitship-${internalId}` // Result: gitship-u-ID
    
    role = await getUserRole(internalId)

    if (role !== "restricted") {
        // Sync GitHub token to the namespace for the operator to use
        if ((session as any).accessToken) {
            await ensureGitHubSecret(namespace, (session as any).accessToken)
        }

        quotas = await getUserQuotas(internalId)
    }
  }

  // List all apps the user has access to (across all namespaces)
  // Only fetch apps if user is not restricted
  const appsList = (session && role !== "restricted") ? (await getGitshipApps()) : { items: [] }
  const plainQuotas = quotas ? JSON.parse(JSON.stringify(quotas)) : null
  const hasApps = appsList.items && appsList.items.length > 0

  if (!session) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-muted/50 mb-8 border border-border/50 shadow-sm p-4">
            <img src="/logo.svg" alt="Gitship Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
          Deploy from Git to Kubernetes.
        </h1>
        <p className="mb-8 text-muted-foreground text-lg max-w-[600px] leading-relaxed">
          Zero configuration. Push your code, and Gitship handles the build, deployment, and scaling instantly.
        </p>
        <Button asChild size="lg" className="h-12 px-8 text-base font-medium shadow-lg shadow-primary/20">
          <Link href="/api/auth/signin">Continue with GitHub</Link>
        </Button>
      </div>
    )
  }

  if (role === "restricted") {
    return (
        <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-amber-500/10 mb-8 ring-8 ring-amber-500/5 rotate-3">
                <ShieldAlert className="h-12 w-12 text-amber-500" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl mb-4">
                Account Pending Approval
            </h1>
            <p className="mb-8 text-muted-foreground text-lg max-w-[500px] leading-relaxed">
                Your account has been created but requires administrator approval before you can deploy applications. 
                <br /><br />
                Please contact your platform administrator to activate your access.
            </p>
            <div className="flex gap-4">
                <Button variant="outline" asChild>
                    <Link href="/api/auth/signout">Sign Out</Link>
                </Button>
                <Button asChild>
                    <Link href="https://github.com/gitshipio/gitship" target="_blank">View Documentation</Link>
                </Button>
            </div>
        </div>
    )
  }

  return (
    <main className="flex-1 space-y-8 p-4 md:p-8 pt-10 container max-w-screen-2xl mx-auto">
      <RefreshTrigger />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-4 border-b border-border/40">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage your applications.
          </p>
        </div>
        <Button asChild className="h-12 md:h-10 shadow-lg shadow-primary/20 font-bold px-6">
            <Link href="/new">
                <Plus className="mr-2 h-4 w-4" /> Deploy New Project
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Main Content (Full Width) */}
        <div className="space-y-8">
            <Tabs defaultValue="apps" className="space-y-8">
                <div className="flex items-center justify-between border-b pb-1">
                    <TabsList className="bg-transparent h-auto p-0 gap-6">
                        <TabsTrigger 
                            value="apps" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 gap-2 font-bold text-lg"
                        >
                            <LayoutGrid className="w-5 h-5" />
                            Applications
                        </TabsTrigger>
                        <TabsTrigger 
                            value="monitoring" 
                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 gap-2 font-bold text-lg"
                        >
                            <Activity className="w-5 h-5" />
                            Live Stats
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="apps" className="space-y-8 mt-0 border-none p-0 outline-none">
                    {!hasApps ? (
                        <div className="flex h-[450px] shrink-0 items-center justify-center rounded-2xl border-4 border-dashed border-muted bg-muted/5">
                            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-muted/50 mb-6 ring-8 ring-muted/20 rotate-3">
                                    <PackageOpen className="h-12 w-12 text-muted-foreground" />
                                </div>
                                <h3 className="text-2xl font-bold">No applications found</h3>
                                <p className="mb-6 mt-2 text-muted-foreground text-pretty">
                                    Connect your first Git repository to start deploying to the cluster.
                                </p>
                                <Button asChild size="lg" className="rounded-xl">
                                    <Link href="/new">
                                        <Plus className="mr-2 h-5 w-5" /> Deploy your first app
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                            <AppGrid apps={appsList.items ?? []} />
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="monitoring" className="mt-0 border-none p-0 outline-none">
                    <UserMonitoring />
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </main>
  )
}
