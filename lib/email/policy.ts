import type { NotificationCategory } from "@/lib/notifications/types"

export const EMAIL_ELIGIBLE_EVENTS = new Set([
  "PO_CREATED",
  "PO_UPDATED",
  "PO_CLOSED",
  "PO_EXPIRING_SOON",
  "PO_EXPIRED",
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "INVOICE_OVERDUE",
  "INVOICE_FULLY_PAID",
  "INVOICE_PARTIALLY_PAID",
  "PAYMENT_OVERDUE",
  "PAYMENT_DUE_TODAY",
  "PAYMENT_DUE_SOON",
  "PAYMENT_RECEIVED",
  "PAYMENT_PARTIAL",
  "CONTRACT_EXPIRING_SOON",
  "CONTRACT_EXPIRED",
  "SYSTEM_UPDATE",
  "SYSTEM_USER_ACTIVITY",
  "SYSTEM_RECORD_CHANGE",
])

const FINANCIAL_CATEGORIES = new Set([
  "PAYMENT",
  "INVOICE",
  "PURCHASE_ORDER",
  "CONTRACT",
])

export function isEmailEligibleEvent(eventType: string) {
  return EMAIL_ELIGIBLE_EVENTS.has(eventType)
}

export function inAppIsMandatory(input: { category: string; priority: string }) {
  return input.category === "SYSTEM" || input.priority === "CRITICAL"
}

export function emailIsMandatory(input: { category: string; priority: string }) {
  return input.category === "SYSTEM" && (input.priority === "CRITICAL" || input.priority === "HIGH")
}

export function categoryEmailCanBeDisabled(category: string) {
  return category !== "SYSTEM"
}

export function shouldDeliverInApp(input: {
  category: string
  priority: string
  inAppEnabled: boolean
}) {
  if (inAppIsMandatory(input)) return true
  return input.inAppEnabled
}

export function shouldDeliverEmail(input: {
  category: string
  priority: string
  emailEligible: boolean
  categoryEnabled: boolean
  userEmailEnabled: boolean
}) {
  if (!input.emailEligible) return false
  if (emailIsMandatory(input)) return true
  return input.categoryEnabled && input.userEmailEnabled
}

export function requiredViewRoute(category: string, href: string | null) {
  if (FINANCIAL_CATEGORIES.has(category)) return "/admin/revenue"
  const match = href?.match(/^\/admin\/([a-z0-9-]+)(?:\/|$)/i)
  if (match?.[1]) return `/admin/${match[1].toLowerCase()}`
  return "/admin/notifications"
}

export function categoryLocks(category: NotificationCategory) {
  return {
    inAppLocked: category === "SYSTEM",
    emailLocked: category === "SYSTEM",
  }
}
