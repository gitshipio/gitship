import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getGitshipUser } from "@/lib/api"
import * as k8s from "@kubernetes/client-node"
import https from "https"
import { resolveUserSession } from "@/lib/auth-utils"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const registry = await req.json()
    const { internalId } = resolveUserSession(session)

    console.log(`[API] Updating registries for ${internalId}: ${registry.name}`)

    const user = await getGitshipUser(internalId)
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
    const url = `${cluster?.server}/apis/gitship.io/v1alpha1/gitshipusers/${internalId}`
    
    const opts: RequestInit & { agent?: https.Agent } = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/merge-patch+json',
        },
        body: JSON.stringify(patch),
        // Create an explicit agent that accepts self-signed certs (internal cluster)
        agent: new https.Agent({ rejectUnauthorized: false }),
    }
    // @ts-expect-error custom options for fetch
    await kc.applyToFetchOptions(opts)

    // applyToFetchOptions might overwrite agent, so we ensure ours takes precedence for local dev
    // In-cluster config uses CA certs, but for robustness against "fetch failed":
    if (!opts.agent) {
         opts.agent = new https.Agent({ rejectUnauthorized: false })
    }

    const response = await fetch(url, opts as RequestInit)

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`K8s API Error: ${errorText}`)
    }

    console.log(`[API] Successfully patched GitshipUser ${internalId}`)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    console.error(`[API] Failed to add registry:`, e.message)
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  
    try {
      const { name } = await req.json()
      const { internalId } = resolveUserSession(session)
  
      const user = await getGitshipUser(internalId)
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  
      const registries = user.spec.registries || []
      const filtered = registries.filter(r => r.name !== name)
  
      const kc = new k8s.KubeConfig()
      kc.loadFromDefault()
      const cluster = kc.getCurrentCluster()
      const url = `${cluster?.server}/apis/gitship.io/v1alpha1/gitshipusers/${internalId}`
      
      const patch = {
          spec: {
              registries: filtered
          }
      }

      const opts: RequestInit & { agent?: https.Agent } = {
          method: 'PATCH',
          headers: {
              'Content-Type': 'application/merge-patch+json',
          },
          body: JSON.stringify(patch),
          agent: new https.Agent({ rejectUnauthorized: false }),
      }
      // @ts-expect-error custom options for fetch
      await kc.applyToFetchOptions(opts)

      const response = await fetch(url, opts as RequestInit)
      if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`K8s API Error: ${errorText}`)
      }
  
      return NextResponse.json({ ok: true })
    } catch (e: unknown) {
      // @ts-expect-error dynamic access
      console.error(`[API] Failed to delete registry:`, e.message)
      // @ts-expect-error dynamic access
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
