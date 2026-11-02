import { prisma } from "@/lib/prisma"
import { passwordFingerprint } from "@/lib/password"
import { requestCache } from "@/lib/request-cache"
import { decideSession } from "@/lib/session-decision"
import { touchActiveLogin } from "@/lib/active-login"

const loadSessionDecision = requestCache(
  async (userId: string, issuedAtMs: number, tokenFingerprint: string, sessionId: string) => {
    const issuedAt = new Date(issuedAtMs)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, password: true },
    })

    if (sessionId) {
      const decision = decideSession({
        status: user?.status,
        currentFingerprint: user?.password ? passwordFingerprint(user.password) : null,
        tokenFingerprint,
        loggedOutAfterIssue: false,
      })
      if (decision !== "valid") return decision
      return await touchActiveLogin(userId, sessionId, tokenFingerprint) ? "valid" : "invalid"
    }

    const logout = await prisma.auditLog.findFirst({
      where: {
        userId,
        model: "SecurityEvent",
        createdAt: { gt: issuedAt },
        after: {
          path: ["event"],
          equals: "LOGOUT",
        },
      },
      select: { id: true },
    })

    return decideSession({
      status: user?.status,
      currentFingerprint: user?.password
        ? passwordFingerprint(user.password)
        : null,
      tokenFingerprint: tokenFingerprint || undefined,
      loggedOutAfterIssue: Boolean(logout),
    })
  },
)

export async function readSessionDecision(input: {
  userId: string
  issuedAt: Date
  tokenFingerprint?: string
  sessionId?: string
}) {
  return loadSessionDecision(
    input.userId,
    input.issuedAt.getTime(),
    input.tokenFingerprint ?? "",
    input.sessionId ?? "",
  )
}
