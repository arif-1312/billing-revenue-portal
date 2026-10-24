import { calendarDaysBetween, parseKolkataDate } from "@/lib/fiscal-year"

import { outstandingBalance, rupees } from "./outstanding"
import type {
  NotificationCategory,
  NotificationKind,
  NotificationPriority,
} from "./types"

export const PAYMENT_DUE_SOON_DAYS = 3
export const CONTRACT_EXPIRY_SOON_DAYS = 30

export type ReceiptSnapshot = {
  receivedOn: string
  amount: number
}

export type InvoiceSnapshot = {
  invoiceNumber: string
  invoiceAmount: number
  invoiceOn: string | null
  dueOn: string | null
  receipts: ReceiptSnapshot[]
}

export type PurchaseOrderSnapshot = {
  id: string
  poNumber: string
  status: "LIVE" | "CLOSED"
  startOn: string | null
  endOn: string | null
  contractId: string | null
  contractName: string | null
  customerName: string
  companyName: string
  poAmount: number | null
  invoices: InvoiceSnapshot[]
}

export type NotificationDraft = {
  dedupeKey: string
  category: NotificationCategory
  eventType: string
  priority: NotificationPriority
  kind: NotificationKind
  title: string
  body: string
  customerName: string | null
  companyName: string | null
  invoiceNumber: string | null
  poNumber: string | null
  entityType: string
  entityId: string
  href: string | null
  metadata: Record<string, string | number | boolean | null>
}

export type SystemNotificationInput = {
  eventType: "SYSTEM_UPDATE" | "SYSTEM_USER_ACTIVITY" | "SYSTEM_RECORD_CHANGE"
  entityType: string
  entityId: string
  title: string
  body: string
  href: string
  fingerprint: string
  priority?: NotificationPriority
  customerName?: string | null
  companyName?: string | null
}

type KeyedInvoice = {
  key: string
  invoice: InvoiceSnapshot
}

export function fingerprint(
  parts: Array<string | number | boolean | null | undefined>,
) {
  const text = parts.map((part) => String(part ?? "")).join("\u001f")
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

export function daysFromToday(today: Date, civilDate: string | null) {
  if (!civilDate || !/^\d{4}-\d{2}-\d{2}$/.test(civilDate)) return null
  return calendarDaysBetween(parseKolkataDate(civilDate), today)
}

export function stateNotificationDrafts(
  order: PurchaseOrderSnapshot,
  today = new Date(),
) {
  const drafts: NotificationDraft[] = []

  for (const entry of keyedInvoices(order)) {
    drafts.push(...invoiceStateDrafts(order, entry, today))
  }

  drafts.push(...agreementStateDrafts(order, today))
  return drafts
}

export function transitionNotificationDrafts(
  before: PurchaseOrderSnapshot | null,
  after: PurchaseOrderSnapshot,
) {
  const drafts: NotificationDraft[] = []

  if (!before) {
    drafts.push(purchaseOrderDraft(after, {
      eventType: "PO_CREATED",
      title: "Purchase order created",
      body: `${poLabel(after)} for ${partyName(after)} was created.`,
      priority: "NORMAL",
      dedupeKey: `PO_CREATED|${after.id}`,
    }))
  } else {
    const invoicesChanged =
      invoiceFieldFingerprint(before) !== invoiceFieldFingerprint(after)
    const closedNow = before.status !== "CLOSED" && after.status === "CLOSED"
    const onlyClosed =
      closedNow &&
      headerParts(before, "CLOSED") === headerParts(after) &&
      !invoicesChanged

    if ((headerParts(before) !== headerParts(after) || invoicesChanged) && !onlyClosed) {
      drafts.push(purchaseOrderDraft(after, {
        eventType: "PO_UPDATED",
        title: "Purchase order updated",
        body: `${poLabel(after)} for ${partyName(after)} was updated.`,
        priority: "LOW",
        dedupeKey: `PO_UPDATED|${after.id}|${fingerprint([
          headerParts(after),
          invoiceFieldFingerprint(after),
        ])}`,
      }))
    }

    if (closedNow) {
      drafts.push(purchaseOrderDraft(after, {
        eventType: "PO_CLOSED",
        title: "Purchase order closed",
        body: `${poLabel(after)} for ${partyName(after)} was closed.`,
        priority: "HIGH",
        dedupeKey: `PO_CLOSED|${after.id}|${fingerprint([headerParts(after)])}`,
      }))
    }
  }

  const previous = new Map(
    (before ? keyedInvoices(before) : []).map((entry) => [entry.key, entry.invoice]),
  )

  for (const entry of keyedInvoices(after)) {
    drafts.push(...invoiceTransitionDrafts(after, previous.get(entry.key) ?? null, entry))
  }

  return drafts
}

export function systemNotificationDraft(
  input: SystemNotificationInput,
): NotificationDraft {
  return {
    dedupeKey: `SYSTEM|${input.eventType}|${input.entityType}|${input.entityId}|${input.fingerprint}`,
    category: "SYSTEM",
    eventType: input.eventType,
    priority: input.priority ?? "NORMAL",
    kind: "EVENT",
    title: input.title,
    body: input.body,
    customerName: input.customerName ?? null,
    companyName: input.companyName ?? null,
    invoiceNumber: null,
    poNumber: null,
    entityType: input.entityType,
    entityId: input.entityId,
    href: input.href,
    metadata: {},
  }
}

function invoiceStateDrafts(
  order: PurchaseOrderSnapshot,
  entry: KeyedInvoice,
  today: Date,
) {
  const outstanding = outstandingBalance(
    entry.invoice.invoiceAmount,
    entry.invoice.receipts,
  )
  if (outstanding <= 0) return []

  const days = daysFromToday(today, entry.invoice.dueOn)
  const drafts: NotificationDraft[] = []

  if (entry.invoice.dueOn && days != null && days < 0) {
    const past = Math.abs(days)
    drafts.push(invoiceDraft(order, entry, {
      category: "PAYMENT",
      eventType: "PAYMENT_OVERDUE",
      title: "Payment overdue",
      priority: "CRITICAL",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is ${dayCount(past)} past the due date of ${formatCivil(entry.invoice.dueOn)}. Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `PAYMENT_OVERDUE|${entry.key}`,
      outstanding,
      days,
    }))
    drafts.push(invoiceDraft(order, entry, {
      category: "INVOICE",
      eventType: "INVOICE_OVERDUE",
      title: "Invoice overdue",
      priority: "CRITICAL",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is overdue since ${formatCivil(entry.invoice.dueOn)}. Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `INVOICE_OVERDUE|${entry.key}`,
      outstanding,
      days,
    }))
    return drafts
  }

  if (entry.invoice.dueOn && days === 0) {
    drafts.push(invoiceDraft(order, entry, {
      category: "PAYMENT",
      eventType: "PAYMENT_DUE_TODAY",
      title: "Payment due today",
      priority: "HIGH",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is due today, ${formatCivil(entry.invoice.dueOn)}. Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `PAYMENT_DUE_TODAY|${entry.key}`,
      outstanding,
      days,
    }))
    return drafts
  }

  if (
    entry.invoice.dueOn &&
    days != null &&
    days >= 1 &&
    days <= PAYMENT_DUE_SOON_DAYS
  ) {
    drafts.push(invoiceDraft(order, entry, {
      category: "PAYMENT",
      eventType: "PAYMENT_DUE_SOON",
      title: "Payment due soon",
      priority: "HIGH",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is due on ${formatCivil(entry.invoice.dueOn)} (${dayCount(days)}). Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `PAYMENT_DUE_SOON|${entry.key}`,
      outstanding,
      days,
    }))
    return drafts
  }

  drafts.push(invoiceDraft(order, entry, {
    category: "INVOICE",
    eventType: "INVOICE_PAYMENT_PENDING",
    title: "Invoice payment pending",
    priority: "NORMAL",
    body: entry.invoice.dueOn
      ? `${invoiceLabel(entry.invoice)} for ${partyName(order)} has an outstanding balance of ${rupees(outstanding)}. Payment is due on ${formatCivil(entry.invoice.dueOn)}.`
      : `${invoiceLabel(entry.invoice)} for ${partyName(order)} has an outstanding balance of ${rupees(outstanding)}. No payment due date is set.`,
    dedupeKey: `INVOICE_PAYMENT_PENDING|${entry.key}`,
    outstanding,
    days,
  }))

  return drafts
}

function agreementStateDrafts(order: PurchaseOrderSnapshot, today: Date) {
  const days = daysFromToday(today, order.endOn)
  if (!order.endOn || days == null) return []

  const drafts: NotificationDraft[] = []
  const ending = formatCivil(order.endOn)

  if (order.status === "LIVE" && days < 0) {
    drafts.push(purchaseOrderDraft(order, {
      eventType: "PO_EXPIRED",
      title: "Purchase order expired",
      body: `${poLabel(order)} for ${partyName(order)} ended on ${ending}.`,
      priority: "CRITICAL",
      dedupeKey: `PO_EXPIRED|${order.id}|${order.endOn}`,
    }))
  } else if (order.status === "LIVE" && days <= CONTRACT_EXPIRY_SOON_DAYS) {
    drafts.push(purchaseOrderDraft(order, {
      eventType: "PO_EXPIRING_SOON",
      title: "Purchase order expiring soon",
      body: days === 0
        ? `${poLabel(order)} for ${partyName(order)} ends today, ${ending}.`
        : `${poLabel(order)} for ${partyName(order)} ends on ${ending} (in ${dayCount(days)}).`,
      priority: "HIGH",
      dedupeKey: `PO_EXPIRING_SOON|${order.id}|${order.endOn}`,
    }))
  }

  if (!order.contractId) return drafts

  const contract = order.contractName?.trim() || "Contract"
  if (days < 0) {
    drafts.push(purchaseOrderDraft(order, {
      eventType: "CONTRACT_EXPIRED",
      title: "Contract expired",
      body: `${contract} for ${partyName(order)} ended on ${ending}.`,
      priority: "CRITICAL",
      dedupeKey: `CONTRACT_EXPIRED|${order.id}|${order.contractId}|${order.endOn}`,
      category: "CONTRACT",
    }))
  } else if (days <= CONTRACT_EXPIRY_SOON_DAYS) {
    drafts.push(purchaseOrderDraft(order, {
      eventType: "CONTRACT_EXPIRING_SOON",
      title: "Contract expiring soon",
      body: days === 0
        ? `${contract} for ${partyName(order)} ends today, ${ending}.`
        : `${contract} for ${partyName(order)} ends on ${ending} (in ${dayCount(days)}).`,
      priority: "HIGH",
      dedupeKey: `CONTRACT_EXPIRING_SOON|${order.id}|${order.contractId}|${order.endOn}`,
      category: "CONTRACT",
    }))
  }

  return drafts
}

function invoiceTransitionDrafts(
  order: PurchaseOrderSnapshot,
  before: InvoiceSnapshot | null,
  entry: KeyedInvoice,
) {
  const drafts: NotificationDraft[] = []
  const outstanding = outstandingBalance(
    entry.invoice.invoiceAmount,
    entry.invoice.receipts,
  )
  const added = addedReceipts(before, entry.invoice)
  const addedAmount = added.reduce((total, signature) => total + amountOf(signature), 0)
  const previousOutstanding = before
    ? outstandingBalance(before.invoiceAmount, before.receipts)
    : outstandingBalance(entry.invoice.invoiceAmount, [])

  if (!before) {
    drafts.push(invoiceDraft(order, entry, {
      category: "INVOICE",
      eventType: "INVOICE_CREATED",
      title: "Invoice created",
      priority: "NORMAL",
      kind: "EVENT",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} was added to ${poLabel(order)}.`,
      dedupeKey: `INVOICE_CREATED|${entry.key}`,
      outstanding,
      days: null,
    }))
  } else {
    const changes = changedInvoiceFields(before, entry.invoice)
    if (changes.length > 0) {
      drafts.push(invoiceDraft(order, entry, {
        category: "INVOICE",
        eventType: "INVOICE_UPDATED",
        title: "Invoice updated",
        priority: "LOW",
        kind: "EVENT",
        body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} was updated (${changes.join(", ")}).`,
        dedupeKey: `INVOICE_UPDATED|${entry.key}|${fingerprint([
          entry.invoice.invoiceNumber.trim(),
          entry.invoice.invoiceAmount,
          entry.invoice.invoiceOn,
          entry.invoice.dueOn,
        ])}`,
        outstanding,
        days: null,
      }))
    }
  }

  if (added.length === 0) return drafts

  if (outstanding <= 0 && previousOutstanding > 0) {
    drafts.push(invoiceDraft(order, entry, {
      category: "PAYMENT",
      eventType: "PAYMENT_RECEIVED",
      title: "Payment received",
      priority: "NORMAL",
      kind: "EVENT",
      body: `${rupees(addedAmount)} was recorded against ${invoiceReference(entry.invoice)} for ${partyName(order)}. The invoice is fully paid.`,
      dedupeKey: `PAYMENT_RECEIVED|${entry.key}|${fingerprint(added)}`,
      outstanding,
      days: null,
    }))
    drafts.push(invoiceDraft(order, entry, {
      category: "INVOICE",
      eventType: "INVOICE_FULLY_PAID",
      title: "Invoice fully paid",
      priority: "NORMAL",
      kind: "EVENT",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is fully paid.`,
      dedupeKey: `INVOICE_FULLY_PAID|${entry.key}|${fingerprint(receiptSignatures(entry.invoice))}`,
      outstanding,
      days: null,
    }))
    return drafts
  }

  if (outstanding > 0) {
    drafts.push(invoiceDraft(order, entry, {
      category: "PAYMENT",
      eventType: "PAYMENT_PARTIAL",
      title: "Partial payment received",
      priority: "NORMAL",
      kind: "EVENT",
      body: `${rupees(addedAmount)} was recorded against ${invoiceReference(entry.invoice)} for ${partyName(order)}. Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `PAYMENT_PARTIAL|${entry.key}|${fingerprint(added)}`,
      outstanding,
      days: null,
    }))
    drafts.push(invoiceDraft(order, entry, {
      category: "INVOICE",
      eventType: "INVOICE_PARTIALLY_PAID",
      title: "Invoice partially paid",
      priority: "NORMAL",
      kind: "EVENT",
      body: `${invoiceLabel(entry.invoice)} for ${partyName(order)} is partially paid. Outstanding balance is ${rupees(outstanding)}.`,
      dedupeKey: `INVOICE_PARTIALLY_PAID|${entry.key}|${fingerprint(receiptSignatures(entry.invoice))}`,
      outstanding,
      days: null,
    }))
  }

  return drafts
}

function changedInvoiceFields(before: InvoiceSnapshot, after: InvoiceSnapshot) {
  const changes: string[] = []
  if (before.invoiceNumber.trim() !== after.invoiceNumber.trim()) {
    changes.push("invoice number")
  }
  if (roundMoney(before.invoiceAmount) !== roundMoney(after.invoiceAmount)) {
    changes.push("amount")
  }
  if (before.dueOn !== after.dueOn) changes.push("due date")
  if (before.invoiceOn !== after.invoiceOn) changes.push("invoice date")
  return changes
}

function keyedInvoices(order: PurchaseOrderSnapshot): KeyedInvoice[] {
  const ordered = order.invoices
    .map((invoice, index) => ({ invoice, index }))
    .sort((left, right) => {
      const byNumber = left.invoice.invoiceNumber
        .trim()
        .toLowerCase()
        .localeCompare(right.invoice.invoiceNumber.trim().toLowerCase())
      if (byNumber !== 0) return byNumber
      const byDate = (left.invoice.invoiceOn ?? "").localeCompare(
        right.invoice.invoiceOn ?? "",
      )
      if (byDate !== 0) return byDate
      return left.index - right.index
    })

  const seen = new Map<string, number>()
  return ordered.map(({ invoice }) => {
    const number = invoice.invoiceNumber.trim().toLowerCase()
    const base = number
      ? `${order.id}|${number}`
      : `${order.id}|row|${invoice.invoiceOn ?? ""}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    return { invoice, key: `${base}|#${occurrence}` }
  })
}

function receiptSignatures(invoice: InvoiceSnapshot) {
  const ordered = [...invoice.receipts].sort((left, right) => {
    const byDate = left.receivedOn.localeCompare(right.receivedOn)
    if (byDate !== 0) return byDate
    return left.amount - right.amount
  })
  const seen = new Map<string, number>()
  return ordered.flatMap((receipt) => {
    if (!Number.isFinite(receipt.amount) || receipt.amount <= 0) return []
    const base = `${receipt.receivedOn}|${receipt.amount.toFixed(2)}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    return [`${base}|#${occurrence}`]
  })
}

function addedReceipts(before: InvoiceSnapshot | null, after: InvoiceSnapshot) {
  const previous = new Set(before ? receiptSignatures(before) : [])
  return receiptSignatures(after).filter((signature) => !previous.has(signature))
}

function amountOf(signature: string) {
  return Number(signature.split("|")[1] ?? 0)
}

function headerParts(
  order: PurchaseOrderSnapshot,
  status: PurchaseOrderSnapshot["status"] = order.status,
) {
  return [
    order.poNumber.trim(),
    status,
    order.startOn ?? "",
    order.endOn ?? "",
    order.contractId ?? "",
    order.customerName,
    order.companyName,
    order.poAmount == null ? "" : order.poAmount.toFixed(2),
  ].join("|")
}

function invoiceFieldFingerprint(order: PurchaseOrderSnapshot) {
  return keyedInvoices(order)
    .map(({ key, invoice }) =>
      [
        key,
        invoice.invoiceNumber.trim(),
        roundMoney(invoice.invoiceAmount).toFixed(2),
        invoice.invoiceOn ?? "",
        invoice.dueOn ?? "",
      ].join("~"),
    )
    .join("||")
}

function purchaseOrderDraft(
  order: PurchaseOrderSnapshot,
  input: {
    eventType: string
    title: string
    body: string
    priority: NotificationPriority
    dedupeKey: string
    category?: NotificationCategory
  },
): NotificationDraft {
  return {
    dedupeKey: input.dedupeKey,
    category: input.category ?? "PURCHASE_ORDER",
    eventType: input.eventType,
    priority: input.priority,
    kind: input.eventType === "PO_CREATED" ||
      input.eventType === "PO_UPDATED" ||
      input.eventType === "PO_CLOSED"
      ? "EVENT"
      : "STATE",
    title: input.title,
    body: input.body,
    customerName: order.customerName || null,
    companyName: order.companyName || null,
    invoiceNumber: null,
    poNumber: order.poNumber.trim() || null,
    entityType: "PurchaseOrder",
    entityId: order.id,
    href: `/admin/revenue/view/${order.id}`,
    metadata: { endOn: order.endOn },
  }
}

function invoiceDraft(
  order: PurchaseOrderSnapshot,
  entry: KeyedInvoice,
  input: {
    category: NotificationCategory
    eventType: string
    title: string
    body: string
    priority: NotificationPriority
    dedupeKey: string
    outstanding: number
    days: number | null
    kind?: NotificationKind
  },
): NotificationDraft {
  return {
    dedupeKey: input.dedupeKey,
    category: input.category,
    eventType: input.eventType,
    priority: input.priority,
    kind: input.kind ?? "STATE",
    title: input.title,
    body: input.body,
    customerName: order.customerName || null,
    companyName: order.companyName || null,
    invoiceNumber: entry.invoice.invoiceNumber.trim() || null,
    poNumber: order.poNumber.trim() || null,
    entityType: "PurchaseOrder",
    entityId: order.id,
    href: `/admin/revenue/view/${order.id}`,
    metadata: {
      outstanding: input.outstanding,
      days: input.days,
      dueOn: entry.invoice.dueOn,
    },
  }
}

function partyName(order: PurchaseOrderSnapshot) {
  return order.customerName || order.companyName || "the customer"
}

function poLabel(order: PurchaseOrderSnapshot) {
  return order.poNumber.trim()
    ? `Purchase order ${order.poNumber.trim()}`
    : "Purchase order"
}

function invoiceReference(invoice: InvoiceSnapshot) {
  return invoice.invoiceNumber.trim()
    ? `invoice ${invoice.invoiceNumber.trim()}`
    : "an unnumbered invoice"
}

function invoiceLabel(invoice: InvoiceSnapshot) {
  return invoice.invoiceNumber.trim()
    ? `Invoice ${invoice.invoiceNumber.trim()}`
    : "Unnumbered invoice"
}

function formatCivil(ymd: string) {
  const [year, month, day] = ymd.split("-")
  return `${day}/${month}/${year}`
}

function dayCount(days: number) {
  return days === 1 ? "1 day" : `${days} days`
}

function roundMoney(value: number) {
  return Math.round(Number(value || 0) * 100) / 100
}
