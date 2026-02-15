"use client"

import { useState } from "react"
import { GitshipApp } from "@/lib/types"
import { GitshipAppCard } from "@/components/gitship-app-card"
import { AppSearch } from "@/components/app-search"

export function AppGrid({ apps }: { apps: GitshipApp[] }) {
    const [search, setSearch] = useState("")

    const filtered = apps.filter((app) =>
        app.metadata.name.toLowerCase().includes(search.toLowerCase()) ||
        app.spec.repoUrl.toLowerCase().includes(search.toLowerCase()) ||
        app.metadata.namespace.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {apps.length > 0 && (
                <div className="flex justify-between items-center">
                    <AppSearch value={search} onChange={setSearch} total={apps.length} />
                    {/* Filter dropdowns could go here later */}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((app) => (
                    <GitshipAppCard key={app.metadata.uid} app={app} />
                ))}
                {apps.length > 0 && filtered.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed rounded-lg bg-muted/5">
                        <p>No apps matching &quot;{search}&quot;</p>
                        <button 
                            onClick={() => setSearch("")} 
                            className="mt-2 text-primary hover:underline text-sm"
                        >
                            Clear search
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
