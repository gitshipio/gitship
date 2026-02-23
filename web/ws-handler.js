/* eslint-disable @typescript-eslint/no-require-imports */
const { WebSocketServer } = require("ws")
/* eslint-disable @typescript-eslint/no-require-imports */
const k8s = require("@kubernetes/client-node")
const { Stream } = require("stream")
const { parse } = require("url")

module.exports = function attachWebSocketServer(app) {
    console.error("[WS Handler] initializing...")

    if (!app) {
        console.error("[WS Handler] Error: app is undefined")
        return
    }

    // app is the NextNodeServer.
    // In standalone mode, startServer resolves to the app instance.
    // app.server is the http.Server
    const server = app.server || app

    if (!server || !server.on) {
        console.error("[WS Handler] Could not find HTTP server to attach to. Keys:", Object.keys(app))
        return
    }

    const wss = new WebSocketServer({ noServer: true })
    console.error("[WS Handler] WebSocketServer created")

    server.on("upgrade", (req, socket, head) => {
        const { pathname, query } = parse(req.url, true)

        if (pathname === "/api/console") {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req, query)
            })
        }
    })

    wss.on("connection", async (ws, req, query) => {
        const { namespace, name, container } = query

        if (!namespace || !name) {
            ws.send("Error: namespace and pod name required\r\n")
            ws.close()
            return
        }

        console.error(`[Console] Connecting to ${namespace}/${name}`)

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

    console.error("[WS Handler] Attached successfully")
}
