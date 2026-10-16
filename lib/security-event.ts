import { prisma } from "@/lib/prisma"

export type SecurityEventName =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PERMISSION_DENIED"

const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function recordSecurityEvent(input: {
  event: SecurityEventName
  username?: string | null
  userId?: string | null
  result: "success" | "failure"
  route?: string | null
  action?: string | null
}) {
  const username = input.username?.trim().slice(0, 200) || null
  const userId =
    input.userId && USER_ID_PATTERN.test(input.userId) ? input.userId : null

  try {
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        model: "SecurityEvent",
        userId,
        userName: username,
        after: {
          event: input.event,
          result: input.result,
          route: input.route ?? null,
          action: input.action ?? null,
        },
      },
    })
  } catch {
    console.error("Failed to record security event")
  }
}
