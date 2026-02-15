import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getGitshipUser } from "@/lib/api"
import * as k8s from "@kubernetes/client-node"
import https from "https"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const registry = await req.json()
    const rawUsername = (session.user as any).githubUsername || session.user.name || "unknown"
    const username = rawUsername.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")

    console.log(`[API] Updating registries for ${username}: ${registry.name}`)

    const user = await getGitshipUser(username)
    if (!user) return NextResponse.json({ error: "User profile not found" }, { status: 404 })

    const registries = user.spec.registries || []
    if (registries.some(r => r.name === registry.name)) {
        return NextResponse.json({ error: "Registry already exists" }, { status: 400 })
    }
    
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()
    
    const patch = {
        spec: {
            registries: [...registries, registry]
        }
    }

    const cluster = kc.getCurrentCluster()
    const url = `${cluster?.server}/apis/gitship.io/v1alpha1/gitshipusers/${username}`
    
    const opts: any = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/merge-patch+json',
        },
        body: JSON.stringify(patch),
        // Create an explicit agent that accepts self-signed certs (internal cluster)
        agent: new https.Agent({ rejectUnauthorized: false }),
    }
    await kc.applyToFetchOptions(opts)

    // applyToFetchOptions might overwrite agent, so we ensure ours takes precedence for local dev
    // In-cluster config uses CA certs, but for robustness against "fetch failed":
    if (!opts.agent) {
         opts.agent = new https.Agent({ rejectUnauthorized: false })
    }

    const response = await fetch(url, opts)

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`K8s API Error: ${errorText}`)
    }

    console.log(`[API] Successfully patched GitshipUser ${username}`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error(`[API] Failed to add registry:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  
    try {
      const { name } = await req.json()
      const rawUsername = (session.user as any).githubUsername || session.user.name || "unknown"
      const username = rawUsername.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  
      const user = await getGitshipUser(username)
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  
      const registries = user.spec.registries || []
      const filtered = registries.filter(r => r.name !== name)
  
      const kc = new k8s.KubeConfig()
      kc.loadFromDefault()
      const cluster = kc.getCurrentCluster()
      const url = `${cluster?.server}/apis/gitship.io/v1alpha1/gitshipusers/${username}`
      
      const patch = {
          spec: {
              registries: filtered
          }
      }

      const opts: any = {
          method: 'PATCH',
          headers: {
              'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify(patch),
          agent: new https.Agent({ rejectUnauthorized: false }),
      }
      await kc.applyToFetchOptions(opts)

      const response = await fetch(url, opts)
      if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`K8s API Error: ${errorText}`)
      }
  
      return NextResponse.json({ ok: true })
    } catch (e: any) {
      console.error(`[API] Failed to delete registry:`, e.message)
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
