import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getGitshipUser } from "@/lib/api"
import { k8sClusterMergePatch } from "@/lib/k8s"
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
    
    const patch = {
        spec: {
            registries: [...registries, registry]
        }
    }

    await k8sClusterMergePatch({
        group: "gitship.io",
        version: "v1alpha1",
        plural: "gitshipusers",
        name: internalId,
        body: patch
    })
    console.log(`[API] Successfully patched GitshipUser ${internalId}`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error(`[API] Failed to add registry:`, e.body?.message || e.message)
    return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
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
  
      const patch = {
          spec: {
              registries: filtered
          }
      }

      await k8sClusterMergePatch({
          group: "gitship.io",
          version: "v1alpha1",
          plural: "gitshipusers",
          name: internalId,
          body: patch
      })
      return NextResponse.json({ ok: true })
    } catch (e: any) {
      console.error(`[API] Failed to delete registry:`, e.body?.message || e.message)
      return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
    }
}
