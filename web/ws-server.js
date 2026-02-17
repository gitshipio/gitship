const { WebSocketServer } = require("ws")
const k8s = require("@kubernetes/client-node")
const { Stream } = require("stream")
const { parse } = require("url")
const { createServer } = require("http")
const { jwtVerify } = require("jose")

const PORT = process.env.WS_PORT || 3001
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dummy-secret-do-not-use-in-prod")

console.log(`[WS Server] Starting on port ${PORT}...`)

const server = createServer((req, res) => {
    res.writeHead(200)
    res.end("Gitship Console WebSocket Server\n")
})

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true)

    // Match /api/console or just / since rewritten
    if (pathname === "/api/console" || pathname === "/") {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req)
        })
    } else {
        socket.destroy()
    }
})

wss.on("connection", async (ws, req) => {
    const { query } = parse(req.url, true)
    const token = query.token

    if (!token) {
        ws.send("Error: Authorization token required\r\n")
        ws.close()
        return
    }

    let payload
    try {
        const verified = await jwtVerify(token, SECRET)
        payload = verified.payload
    } catch (e) {
        console.error("Token verification failed:", e.message)
        ws.send("Error: Invalid or expired token\r\n")
        ws.close()
        return
    }

    const { namespace, podName } = payload
    const container = query.container

    console.log(`[Console] Connecting to ${namespace}/${podName} (Authorized)`)

    try {
        const kc = new k8s.KubeConfig()
        kc.loadFromDefault()

        const wsOutputStream = new Stream.Writable({
            write(chunk, encoding, next) {
                if (ws.readyState === ws.OPEN) {
                    ws.send(chunk)
                }
                next()
            }
        })

        const inputStream = new Stream.PassThrough()

        ws.on('message', (data) => {
            inputStream.write(data)
        })

        const realExec = new k8s.Exec(kc)

        realExec.exec(
            namespace,
            podName,
            container ?? "app", // Default to 'app' container
            ['/bin/sh', '-c', 'TERM=xterm-256color /bin/sh'],
            wsOutputStream,
            wsOutputStream,
            inputStream,
            true,
            (status) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(`\r\n[Disconnected: ${status?.status || 'Unknown'}]\r\n`)
                    ws.close()
                }
            }
        ).catch(e => {
            console.error("Exec failed:", e)
            try { ws.send(`\r\nError executing command: ${e.message}\r\n`); ws.close(); } catch { }
        })

        ws.on('close', () => {
            inputStream.end()
        })

    } catch (e) {
        console.error("[Console] K8s Error:", e)
        try { ws.send(`Error: ${e.message}\r\n`); ws.close(); } catch { }
    }
})

server.listen(PORT, () => {
    console.log(`[WS Server] Ready on port ${PORT}`)
})
