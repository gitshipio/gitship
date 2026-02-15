import { auth } from "@/auth"
import { getGitshipUser, getGitshipApps, getUserQuotas } from "@/lib/api"
import { isAdmin as checkAdmin } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { UserAdminDetailUI } from "@/components/user-admin-detail"

export default async function UserAdminPage({ params }: { params: Promise<{ name: string }> }) {
    const session = await auth()
    const username = (session?.user as any)?.githubUsername || session?.user?.name
    
    // Admin Check
    const isUserAdmin = await checkAdmin(username)
    if (!isUserAdmin) redirect("/")

    const { name } = await params
    
    // Fetch user data
    const user = await getGitshipUser(name)
    if (!user) redirect("/admin?tab=users")

    // Fetch user apps (scoped to their namespace)
    const sanitized = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
    const namespace = `gitship-user-${sanitized}`
    
    const [apps, quotas] = await Promise.all([
        getGitshipApps(namespace),
        getUserQuotas(name)
    ])

    // Convert to plain objects
    const plainData = JSON.parse(JSON.stringify({
        user,
        apps: apps.items || [],
        quotas
    }))

    return (
        <UserAdminDetailUI 
            user={plainData.user} 
            apps={plainData.apps} 
            quotas={plainData.quotas} 
        />
    )
}
