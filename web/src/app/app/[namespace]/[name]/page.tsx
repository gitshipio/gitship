
import { auth } from "@/auth"
import { getGitshipApp } from "@/lib/api"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { DeleteAppButton } from "@/components/delete-app-button"
import { AppDetailTabs } from "@/components/app-detail-tabs"
import { RefreshTrigger } from "@/components/refresh-trigger"

export default async function AppDetailsPage({ params }: { params: Promise<{ namespace: string; name: string }> }) {
    const session = await auth()
    if (!session) return <div>Access Denied</div>

    const { namespace, name } = await params
    const app = await getGitshipApp(name, namespace)

    if (!app) {
        notFound()
    }

    const statusColor = (phase: string) => {
        switch (phase) {
            case "Running": return "bg-green-500"
            case "Building":
            case "Deploying": return "bg-yellow-500"
            case "Failed": return "bg-red-500"
            default: return "bg-gray-500"
        }
    }

    return (
        <main className="min-h-screen p-8">
            <RefreshTrigger />
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </Link>

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                {app.metadata.name}
                                <Badge className={statusColor(app.status?.phase || "Unknown")}>
                                    {app.status?.phase || "Unknown"}
                                </Badge>
                            </h1>
                            <p className="text-muted-foreground mt-1">namespace: {app.metadata.namespace}</p>
                        </div>
                        <div className="flex gap-2">
                            {app.status?.appUrl && (
                                <Button asChild variant="outline">
                                    <Link href={app.status.appUrl} target="_blank">
                                        <ExternalLink className="w-4 h-4 mr-2" /> Open App
                                    </Link>
                                </Button>
                            )}
                            <DeleteAppButton name={app.metadata.name} namespace={app.metadata.namespace} />
                        </div>
                    </div>
                </div>

                {/* Tabbed Content */}
                <AppDetailTabs app={app} />

            </div>
        </main>
    )
}
