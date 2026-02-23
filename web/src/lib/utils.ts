import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseResourceValue(val: string | number): number {
    if (val === undefined || val === null) return 0
    if (typeof val === 'number') return val
    const s = val.toString().toLowerCase()
    if (s.endsWith("m")) return parseFloat(s)
    if (s.endsWith("gi")) return parseFloat(s) * 1024 * 1024 * 1024
    if (s.endsWith("mi")) return parseFloat(s) * 1024 * 1024
    if (s.endsWith("ki")) return parseFloat(s) * 1024
    return parseFloat(s) * 1000 // Treat unitless as Cores -> Millicores
}

export function stripUnits(val: string | number | undefined, unit: 'cpu' | 'mem'): string {
    if (val === undefined || val === null) return "0"
    if (typeof val === 'number') return val.toString()
    const s = val.toString().toLowerCase()
    if (unit === 'cpu') {
        if (s.endsWith('m')) return s.replace('m', '')
        return (parseFloat(s) * 1000).toString()
    } else {
        if (s.endsWith('mi')) return s.replace('mi', '')
        if (s.endsWith('gi')) return (parseFloat(s) * 1024).toString()
        if (s.endsWith('ki')) return (parseFloat(s) / 1024).toString()
        return s
    }
}
