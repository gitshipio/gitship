import { getGitshipUser } from "@/lib/api"

export async function isAdmin(username: string): Promise<boolean> {
    if (!username) return false
    
    // Sanitize username to match CRD naming convention
    const sanitized = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
    
    try {
        const user = await getGitshipUser(sanitized)
        return user?.spec?.role === "admin"
    } catch {
        return false
    }
}

export async function getUserRole(username: string): Promise<string> {
    if (!username) return "restricted"
    
    // Sanitize username
    const sanitized = username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
    
    try {
        const user = await getGitshipUser(sanitized)
        return user?.spec?.role || "restricted"
    } catch {
        return "restricted"
    }
}
