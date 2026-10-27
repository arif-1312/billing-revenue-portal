import { isEmailEligibleEvent } from "@/lib/email/policy"

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export type EmailDeliveryStatus =
  | "NOT_APPLICABLE"
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED"

export type EmailIntent = {
  channel: "EMAIL"
  emailEligible: boolean
  emailStatus: EmailDeliveryStatus
  emailTemplateKey: string
}

export function emailIntentFor(eventType: string): EmailIntent {
  const emailEligible = isEmailEligibleEvent(eventType)
  return {
    channel: "EMAIL",
    emailEligible,
    emailStatus: emailEligible ? "PENDING" : "NOT_APPLICABLE",
    emailTemplateKey: eventType.toLowerCase(),
  }
}
