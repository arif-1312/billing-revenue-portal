import type { LoginLimitState } from "@/lib/login-rate-limit"

export function loginFailureFeedback(state: LoginLimitState) {
  const minutes = Math.max(1, Math.ceil(state.retryAfterSeconds / 60))
  return {
    success: false as const,
    attemptsRemaining: state.attemptsRemaining,
    retryAfterSeconds: state.retryAfterSeconds,
    message: state.locked
      ? `Too many failed attempts. Login is blocked. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
      : `Invalid username or password. ${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? "" : "s"} remaining before a 30-minute lockout.`,
  }
}
