
import { auth } from "@/auth"

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  private: boolean
  updated_at: string
}

export async function getGitHubInstallation() {
  const session = await auth()
  // @ts-expect-error accessToken is not typed
  const token = session?.accessToken

  if (!token) return null

  try {
    // 1. Get All Installations (Personal + Organizations)
    const instRes = await fetch("https://api.github.com/user/installations", {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const instData = await instRes.json()
    
    if (!instData.installations || instData.installations.length === 0) return null

    // 2. Fetch Repositories for ALL installations
    const allInstallations = await Promise.all(instData.installations.map(async (inst: any) => {
        const repoRes = await fetch(`https://api.github.com/user/installations/${inst.id}/repositories`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
            },
            cache: 'no-store'
        })
        const repoData = await repoRes.json()
        return {
            id: inst.id,
            account: inst.account.login,
            account_avatar: inst.account.avatar_url,
            repository_selection: inst.repository_selection,
            repositories: (repoData.repositories || []) as GitHubRepo[],
            html_url: inst.html_url
        }
    }))

    return allInstallations
  } catch (e) {
    console.error("Error fetching GitHub installations:", e)
    return null
  }
}

export async function getUserRepositories(): Promise<GitHubRepo[]> {
  const session = await auth()
  // @ts-expect-error accessToken is not typed in default session
  const token = session?.accessToken

  if (!token) return []

  try {
    // To get all repos (including orgs where app is installed), 
    // it's more reliable to list installations first.
    const instRes = await fetch("https://api.github.com/user/installations", {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const instData = await instRes.json()
    
    if (!instData.installations || instData.installations.length === 0) {
        // Fallback to standard repos call if no app installations found
        const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100&visibility=all", {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
            cache: 'no-store'
        })
        const data = await res.json()
        return (data || []) as GitHubRepo[]
    }

    // Fetch from all installations
    const repoPromises = instData.installations.map(async (inst: any) => {
        const res = await fetch(`https://api.github.com/user/installations/${inst.id}/repositories?per_page=100`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
            cache: 'no-store'
        })
        const data = await res.json()
        return (data.repositories || []) as GitHubRepo[]
    })

    const repoResults = await Promise.all(repoPromises)
    const allRepos = repoResults.flat()

    // Sort by updated_at
    return allRepos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  } catch (error) {
    console.error("DEBUG: Error fetching repos:", error)
    return []
  }
}

export async function createRepositoryWebhook(owner: string, repo: string, webhookUrl: string, token: string): Promise<boolean> {
  try {
    // 1. Check existing hooks to avoid duplicates
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        headers: { 
            Authorization: `Bearer ${token}`, 
            Accept: "application/vnd.github.v3+json" 
        },
    })
    
    if (checkRes.ok) {
        const hooks = await checkRes.json()
        const exists = hooks.some((h: any) => h.config.url === webhookUrl)
        if (exists) {
            console.log(`[GitHub] Webhook already exists for ${owner}/${repo}`)
            return true
        }
    }

    // 2. Create Hook
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        method: "POST",
        headers: { 
            Authorization: `Bearer ${token}`, 
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: "web",
            active: true,
            events: ["push"],
            config: {
                url: webhookUrl,
                content_type: "json",
                insecure_ssl: "0" // Enforce SSL
            }
        })
    })

    if (!res.ok) {
        const err = await res.text()
        console.error(`[GitHub] Failed to create webhook: ${err}`)
        return false
    }

    return true
  } catch (error) {
    console.error(`[GitHub] Error creating webhook for ${owner}/${repo}:`, error)
    return false
  }
}

export async function addDeployKey(owner: string, repo: string, publicKey: string, title: string, token: string): Promise<boolean> {
  try {
    // 1. Check existing keys (to avoid duplicates/errors)
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/keys`, {
        headers: { 
            Authorization: `Bearer ${token}`, 
            Accept: "application/vnd.github.v3+json" 
        },
    })
    
    if (checkRes.ok) {
        const keys = await checkRes.json()
        const exists = keys.some((k: any) => k.key.trim() === publicKey.trim())
        if (exists) {
            console.log(`[GitHub] Deploy key already exists for ${owner}/${repo}`)
            return true
        }
    }

    // 2. Add Key
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/keys`, {
        method: "POST",
        headers: { 
            Authorization: `Bearer ${token}`, 
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            title: title,
            key: publicKey,
            read_only: true
        })
    })

    if (!res.ok) {
        const err = await res.text()
        console.error(`[GitHub] Failed to add deploy key: ${err}`)
        return false
    }

    return true
  } catch (error) {
    console.error(`[GitHub] Error adding deploy key for ${owner}/${repo}:`, error)
    return false
  }
}
