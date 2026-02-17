import { auth } from "@/auth"
import { getGitshipUsers, getGitshipAppsAdmin, getClusterNodes, getStorageClasses } from "@/lib/api"
import { isAdmin as checkAdmin, resolveUserSession } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { AdminDashboardUI } from "@/components/admin-dashboard"
import { ensureGitshipUser } from "@/lib/namespace"

export default async function AdminPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin")
    }

    const { username, githubId, internalId } = resolveUserSession(session)
    
    // Ensure user record exists (triggers migration for legacy admins)
    await ensureGitshipUser(username, parseInt(githubId))
    
    const isUserAdmin = await checkAdmin(internalId)
    
    // Strict Role Check
    if (!isUserAdmin) {
        redirect("/")
    }

    const [users, apps, nodes, storageClasses] = await Promise.all([
        getGitshipUsers(),
        getGitshipAppsAdmin(), // Use explicit admin function
        getClusterNodes(),
        getStorageClasses()
    ])

    // Convert class instances to plain JSON objects for Client Component serialization
    const plainData = JSON.parse(JSON.stringify({
        users,
        apps,
        nodes,
        storageClasses
    }))

    return (
        <AdminDashboardUI 
            users={plainData.users} 
            apps={plainData.apps} 
            nodes={plainData.nodes} 
            storageClasses={plainData.storageClasses} 
        />
    )
}
