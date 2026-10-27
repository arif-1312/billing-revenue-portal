import { createHash, randomBytes } from "node:crypto"

export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000

export const RESET_REQUEST_MESSAGE =
  "If an account exists with the provided details, a password reset link has been sent to the registered email address."

export const RESET_SUCCESS_MESSAGE =
  "Your password has been reset successfully. Please log in using your new password."

const COMMON_PASSWORDS = new Set([
  "password1234",
  "password12345",
  "admin123456",
  "administrator1",
  "welcome12345",
  "qwerty123456",
  "letmein12345",
  "changeme1234",
  "billingportal",
  "iloveyou1234",
])

export function isCommonPassword(password: string) {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase())
}

export function createResetToken() {
  return randomBytes(32).toString("base64url")
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function resetExpiry(now: Date) {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS)
}

export function tokenIsUsable(input: {
  usedAt: Date | null
  expiresAt: Date
  now: Date
}) {
  return input.usedAt == null && input.expiresAt.getTime() > input.now.getTime()
}

export function resetPasswordUrl(origin: string, token: string) {
  if (!origin || token.length < 32 || /[\r\n\s]/.test(token)) return null
  let base: URL
  try {
    base = new URL(origin)
  } catch {
    return null
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") return null
  const url = new URL("/reset-password", base.origin)
  url.searchParams.set("token", token)
  return url.toString()
}
