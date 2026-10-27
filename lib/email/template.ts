import { escapeHtml, plainText, singleLine } from "./html"
import { applicationLink } from "./links"

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

  const rowHtml = rows
    .map(
      (row) =>
        `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:160px;vertical-align:top;">${escapeHtml(row.label)}</td><td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("")

  const button = actionUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">${escapeHtml(label)}</a></p>`
    : `<p style="margin:24px 0 0;color:#64748b;font-size:13px;">Sign in to the Billing Portal to view this record.</p>`

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f8fafc;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#0369a1;">${escapeHtml(portalName.toUpperCase())}</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-family:Arial,sans-serif;color:#334155;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Hello ${escapeHtml(recipientName)},</p>
              <p style="margin:0;">${escapeHtml(body).replace(/\n/g, "<br>")}</p>
              ${rowHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #e2e8f0;">${rowHtml}</table>` : ""}
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#64748b;">
              <p style="margin:0;">${escapeHtml(when)}</p>
              <p style="margin:8px 0 0;">Regards,<br>${escapeHtml(portalName)} Team</p>
              <p style="margin:8px 0 0;">You received this message because of your Billing Portal account. Optional categories can be changed in the notification centre.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

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
