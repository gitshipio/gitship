import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  // @ts-expect-error dynamic property
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")

  if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 })

  try {
    // Parse owner and repo from URL (works for https://github.com/owner/repo)
    const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/)
    if (!match) return NextResponse.json({ error: "Only GitHub URLs are currently supported for auto-detection" }, { status: 400 })

    const [, owner, repoName] = match
    // @ts-expect-error dynamic property
    const token = session.accessToken

    // 1. Fetch Branches
    const branchesRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!branchesRes.ok) {
        if (branchesRes.status === 404) return NextResponse.json({ error: "Repository not found or access denied." }, { status: 404 })
        throw new Error("Failed to fetch branches")
    }

    const branches = await branchesRes.json()

    // 2. Fetch Tags
    const tagsRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/tags`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    const tags = await tagsRes.json()

    // 3. Fetch Latest Commits
    const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=10`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    const commits = await commitsRes.json()

    // 4. Try to find Dockerfile and guess Port
    const contentRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/Dockerfile`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    
    let detectedPort = 8080
    if (contentRes.ok) {
        const dockerfile = await contentRes.json()
        const content = Buffer.from(dockerfile.content, 'base64').toString('utf-8')
        const exposeMatch = content.match(/EXPOSE\s+(\d+)/i)
        if (exposeMatch) {
            detectedPort = parseInt(exposeMatch[1])
        }
    }

    return NextResponse.json({
      branches: Array.isArray(branches) ? branches.map((b: { name: string }) => b.name) : ["main"],
      tags: Array.isArray(tags) ? tags.map((t: { name: string }) => t.name) : [],
      latestCommits: Array.isArray(commits) ? commits.map((c: { sha: string, commit: { message: string } }) => ({ sha: c.sha, message: c.commit.message })) : [],
      detectedPort,
      suggestedName: repoName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
