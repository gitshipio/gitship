import { auth } from "@/auth"
import { kc } from "@/lib/k8s"
import * as k8s from "@kubernetes/client-node"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const user = session.user?.name || session.user?.email
  if (!user) return new Response("User not found", { status: 400 })

  const sanitized = user.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "")
  const namespace = `gitship-user-${sanitized}`

  const stream = new ReadableStream({
    async start(controller) {
      const watch = new k8s.Watch(kc)
      const encoder = new TextEncoder()

      // Keep-alive interval
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"))
        } catch (e) {
          clearInterval(keepAlive)
        }
      }, 30000)

      const watchPath = `/apis/gitship.io/v1alpha1/namespaces/${namespace}/gitshipapps`
      
      console.log(`[SSE] Starting watch for ${user} in ${namespace}...`)

      try {
        const watchReq = await watch.watch(
          watchPath,
          {},
          (type, obj) => {
            const event = {
              type,
              name: obj.metadata?.name,
              phase: obj.status?.phase,
              resourceVersion: obj.metadata?.resourceVersion
            }
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } catch (e) {
              // Stream likely closed
            }
          },
          (err) => {
            console.error("[SSE] Watch closed:", err)
            clearInterval(keepAlive)
            try { controller.close() } catch {}
          }
        )

        // Abort controller for cleanup
        req.signal.addEventListener('abort', () => {
            console.log(`[SSE] Request aborted for ${user}`)
            clearInterval(keepAlive)
            try { watchReq.abort() } catch {}
        })

      } catch (err: any) {
        console.error("[SSE] Watch setup failed:", err.message)
        clearInterval(keepAlive)
        try { controller.close() } catch {}
      }
    },
    cancel() {
      console.log(`[SSE] Stream cancelled for ${user}`)
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
