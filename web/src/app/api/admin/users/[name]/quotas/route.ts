import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { k8sCustomApi } from "@/lib/k8s"
import { isAdmin as checkAdmin } from "@/lib/auth-utils"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session: any = await auth()
  const username = session?.user?.githubUsername || session?.user?.name
  
  // Admin Check
  const isUserAdmin = await checkAdmin(username)
  if (!isUserAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name } = await params

  try {
    const { quotas } = await req.json()
    
    const patch = [
      {
        op: "add", // Use add to either create or replace the quotas object
        path: "/spec/quotas",
        value: quotas,
      },
    ]

    await k8sCustomApi.patchClusterCustomObject({
      group: "gitship.io",
      version: "v1alpha1",
      plural: "gitshipusers",
      name: name,
      body: patch,
    }, {
      headers: { "Content-Type": "application/json-patch+json" }
    } as any)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error(`[Admin] Failed to update quotas for ${name}:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
