const { WebSocketServer } = require("ws")
const k8s = require("@kubernetes/client-node")
const { Stream } = require("stream")
const { parse } = require("url")
const { createServer } = require("http")

const PORT = process.env.WS_PORT || 3001

console.log(`[WS Server] Starting on port ${PORT}...`)

const server = createServer((req, res) => {
    res.writeHead(200)
    res.end("Gitship Console WebSocket Server\n")
})

const wss = new WebSocketServer({ noServer: true })

server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url, true)

    // Match /api/console or just / since rewritten
    if (pathname === "/api/console" || pathname === "/") {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req, query)
        })
    } else {
        socket.destroy()
    }
})

wss.on("connection", async (ws, req, query) => {
    const { namespace, name, container } = query

    if (!namespace || !name) {
        ws.send("Error: namespace and pod name required\r\n")
        ws.close()
        return
    }

    console.log(`[Console] Connecting to ${namespace}/${name}`)

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
            name,
            container ?? name,
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
