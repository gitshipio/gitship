import { auth } from "@/auth"
import { kc } from "@/lib/k8s"
import * as k8s from "@kubernetes/client-node"
import { resolveUserSession } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { username, internalId } = resolveUserSession(session)
  const namespace = `gitship-${internalId}`

  const stream = new ReadableStream({
    async start(controller) {
      const watch = new k8s.Watch(kc)
      const encoder = new TextEncoder()

      // Keep-alive interval
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"))
        } catch {
          clearInterval(keepAlive)
        }
      }, 30000)

      const watchPath = `/apis/gitship.io/v1alpha1/namespaces/${namespace}/gitshipapps`
      
      console.log(`[SSE] Starting watch for ${username} in ${namespace}...`)

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
            } catch {
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
            console.log(`[SSE] Request aborted for ${username}`)
            clearInterval(keepAlive)
            try { watchReq.abort() } catch {}
        })

      } catch (err: unknown) {
        // @ts-expect-error dynamic access
        console.error("[SSE] Watch setup failed:", err.message)
        clearInterval(keepAlive)
        try { controller.close() } catch {}
      }
    },
    cancel() {
      console.log(`[SSE] Stream cancelled for ${username}`)
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
