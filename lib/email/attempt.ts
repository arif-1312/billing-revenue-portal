import type { SmtpConfig } from "./config"
import { normalizeEmailAddress } from "./address"
import { renderNotificationEmail } from "./template"
import { renderPasswordChangedEmail, renderPasswordResetEmail } from "./auth-mail"
import { decryptSecret } from "@/lib/secret-box"
import {
  classifyDeliveryError,
  deliveryOutcome,
  sanitizeEmailError,
} from "./outcome"
import type { OutboundMail } from "./mime"

export type DeliveryPayload = {
  recipientName: string
  title: string
  body: string
  category: string
  eventType: string
  poNumber: string
  invoiceNumber: string
  companyName: string
  customerName: string
  href: string
  occurredAt: string
  secureLink: string
}

export type DeliveryJob = {
  recipientEmail: string
  cc: string[]
  bcc: string[]
  subject: string
  attemptCount: number
  maxAttempts: number
  payload: unknown
  templateKey?: string
}

export type MailTransport = (mail: OutboundMail) => Promise<void>

export async function attemptDelivery(input: {
  job: DeliveryJob
  config: SmtpConfig | null
  transport: MailTransport
  now: Date
  portalName: string
  baseUrl?: string
}) {
  const recipient = normalizeEmailAddress(input.job.recipientEmail)
  if (!recipient) {
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: "permanent",
      now: input.now,
      error: "Invalid recipient address",
    })
  }

  if (!input.config) {
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: "deferred",
      now: input.now,
      error: "Email service is not configured.",
    })
  }

  const payload = readPayload(input.job.payload)
  if (!payload) {
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: "permanent",
      now: input.now,
      error: "Email content is incomplete.",
    })
  }

  let rendered: { text: string; html: string }
  try {
    rendered = renderDelivery(input.job.templateKey, payload, input.portalName, input.baseUrl)
  } catch {
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: "permanent",
      now: input.now,
      error: "Email content is incomplete.",
    })
  }

  try {
    await input.transport({
      fromName: input.config.fromName,
      fromAddress: input.config.fromAddress,
      to: [recipient],
      cc: input.job.cc,
      bcc: input.job.bcc,
      subject: input.job.subject,
      text: rendered.text,
      html: rendered.html,
    })
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: "sent",
      now: input.now,
    })
  } catch (error) {
    return deliveryOutcome({
      attemptCount: input.job.attemptCount,
      maxAttempts: input.job.maxAttempts,
      result: classifyDeliveryError(error),
      now: input.now,
      error: sanitizeEmailError(error),
    })
  }
}

export function readPayload(value: unknown): DeliveryPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const text = (key: string) => (typeof row[key] === "string" ? row[key] : "")
  const title = text("title")
  const body = text("body")
  if (!title && !body) return null

  return {
    recipientName: text("recipientName") || "there",
    title: title || "Notification",
    body,
    category: text("category"),
    eventType: text("eventType"),
    poNumber: text("poNumber"),
    invoiceNumber: text("invoiceNumber"),
    companyName: text("companyName"),
    customerName: text("customerName"),
    href: text("href"),
    occurredAt: text("occurredAt"),
    secureLink: text("secureLink"),
  }
}

function renderDelivery(
  templateKey: string | undefined,
  payload: DeliveryPayload,
  portalName: string,
  baseUrl?: string,
) {
  if (templateKey === "password_reset") {
    const resetUrl = decryptSecret(payload.secureLink)
    const origin = baseUrl || ""
    if (!origin || !resetUrl.startsWith(`${origin}/reset-password?token=`)) {
      throw new Error("Email content is incomplete.")
    }
    return renderPasswordResetEmail({
      portalName,
      recipientName: payload.recipientName,
      resetUrl,
    })
  }

  if (templateKey === "password_changed") {
    return renderPasswordChangedEmail({
      portalName,
      recipientName: payload.recipientName,
      when: payload.occurredAt || new Date().toISOString(),
    })
  }

  return renderNotificationEmail({
    ...payload,
    portalName,
    baseUrl,
  })
}
