import { getGitshipUser } from "@/lib/api"

/**
 * Extract user identity information from a session.
 */
export function resolveUserSession(session: any) {
    if (!session?.user) return { githubId: "0", username: "unknown", internalId: "unknown" }
    
    const githubId = session.user.githubId || session.user.id || "0"
    const username = session.user.githubUsername || session.user.name || "unknown"
    const internalId = `u-${githubId}`
    
    return { githubId, username, internalId }
}

export async function isAdmin(internalId: string): Promise<boolean> {
    if (!internalId) return false
    
    try {
        const user = await getGitshipUser(internalId)
        return user?.spec?.role === "admin"
    } catch {
        return false
    }
}

export async function getUserRole(internalId: string): Promise<string> {
    if (!internalId) return "restricted"
    
    try {
        const user = await getGitshipUser(internalId)
        return user?.spec?.role || "restricted"
    } catch {
        return "restricted"
    }
}

/**
 * Check if the current session has access to a specific namespace.
 * Access is granted if the user is an admin or if the namespace belongs to them.
 */
export async function hasNamespaceAccess(namespace: string, session: any): Promise<boolean> {
    if (!session?.user) return false
    
    const { internalId } = resolveUserSession(session)
    const userNamespace = `gitship-${internalId}`
    
    // 1. Check if it's the user's own namespace
    if (namespace === userNamespace) return true
    
    // 2. Check if the user is an admin
    return await isAdmin(internalId)
}
