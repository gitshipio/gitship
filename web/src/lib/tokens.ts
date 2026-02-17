import { SignJWT, jwtVerify } from "jose"

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dummy-secret-do-not-use-in-prod")

export async function createConsoleToken(namespace: string, podName: string, internalId: string) {
  return await new SignJWT({ namespace, podName, internalId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1m") // Valid for 1 minute only (handshake)
    .sign(SECRET)
}

export async function verifyConsoleToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { namespace: string; podName: string; internalId: string }
  } catch (e) {
    return null
  }
}
