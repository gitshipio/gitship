import { auth } from "@/auth"
import { getUserQuotas } from "@/lib/api"
import { NextResponse, NextRequest } from "next/server"
import { resolveUserSession } from "@/lib/auth-utils"
import { k8sCustomApi } from "@/lib/k8s"

export async function GET() {
  const session = await auth()
  const { internalId } = resolveUserSession(session)
  if (internalId === "unknown") return new NextResponse("Unauthorized", { status: 401 })

  try {
    const quotas = await getUserQuotas(internalId)
    return NextResponse.json(quotas)
  } catch (e: unknown) {
    // @ts-expect-error dynamic access
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
    const session = await auth()
    const { internalId } = resolveUserSession(session)
    if (internalId === "unknown") return new NextResponse("Unauthorized", { status: 401 })

    try {
        const body = await req.json()
        
        // Ensure we only patch the quotas field for security
        const patch = {
            spec: {
                quotas: body.spec.quotas
            }
        }

        await k8sCustomApi.patchClusterCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            plural: "gitshipusers",
            name: internalId,
            body: patch,
            options: {
                headers: { "Content-Type": "application/merge-patch+json" }
            }
        })

        return NextResponse.json({ ok: true })
    } catch (e: any) {
        console.error("[API] Failed to update user quotas:", e.body?.message || e.message)
        return NextResponse.json({ error: e.body?.message || e.message }, { status: 500 })
    }
}
