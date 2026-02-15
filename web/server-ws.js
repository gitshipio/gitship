const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { WebSocketServer } = require("ws")
const k8s = require("@kubernetes/client-node")
const { Stream } = require("stream")

const dev = process.env.NODE_ENV !== "production"
const hostname = "0.0.0.0"
const port = parseInt(process.env.PORT || "3000", 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true)
            await handle(req, res, parsedUrl)
        } catch (err) {
            console.error("Error occurred handling", req.url, err)
            res.statusCode = 500
            res.end("internal server error")
        }
    })

    console.log("[Server] Initializing WebSocket Server for Console...")
    const wss = new WebSocketServer({ noServer: true })

    server.on("upgrade", (req, socket, head) => {
        const { pathname, query } = parse(req.url, true)

        if (pathname === "/api/console") {
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
                ws.send(`\r\nError executing command: ${e.message}\r\n`)
                ws.close()
            })

            ws.on('close', () => {
                inputStream.end()
            })

        } catch (e) {
            console.error("[Console] K8s Error:", e)
            ws.send(`Error: ${e.message}\r\n`)
            ws.close()
        }
    })

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port} (Custom Server with WebSocket)`)
    })
})
