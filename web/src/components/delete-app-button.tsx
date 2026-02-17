"use client"

import { Button } from "@/components/ui/button"
import { deleteApp } from "@/lib/actions"
import { Trash2, AlertTriangle } from "lucide-react"
import { useTransition, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function DeleteAppButton({ name, namespace }: { name: string, namespace: string }) {
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)

    const handleDelete = () => {
        startTransition(async () => {
            await deleteApp(name, namespace)
            setOpen(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete App
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-destructive mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        <DialogTitle>Delete Application</DialogTitle>
                    </div>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone. 
                        All associated deployments, services, and ingresses will be removed.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button 
                        variant="destructive" 
                        onClick={handleDelete} 
                        disabled={isPending}
                    >
                        {isPending ? "Deleting..." : "Confirm Delete"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
