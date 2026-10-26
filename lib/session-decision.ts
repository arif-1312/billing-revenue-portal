export type SessionDecision = "valid" | "invalid"

export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000

export function idleExpired(
  lastActive: unknown,
  now = Date.now(),
  idleMs = IDLE_TIMEOUT_MS,
) {
  const activeAt = Number(lastActive)
  if (!Number.isFinite(activeAt)) return false
  return now - activeAt > idleMs
}

export function isSignedInSession(
  session: { user?: { email?: string | null } | null } | null | undefined,
) {
  return Boolean(session?.user?.email)
}

export function decideSession(input: {
  status?: string | null
  currentFingerprint?: string | null
  tokenFingerprint?: string | null
  loggedOutAfterIssue: boolean
}): SessionDecision {
  if (input.status !== "ACTIVE") return "invalid"
  if (!input.currentFingerprint || !input.tokenFingerprint) return "invalid"
  if (input.currentFingerprint !== input.tokenFingerprint) return "invalid"
  if (input.loggedOutAfterIssue) return "invalid"
  return "valid"
}
