import { auth } from "@/auth"
import { getUserQuotas } from "@/lib/api"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  const username = (session?.user as any)?.githubUsername || session?.user?.name
  if (!username) return new NextResponse("Unauthorized", { status: 401 })

  try {
    const quotas = await getUserQuotas(username)
    return NextResponse.json(quotas)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
