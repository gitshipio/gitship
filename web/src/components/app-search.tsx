"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface AppSearchProps {
    value: string
    onChange: (value: string) => void
    total: number
}

export function AppSearch({ value, onChange, total }: AppSearchProps) {
    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder={`Search ${total} apps...`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-9"
            />
        </div>
    )
}
