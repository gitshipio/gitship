
"use client"

import { Button } from "@/components/ui/button"
import { deleteApp } from "@/lib/actions"
import { Trash2 } from "lucide-react"
import { useTransition } from "react"

export function DeleteAppButton({ name, namespace }: { name: string, namespace: string }) {
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => deleteApp(name, namespace))}
        >
            <Trash2 className="w-4 h-4 mr-2" />
            {isPending ? "Deleting..." : "Delete App"}
        </Button>
    )
}
