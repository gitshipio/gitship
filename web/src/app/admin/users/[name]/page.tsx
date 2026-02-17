import { auth } from "@/auth"
import { getGitshipUser, getGitshipApps, getUserQuotas } from "@/lib/api"
import { isAdmin as checkAdmin, resolveUserSession } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { UserAdminDetailUI } from "@/components/user-admin-detail"

export default async function UserAdminPage({ params }: { params: Promise<{ name: string }> }) {
    const session = await auth()
    const { internalId: adminId } = resolveUserSession(session)
    
    // Admin Check
    const isUserAdmin = await checkAdmin(adminId)
    if (!isUserAdmin) redirect("/")

    const { name: userInternalId } = await params
    
    // Fetch user data
    const user = await getGitshipUser(userInternalId)
    if (!user) redirect("/admin?tab=users")

    // Fetch user apps (scoped to their namespace)
    const namespace = userInternalId.startsWith("u-") 
        ? `gitship-${userInternalId}` 
        : `gitship-user-${userInternalId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")}`
    
    const [apps, quotas] = await Promise.all([
        getGitshipApps(namespace),
        getUserQuotas(userInternalId)
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
