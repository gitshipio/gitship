import { auth } from "@/auth"
import { getGitshipApps } from "@/lib/api"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, ShieldAlert } from "lucide-react"
import { ensureGitshipUser, ensureGitHubSecret } from "@/lib/namespace"
import { RefreshTrigger } from "@/components/refresh-trigger"
import { getUserRole, resolveUserSession } from "@/lib/auth-utils"
import { DashboardTabs } from "@/components/dashboard-tabs"

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()
  let role = "restricted"

  let userNamespace = ""
  if (session?.user) {
    const { githubId, username, internalId, email } = resolveUserSession(session)
    
    // Ensure user record exists, keyed by GitHub ID
    await ensureGitshipUser(username, parseInt(githubId), email)
    userNamespace = `gitship-${internalId}` // Result: gitship-u-ID
    
    role = await getUserRole(internalId)

    if (role !== "restricted") {
        // Sync GitHub token to the namespace for the operator to use
        // @ts-expect-error session properties are dynamic
        if (session.accessToken) {
            // @ts-expect-error session properties are dynamic
            await ensureGitHubSecret(userNamespace, session.accessToken)
        }
    }
  }

  // Only fetch apps from the user's namespace to ensure multi-tenancy
  const appsList = (session && role !== "restricted") ? (await getGitshipApps(userNamespace)) : { items: [] }
  const hasApps = !!(appsList.items && appsList.items.length > 0)

  if (!session) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-muted/50 mb-8 border border-border/50 shadow-sm p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <DashboardTabs apps={appsList.items ?? []} hasApps={hasApps} />
        </div>
      </div>
    </main>
  )
}
