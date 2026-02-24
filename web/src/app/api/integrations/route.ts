import { auth } from "@/auth"
import { getGitshipIntegrations } from "@/lib/api"
import { NextResponse } from "next/server"
import { resolveUserSession, hasNamespaceAccess } from "@/lib/auth-utils"

export async function GET(req: Request) {
  const session = await auth()
  const { searchParams } = new URL(req.url)
  const namespace = searchParams.get("namespace")

  if (!namespace) return new NextResponse("Namespace required", { status: 400 })

  if (!(await hasNamespaceAccess(namespace, session))) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const integrations = await getGitshipIntegrations(namespace)
    return NextResponse.json({ items: integrations })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
