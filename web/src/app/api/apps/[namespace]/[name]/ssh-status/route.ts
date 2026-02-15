import { auth } from "@/auth"
import { k8sCoreApi } from "@/lib/k8s"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ namespace: string; name: string }> }
) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { namespace, name } = await params
  const secretName = `${name}-ssh-key`

  try {
    await k8sCoreApi.readNamespacedSecret({ name: secretName, namespace })
    return NextResponse.json({ exists: true })
  } catch (e) {
    return NextResponse.json({ exists: false })
  }
}
