import { auth } from "@/auth"
import { getGitshipUsers, getGitshipApps, getClusterNodes, getStorageClasses } from "@/lib/api"
import { isAdmin as checkAdmin } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { AdminDashboardUI } from "@/components/admin-dashboard"

export default async function AdminPage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin")
    }

    const username = (session.user as any).githubUsername || session.user.name || "unknown"
    
    const isUserAdmin = await checkAdmin(username)
    
    // Strict Role Check
    if (!isUserAdmin) {
        redirect("/")
    }

    const [users, apps, nodes, storageClasses] = await Promise.all([
        getGitshipUsers(),
        getGitshipApps(), // ALL namespaces
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
