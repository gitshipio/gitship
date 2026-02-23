import { auth } from "@/auth"
import { getGitshipUser } from "@/lib/api"
import { RegistrySettings } from "@/components/registry-settings"
import { GitHubAppSettings } from "@/components/github-app-settings"
import { getGitHubInstallation } from "@/lib/github"
import { redirect } from "next/navigation"
import { resolveUserSession } from "@/lib/auth-utils"
import { ensureGitshipUser } from "@/lib/namespace"

export default async function SettingsPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin")
    }

    const { username, githubId, internalId, email } = resolveUserSession(session)
    
    // Ensure user record exists
    await ensureGitshipUser(username, parseInt(githubId), email)
    
    const [user, installation] = await Promise.all([
        getGitshipUser(internalId),
        getGitHubInstallation()
    ])

    if (!user) {
        return (
            <main className="container max-w-4xl py-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-destructive">User profile not found. Try logging out and back in.</p>
                </div>
            </main>
        )
    }

    return (
        <main className="flex-1 container max-w-screen-2xl mx-auto px-4 md:px-8 py-10 space-y-10">
            {/* Header */}
            <div className="flex items-center gap-4 pb-6 border-b border-border/40">
                <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-border shadow-sm shrink-0">
                    {session.user.image ? (
                        <img src={session.user.image} alt={username} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center text-xl font-bold">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{session.user.name}</h1>
                    <p className="text-muted-foreground font-mono text-sm">@{username}</p>
                </div>
            </div>

            {/* Content - Narrower for better readability but aligned to the container */}
            <div className="max-w-4xl space-y-12">
                <section className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold">GitHub Connection</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Control which repositories Gitship can access.
                        </p>
                    </div>
                    <GitHubAppSettings installations={installation} />
                </section>

                <section className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold">Container Registries</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Configure private registries to push and pull your application images.
                        </p>
                    </div>
                    <RegistrySettings registries={user.spec.registries} />
                </section>
            </div>
        </main>
    )
}
