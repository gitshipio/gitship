import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { resolveUserSession } from "@/lib/auth-utils"
import { getGitshipIntegrations } from "@/lib/api"
import { k8sCustomApi } from "@/lib/k8s"

export async function GET() {
    const session = await auth()
    const { internalId } = resolveUserSession(session)
    if (internalId === "unknown") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const namespace = `gitship-${internalId}`
    const integrations = await getGitshipIntegrations(namespace)
    return NextResponse.json(integrations)
}

export async function POST(req: NextRequest) {
    const session = await auth()
    const { internalId } = resolveUserSession(session)
    if (internalId === "unknown") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const namespace = `gitship-${internalId}`
    try {
        const { type, name, config } = await req.json()

        const integration = {
            apiVersion: "gitship.io/v1alpha1",
            kind: "GitshipIntegration",
            metadata: {
                name,
                namespace
            },
            spec: {
                type,
                config,
                enabled: true
            }
        }

        await k8sCustomApi.createNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipintegrations",
            body: integration
        })

        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        console.error("[API] Failed to create integration:", e.message)
        // @ts-expect-error dynamic access
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const session = await auth()
    const { internalId } = resolveUserSession(session)
    if (internalId === "unknown") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const namespace = `gitship-${internalId}`
    try {
        const { name, patch: patchData } = await req.json()

        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

        console.log(`[API] PATCH GitshipIntegration ${name} in ${namespace}:`, JSON.stringify(patchData))

        if (Object.keys(patchData.spec || {}).length === 0) return NextResponse.json({ ok: true })

        const patch = {
            spec: patchData.spec
        }

        await k8sCustomApi.patchNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipintegrations",
            name,
            body: patch
        }, {
            headers: { "Content-Type": "application/merge-patch+json" }
        })

        console.log(`[API] SUCCESS: Patched GitshipIntegration ${name} in ${namespace}`)
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        console.error("[API] Failed to patch integration:", e.message)
        // @ts-expect-error dynamic access
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth()
    const { internalId } = resolveUserSession(session)
    if (internalId === "unknown") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const namespace = `gitship-${internalId}`
    const { searchParams } = new URL(req.url)
    const name = searchParams.get("name")

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    try {
        await k8sCustomApi.deleteNamespacedCustomObject({
            group: "gitship.io",
            version: "v1alpha1",
            namespace,
            plural: "gitshipintegrations",
            name
        })
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        // @ts-expect-error dynamic access
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
