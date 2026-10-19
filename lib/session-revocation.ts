import { prisma } from "@/lib/prisma"
import { passwordFingerprint } from "@/lib/password"
import { decideSession } from "@/lib/session-decision"

export async function readSessionDecision(input: {
  userId: string
  issuedAt: Date
  tokenFingerprint?: string
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { status: true, password: true },
  })

  let loggedOutAfterIssue = false

  try {
    const logout = await prisma.auditLog.findFirst({
      where: {
        userId: input.userId,
        model: "SecurityEvent",
        createdAt: { gt: input.issuedAt },
        after: {
          path: ["event"],
          equals: "LOGOUT",
        },
      },
      select: { id: true },
    })
    loggedOutAfterIssue = Boolean(logout)
  } catch {
    loggedOutAfterIssue = false
  }

  return decideSession({
    status: user?.status,
    currentFingerprint: user?.password
      ? passwordFingerprint(user.password)
      : null,
    tokenFingerprint: input.tokenFingerprint,
    loggedOutAfterIssue,
  })
}
