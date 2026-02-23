"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function RefreshTrigger() {
    const router = useRouter()

    useEffect(() => {
        console.log("[RefreshTrigger] Establishing real-time connection...")
        
        let eventSource: EventSource | null = null
        let retryTimeout: ReturnType<typeof setTimeout> | null = null

        function setupEventSource() {
            eventSource = new EventSource("/api/events")

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log(`[RefreshTrigger] Resource update: ${data.name} (${data.type})`)
                    router.refresh()
                } catch {
                    // Ignore keep-alive or malformed data
                }
            }

            eventSource.onerror = (err) => {
                console.warn("[RefreshTrigger] SSE connection lost. Retrying in 5s...", err)
                if (eventSource) {
                    eventSource.close()
                    eventSource = null
                }
                
                // Retry after 5 seconds
                if (!retryTimeout) {
                    retryTimeout = setTimeout(() => {
                        retryTimeout = null
                        setupEventSource()
                    }, 5000)
                }
            }
        }

        setupEventSource()

        return () => {
            if (eventSource) eventSource.close()
            if (retryTimeout) clearTimeout(retryTimeout)
        }
    }, [router])

    return null
}
