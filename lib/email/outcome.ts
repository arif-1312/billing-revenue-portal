export const MAX_EMAIL_ATTEMPTS = 5
export const STALE_EMAIL_LOCK_MINUTES = 10
export const UNCONFIGURED_RETRY_MS = 15 * 60 * 1000

export type EmailJobState = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "RETRYING"

export type NotificationEmailState =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED"

export function retryDelayMs(attemptCount: number) {
  const exponent = Math.min(6, Math.max(1, attemptCount))
  return 2 ** exponent * 60 * 1000
}

export function classifyDeliveryError(error: unknown): "temporary" | "permanent" {
  const message = error instanceof Error ? error.message : ""
  if (/invalid recipient|invalid email address|refusing to send/i.test(message)) {
    return "permanent"
  }
  const code = Number(message.match(/\b([245]\d{2})\b/)?.[1] ?? 0)
  if (code >= 500) return "permanent"
  return "temporary"
}

export function sanitizeEmailError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Email delivery failed"
  const cleaned = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/pass(?:word)?\s*[=:]\s*\S+/gi, "password=[redacted]")
    .replace(/AUTH\s+\S+/gi, "AUTH [redacted]")
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, "[redacted]")
    .replace(/postgres:\/\/\S+/gi, "[redacted]")
    .slice(0, 500)
    .trim()

  if (/smtp_password|DATABASE_URL|CONFIG_ENCRYPTION_KEY|AUTH_SECRET/i.test(cleaned)) {
    return "Email delivery failed"
  }

  return cleaned || "Email delivery failed"
}

export function deliveryOutcome(input: {
  attemptCount: number
  maxAttempts: number
  result: "sent" | "temporary" | "permanent" | "deferred"
  now: Date
  error?: string | null
}) {
  if (input.result === "deferred") {
    return {
      status: "PENDING" as const,
      attemptCount: input.attemptCount,
      nextAttemptAt: new Date(input.now.getTime() + UNCONFIGURED_RETRY_MS),
      sentAt: null,
      lastError: input.error?.trim() || "Email service is not configured.",
      lastAttemptAt: null,
    }
  }

  const attemptCount = input.attemptCount + 1
  const lastError = input.error?.trim() || "Email delivery failed."

  if (input.result === "sent") {
    return {
      status: "SENT" as const,
      attemptCount,
      nextAttemptAt: input.now,
      sentAt: input.now,
      lastError: null,
      lastAttemptAt: input.now,
    }
  }

  if (input.result === "permanent" || attemptCount >= input.maxAttempts) {
    return {
      status: "FAILED" as const,
      attemptCount,
      nextAttemptAt: input.now,
      sentAt: null,
      lastError,
      lastAttemptAt: input.now,
    }
  }

  return {
    status: "RETRYING" as const,
    attemptCount,
    nextAttemptAt: new Date(input.now.getTime() + retryDelayMs(attemptCount)),
    sentAt: null,
    lastError,
    lastAttemptAt: input.now,
  }
}

export function summarizeEmailJobs(
  counts: Partial<Record<EmailJobState, number>>,
): NotificationEmailState {
  const open =
    (counts.PENDING ?? 0) + (counts.PROCESSING ?? 0) + (counts.RETRYING ?? 0)
  if (open > 0) return "PENDING"
  if ((counts.SENT ?? 0) > 0) return "SENT"
  if ((counts.FAILED ?? 0) > 0) return "FAILED"
  return "SKIPPED"
}
