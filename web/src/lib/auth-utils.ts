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
