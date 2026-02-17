"use client"

import { useEffect, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { Button } from "./ui/button"
import { Loader2 } from "lucide-react"
import { generateConsoleTokenAction } from "@/app/actions/console"

interface AppConsoleProps {
    namespace: string
    appName: string
    podName: string
}

export function AppConsole({ namespace, appName, podName }: AppConsoleProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!podName || !terminalRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#09090b', // Zinc-950
                foreground: '#f4f4f5', // Zinc-50
            }
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)
        fitAddon.fit()

        const connect = async () => {
            try {
                // 1. Get secure token from server action (verified session)
                const token = await generateConsoleTokenAction(namespace, podName)
                
                // 2. Connect with token
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
                const host = window.location.host
                const url = `${protocol}//${host}/api/console?token=${token}`
                
                const ws = new WebSocket(url)
                wsRef.current = ws

                ws.onopen = () => {
                    setIsConnected(true)
                    setError(null)
                    term.writeln('\x1b[32m[Gitship] Connected to container shell.\x1b[0m
')
                }

                ws.onmessage = (event) => {
                    term.write(event.data)
                }

                ws.onclose = (event) => {
                    setIsConnected(false)
                    if (event.code !== 1000) {
                        term.writeln('
\x1b[31m[Gitship] Connection closed.\x1b[0m')
                    }
                }

                ws.onerror = () => {
                    setError("Connection failed")
                    setIsConnected(false)
                }

                term.onData((data) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(data)
                    }
                })

                const resizeObserver = new ResizeObserver(() => fitAddon.fit())
                resizeObserver.observe(terminalRef.current!)

                return () => {
                    ws.close()
                    term.dispose()
                    resizeObserver.disconnect()
                }
            } catch (err: any) {
                setError(err.message || "Failed to authorize console session")
                term.writeln(`
\x1b[31m[Error] ${err.message}\x1b[0m`)
            }
        }

        connect()

        return () => {
            wsRef.current?.close()
            term.dispose()
        }
    }, [namespace, podName])

    return (
        <div className="flex flex-col h-[500px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-zinc-500 font-mono">
                    {isConnected ? 'Connected' : error ? 'Error' : 'Connecting...'}
                </span>
            </div>
            <div ref={terminalRef} className="flex-1 w-full h-full p-2" />
        </div>
    )
}
