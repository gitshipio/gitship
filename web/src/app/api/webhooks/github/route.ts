import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ""

// Internal URL of the controller manager webhook server
const CONTROLLER_WEBHOOK_URL =
    process.env.CONTROLLER_WEBHOOK_URL ||
    `http://controller-manager-webhook.${process.env.SYSTEM_NAMESPACE || "gitship-system"}.svc.cluster.local:3001/api/webhooks/github`

function verifySignature(payload: string, signature: string, secret: string): boolean {
    if (!secret) return true // No secret configured → skip verification (dev mode)
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(payload, "utf8")
    const expected = "sha256=" + hmac.digest("hex")
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.text()

        // 1. Verify GitHub signature if secret is configured
        if (WEBHOOK_SECRET) {
            const signature = req.headers.get("x-hub-signature-256") || ""
            if (!signature) {
                return NextResponse.json({ error: "Missing signature" }, { status: 401 })
            }
            if (!verifySignature(body, signature, WEBHOOK_SECRET)) {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
            }
        }

        // 2. Forward to the controller manager's webhook receiver
        const resp = await fetch(CONTROLLER_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Hub-Signature-256": req.headers.get("x-hub-signature-256") || "",
                "X-GitHub-Event": req.headers.get("x-github-event") || "",
                "X-GitHub-Delivery": req.headers.get("x-github-delivery") || "",
            },
            body,
        })

        const text = await resp.text()
        return new NextResponse(text, { status: resp.status })
    } catch (error) {
        console.error("[Webhook] Failed to process webhook:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
