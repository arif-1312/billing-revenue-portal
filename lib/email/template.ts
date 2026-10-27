import { escapeHtml, plainText, singleLine } from "./html"
import { applicationLink } from "./links"
import {
  EMAIL_PRODUCT_NAME,
  emailButton,
  emailDocument,
  emailInfoTable,
  emailParagraphs,
} from "./layout"

export type EmailTemplateInput = {
  portalName: string
  recipientName: string
  title: string
  body: string
  category: string
  poNumber?: string | null
  invoiceNumber?: string | null
  companyName?: string | null
  customerName?: string | null
  href?: string | null
  occurredAt?: string | null
  baseUrl?: string
  logoUrl?: string | null
  supportEmail?: string | null
}

const SUBJECTS: Record<string, string> = {
  PO_CREATED: "New Purchase Order Created",
  PO_UPDATED: "Purchase Order Updated",
  PO_CLOSED: "Purchase Order Closed",
  PO_EXPIRING_SOON: "Purchase Order Expiring Soon",
  PO_EXPIRED: "Purchase Order Expired",
  INVOICE_CREATED: "Invoice Created",
  INVOICE_UPDATED: "Invoice Updated",
  INVOICE_OVERDUE: "Invoice Overdue",
  INVOICE_FULLY_PAID: "Invoice Fully Paid",
  INVOICE_PARTIALLY_PAID: "Invoice Partially Paid",
  PAYMENT_OVERDUE: "Payment Overdue",
  PAYMENT_DUE_TODAY: "Payment Due Today",
  PAYMENT_DUE_SOON: "Payment Due Soon",
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_PARTIAL: "Partial Payment Received",
  CONTRACT_EXPIRING_SOON: "Contract Expiring Soon",
  CONTRACT_EXPIRED: "Contract Expired",
}

export function emailSubject(input: {
  eventType: string
  title: string
  poNumber?: string | null
  invoiceNumber?: string | null
}) {
  const detail = input.poNumber?.trim() || input.invoiceNumber?.trim() || ""
  const base = SUBJECTS[input.eventType] ?? singleLine(input.title || "Billing Portal notification")
  if (!detail || base.includes(detail)) return base.slice(0, 180)
  return `${base} — ${detail}`.slice(0, 180)
}

export function actionLabel(category: string, href: string) {
  if (href.startsWith("/admin/revenue")) {
    if (category === "PAYMENT" || category === "INVOICE") return "View invoice"
    return "View purchase order"
  }
  if (href.startsWith("/admin/users")) return "View users"
  if (href.startsWith("/admin/email")) return "Open email settings"
  return "View in portal"
}

export function renderNotificationEmail(input: EmailTemplateInput) {
  const portalName = singleLine(input.portalName) || "Billing & Revenue Portal"
  const recipientName = singleLine(input.recipientName) || "there"
  const title = singleLine(input.title) || "Notification"
  const body = plainText(input.body).trim()
  const href = input.href?.trim() || ""
  const actionUrl = applicationLink(href, input.baseUrl)
  const label = actionUrl ? actionLabel(input.category, href) : ""
  const when = formatWhen(input.occurredAt)
  const rows = detailRows(input)

  const text = [
    `Hello ${recipientName},`,
    "",
    title,
    "",
    body,
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    rows.length ? "" : null,
    actionUrl ? `${label}: ${actionUrl}` : "Sign in to the Billing Portal to view this record.",
    "",
    when,
    "",
    "Regards,",
    `${portalName} Team`,
  ]
    .filter((line) => line != null)
    .join("\n")

  const rowHtml = emailInfoTable(rows)
  const button = actionUrl
    ? emailButton(actionUrl, label)
    : `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">Sign in to the Billing Portal to view this record.</p>`

  const html = emailDocument({
    preheader: title,
    brand: {
      portalName: EMAIL_PRODUCT_NAME,
      companyName: portalName,
      logoUrl: input.logoUrl,
      supportEmail: input.supportEmail,
    },
    heading: title,
    introHtml: emailParagraphs([
      `Hello ${recipientName},`,
      body,
    ]),
    bodyHtml: `${rowHtml}${button}<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#64748b;">${escapeHtml(when)}</p>`,
  })

  return { text, html }
}

function detailRows(input: EmailTemplateInput) {
  const rows: Array<{ label: string; value: string }> = []
  const poNumber = input.poNumber?.trim()
  const invoiceNumber = input.invoiceNumber?.trim()
  const companyName = input.companyName?.trim()
  const customerName = input.customerName?.trim()

  if (poNumber) rows.push({ label: "Purchase order", value: poNumber })
  if (invoiceNumber) rows.push({ label: "Invoice", value: invoiceNumber })
  if (companyName) rows.push({ label: "Company", value: companyName })
  if (customerName && customerName !== companyName) {
    rows.push({ label: "Customer", value: customerName })
  }
  return rows
}

function formatWhen(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date()
  const valid = Number.isNaN(date.getTime()) ? new Date() : date
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(valid)
  return `${formatted} IST`
}
