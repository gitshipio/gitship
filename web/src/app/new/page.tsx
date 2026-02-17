import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { NewAppForm } from "./form"
import { getUserRepositories } from "@/lib/github"
import { getGitshipUser } from "@/lib/api"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resolveUserSession } from "@/lib/auth-utils"

export default async function NewAppPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin")
    }

    const { internalId } = resolveUserSession(session)

    const [repos, user] = await Promise.all([
        getUserRepositories(),
        getGitshipUser(internalId)
    ])

    const githubAppName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME

    return (
        <main className="flex min-h-[calc(100vh-60px)] flex-col items-center pt-12 md:pt-20 px-4 pb-40">
            <div className="w-full max-w-3xl">
                <h1 className="text-4xl font-extrabold mb-10 text-center tracking-tight">Deploy New Application</h1>
                
                {repos.length === 0 ? (
                    <div className="text-center space-y-6 p-8 border-2 border-dashed rounded-xl bg-muted/5">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Plus className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold">No Repositories Accessible</h2>
                            <p className="text-muted-foreground text-sm">
                                Gitship needs permission to access your repositories. 
                                Please install the GitHub App on your account.
                            </p>
                        </div>
                        <Button asChild size="lg" className="w-full">
                            <a href={`https://github.com/apps/${githubAppName}/installations/new`} target="_blank">
                                Connect GitHub Repositories
                            </a>
                        </Button>
                        <p className="text-[10px] text-muted-foreground italic">
                            Tip: After installation, refresh this page.
                        </p>
                    </div>
                ) : (
                    <NewAppForm repos={repos} registries={user?.spec.registries} />
                )}
            </div>
        </main>
    )
}
