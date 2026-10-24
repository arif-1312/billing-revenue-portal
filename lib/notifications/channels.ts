export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export type EmailDeliveryStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED"

const EMAIL_ELIGIBLE_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_DUE_TODAY",
  "PAYMENT_DUE_SOON",
  "PAYMENT_RECEIVED",
  "PAYMENT_PARTIAL",
  "INVOICE_OVERDUE",
  "INVOICE_FULLY_PAID",
  "PO_EXPIRING_SOON",
  "PO_EXPIRED",
  "CONTRACT_EXPIRING_SOON",
  "CONTRACT_EXPIRED",
])

export type EmailIntent = {
  channel: "EMAIL"
  emailEligible: boolean
  emailStatus: EmailDeliveryStatus
  emailTemplateKey: string
}

/**
 * Phase 1 delivers the in-app channel only.
 * Eligible events keep a template key so phase 2 can set emailStatus to PENDING
 * and let a mailer claim those rows. This function never returns PENDING or SENT.
 */
export function emailIntentFor(eventType: string): EmailIntent {
  return {
    channel: "EMAIL",
    emailEligible: EMAIL_ELIGIBLE_EVENTS.has(eventType),
    emailStatus: "NOT_APPLICABLE",
    emailTemplateKey: eventType.toLowerCase(),
  }
}
