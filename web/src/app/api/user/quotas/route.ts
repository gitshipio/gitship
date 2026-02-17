import { auth } from "@/auth"
import { getUserQuotas } from "@/lib/api"
import { NextResponse } from "next/server"
import { resolveUserSession } from "@/lib/auth-utils"

export async function GET() {
  const session = await auth()
  const { internalId } = resolveUserSession(session)
  if (internalId === "unknown") return new NextResponse("Unauthorized", { status: 401 })

  try {
    const quotas = await getUserQuotas(internalId)
    return NextResponse.json(quotas)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
