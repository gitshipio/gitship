"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export function UserRoleSelector({ username, currentRole }: { username: string, currentRole: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const updateRole = async (newRole: string) => {
        if (newRole === currentRole) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/users/${username}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            })
            if (res.ok) {
                router.refresh()
            } else {
                alert("Failed to update role")
            }
        } catch (e: any) {
            alert(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Select disabled={loading} onValueChange={updateRole} defaultValue={currentRole || "user"}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Standard User</SelectItem>
                    <SelectItem value="restricted">Registry Only</SelectItem>
                </SelectContent>
            </Select>
            {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
    )
}
