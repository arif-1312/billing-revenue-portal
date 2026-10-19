export type SessionDecision = "valid" | "invalid"

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
