import { Prisma, type PrismaClient } from "@prisma/client"

import { formatKolkataDate } from "@/lib/fiscal-year"
import { prisma } from "@/lib/prisma"
import { canAccess, getUserPermissions } from "@/lib/rbac"

import { emailIntentFor } from "./channels"
import { stateNotificationDrafts, type NotificationDraft, type PurchaseOrderSnapshot } from "./model"
import {
  NOTIFICATION_BUCKETS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_SORTS,
  type NotificationBucket,
  type NotificationCategory,
  type NotificationCentreData,
  type NotificationItem,
  type NotificationPriority,
  type NotificationSort,
} from "./types"

export const NOTIFICATION_PAGE_SIZE = 20
export const NOTIFICATION_PREVIEW_LIMIT = 8

const STATE_SYNC_INTERVAL_MS = 5 * 60 * 1000
const RECEIPT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BUCKET_CATEGORY: Partial<Record<NotificationBucket, NotificationCategory>> = {
  payment: "PAYMENT",
  invoice: "INVOICE",
  purchase_order: "PURCHASE_ORDER",
  contract: "CONTRACT",
  system: "SYSTEM",
}

const purchaseOrderInclude = {
  customer: {
    select: { companyName: true, firstName: true, lastName: true },
  },
  company: { select: { name: true } },
  contract: { select: { id: true, name: true } },
  billingCycles: {
    orderBy: [{ invoiceDate: "asc" as const }, { invoiceNumber: "asc" as const }],
    include: {
      payments: { select: { amount: true, receivedDate: true } },
    },
  },
} satisfies Prisma.PurchaseOrderInclude

type NotificationReader = Prisma.TransactionClient | PrismaClient
type PurchaseOrderRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof purchaseOrderInclude
}>

const notificationSelect = {
  title: true,
  body: true,
  category: true,
  priority: true,
  customerName: true,
  companyName: true,
  invoiceNumber: true,
  poNumber: true,
  href: true,
  occurredAt: true,
} satisfies Prisma.NotificationSelect

type StoredReceipt = Prisma.NotificationReceiptGetPayload<{
  include: { notification: { select: typeof notificationSelect } }
}>

let lastStateSyncAt = 0

export async function loadPurchaseOrderSnapshots(
  db: NotificationReader,
  ids?: string[],
) {
  if (ids && ids.length === 0) return []

  const groups = ids ? chunk(ids, 500) : [undefined]
  const snapshots: PurchaseOrderSnapshot[] = []

  for (const group of groups) {
    const rows = await db.purchaseOrder.findMany({
      where: group ? { id: { in: group } } : undefined,
      include: purchaseOrderInclude,
    })
    snapshots.push(...rows.map(toSnapshot))
  }

  return snapshots
}

export async function persistDrafts(drafts: NotificationDraft[]) {
  const unique = new Map<string, NotificationDraft>()
  for (const draft of drafts) {
    if (!unique.has(draft.dedupeKey)) unique.set(draft.dedupeKey, draft)
  }
  const pending = [...unique.values()]
  if (pending.length === 0) return

  const keys = pending.map((draft) => draft.dedupeKey)
  const existing = await findByKeys(keys)
  const existingKeys = new Set(existing.map((row) => row.dedupeKey))
  const fresh = pending.filter((draft) => !existingKeys.has(draft.dedupeKey))

  for (const group of chunk(fresh, 200)) {
    await prisma.notification.createMany({
      data: group.map(toCreateData),
      skipDuplicates: true,
    })
  }

  const stored = fresh.length > 0 ? await findByKeys(keys) : existing
  const stateKeys = new Set(
    pending.filter((draft) => draft.kind === "STATE").map((draft) => draft.dedupeKey),
  )
  const freshKeys = new Set(fresh.map((draft) => draft.dedupeKey))
  const attachIds = stored
    .filter((row) => freshKeys.has(row.dedupeKey) || stateKeys.has(row.dedupeKey))
    .map((row) => row.id)

  await attachReceipts(attachIds)
}

export async function syncStateNotificationsIfDue() {
  const now = Date.now()
  if (now - lastStateSyncAt < STATE_SYNC_INTERVAL_MS) return
  lastStateSyncAt = now

  try {
    const orders = await loadPurchaseOrderSnapshots(prisma)
    await persistDrafts(orders.flatMap((order) => stateNotificationDrafts(order)))
  } catch (error) {
    lastStateSyncAt = 0
    throw error
  }
}

export async function getUnreadNotificationCount() {
  const access = await requireNotificationUser()
  if (!access.ok) return access

  try {
    await syncQuietly()
    const unreadCount = await prisma.notificationReceipt.count({
      where: { userId: access.user.id, deletedAt: null, readAt: null },
    })
    return { ok: true as const, unreadCount }
  } catch {
    return { ok: false as const, message: "Notifications could not be loaded." }
  }
}

export async function getNotificationPreview(scope: "all" | "unread") {
  const access = await requireNotificationUser()
  if (!access.ok) return access

  try {
    await syncQuietly()
    const where = receiptWhere(access.user.id, {
      bucket: scope === "unread" ? "unread" : "all",
      q: "",
      priority: "",
    })
    const [rows, unreadCount] = await Promise.all([
      prisma.notificationReceipt.findMany({
        where,
        include: { notification: { select: notificationSelect } },
        orderBy: [{ notification: { occurredAt: "desc" } }, { id: "desc" }],
        take: NOTIFICATION_PREVIEW_LIMIT,
      }),
      prisma.notificationReceipt.count({
        where: { userId: access.user.id, deletedAt: null, readAt: null },
      }),
    ])

    return {
      ok: true as const,
      items: rows.map(serialize),
      unreadCount,
    }
  } catch {
    return { ok: false as const, message: "Notifications could not be loaded." }
  }
}

export async function getNotificationCentre(input: {
  q?: string
  bucket?: string
  priority?: string
  sort?: string
  page?: string
}): Promise<
  | { ok: true; data: NotificationCentreData }
  | { ok: false; message: string }
> {
  const access = await requireNotificationUser()
  if (!access.ok) return access

  try {
    await syncQuietly()
    const bucket = parseBucket(input.bucket)
    const priority = parsePriority(input.priority)
    const sort = parseSort(input.sort)
    const q = input.q?.trim().slice(0, 100) ?? ""
    const where = receiptWhere(access.user.id, { bucket, q, priority })
    const total = await prisma.notificationReceipt.count({ where })
    const pageSize = NOTIFICATION_PAGE_SIZE
    const requested = Number.parseInt(input.page || "1", 10)
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const page =
      Number.isFinite(requested) && requested > 0
        ? Math.min(requested, pageCount)
        : 1

    const [rows, counts, allowedDelete] = await Promise.all([
      prisma.notificationReceipt.findMany({
        where,
        include: { notification: { select: notificationSelect } },
        orderBy: orderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      bucketCounts(access.user.id),
      canAccess("/admin/notifications", "delete"),
    ])

    return {
      ok: true,
      data: {
        items: rows.map(serialize),
        total,
        page,
        pageSize,
        q,
        bucket,
        priority,
        sort,
        counts,
        unreadCount: counts.unread,
        canDelete: allowedDelete,
      },
    }
  } catch {
    return { ok: false, message: "Notifications could not be loaded." }
  }
}

export async function markNotificationReceiptRead(receiptId: string) {
  const access = await requireNotificationUser()
  if (!access.ok) return access
  if (!RECEIPT_ID.test(receiptId)) {
    return { ok: false as const, message: "That notification is no longer available." }
  }

  try {
    const updated = await prisma.notificationReceipt.updateMany({
      where: {
        id: receiptId,
        userId: access.user.id,
        deletedAt: null,
        readAt: null,
      },
      data: { readAt: new Date() },
    })

    if (updated.count === 0) {
      const existing = await prisma.notificationReceipt.findFirst({
        where: { id: receiptId, userId: access.user.id, deletedAt: null },
        select: { id: true },
      })
      if (!existing) {
        return { ok: false as const, message: "That notification is no longer available." }
      }
    }

    return { ok: true as const }
  } catch {
    return { ok: false as const, message: "This notification could not be updated." }
  }
}

export async function markAllNotificationReceiptsRead() {
  const access = await requireNotificationUser()
  if (!access.ok) return access

  try {
    await prisma.notificationReceipt.updateMany({
      where: { userId: access.user.id, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    })
    return { ok: true as const }
  } catch {
    return { ok: false as const, message: "Notifications could not be updated." }
  }
}

export async function deleteNotificationReceipt(receiptId: string) {
  const access = await requireNotificationUser()
  if (!access.ok) return access
  if (!RECEIPT_ID.test(receiptId)) {
    return { ok: false as const, message: "That notification is no longer available." }
  }

  const allowed = await canAccess("/admin/notifications", "delete")
  if (!allowed) {
    return {
      ok: false as const,
      message: "You do not have permission to delete notifications.",
    }
  }

  try {
    const updated = await prisma.notificationReceipt.updateMany({
      where: { id: receiptId, userId: access.user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (updated.count === 0) {
      return { ok: false as const, message: "That notification is no longer available." }
    }
    return { ok: true as const }
  } catch {
    return { ok: false as const, message: "This notification could not be deleted." }
  }
}

async function requireNotificationUser() {
  const user = await getUserPermissions()
  if (!user) {
    return { ok: false as const, message: "Sign in again to load notifications." }
  }
  return { ok: true as const, user }
}

async function syncQuietly() {
  try {
    await syncStateNotificationsIfDue()
  } catch {
    console.error("Notification sync failed")
  }
}

async function findByKeys(keys: string[]) {
  const rows: Array<{ id: string; dedupeKey: string }> = []
  for (const group of chunk(keys, 500)) {
    const found = await prisma.notification.findMany({
      where: { dedupeKey: { in: group } },
      select: { id: true, dedupeKey: true },
    })
    rows.push(...found)
  }
  return rows
}

async function attachReceipts(notificationIds: string[]) {
  if (notificationIds.length === 0) return

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  })
  if (users.length === 0) return

  const rows = notificationIds.flatMap((notificationId) =>
    users.map((user) => ({ notificationId, userId: user.id })),
  )

  for (const group of chunk(rows, 1000)) {
    await prisma.notificationReceipt.createMany({
      data: group,
      skipDuplicates: true,
    })
  }
}

async function bucketCounts(userId: string) {
  const base = { userId, deletedAt: null }
  const [all, unread, read, payment, invoice, purchaseOrder, contract, system] =
    await Promise.all([
      prisma.notificationReceipt.count({ where: base }),
      prisma.notificationReceipt.count({ where: { ...base, readAt: null } }),
      prisma.notificationReceipt.count({
        where: { ...base, readAt: { not: null } },
      }),
      prisma.notificationReceipt.count({
        where: { ...base, notification: { category: "PAYMENT" } },
      }),
      prisma.notificationReceipt.count({
        where: { ...base, notification: { category: "INVOICE" } },
      }),
      prisma.notificationReceipt.count({
        where: { ...base, notification: { category: "PURCHASE_ORDER" } },
      }),
      prisma.notificationReceipt.count({
        where: { ...base, notification: { category: "CONTRACT" } },
      }),
      prisma.notificationReceipt.count({
        where: { ...base, notification: { category: "SYSTEM" } },
      }),
    ])

  return {
    all,
    unread,
    read,
    payment,
    invoice,
    purchase_order: purchaseOrder,
    contract,
    system,
  } satisfies Record<NotificationBucket, number>
}

function receiptWhere(
  userId: string,
  query: {
    bucket: NotificationBucket
    q: string
    priority: NotificationPriority | ""
  },
): Prisma.NotificationReceiptWhereInput {
  const where: Prisma.NotificationReceiptWhereInput = {
    userId,
    deletedAt: null,
  }

  if (query.bucket === "unread") where.readAt = null
  if (query.bucket === "read") where.readAt = { not: null }

  const notification: Prisma.NotificationWhereInput = {}
  const category = BUCKET_CATEGORY[query.bucket]
  if (category) notification.category = category
  if (query.priority) notification.priority = query.priority
  if (query.q) {
    notification.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { body: { contains: query.q, mode: "insensitive" } },
      { customerName: { contains: query.q, mode: "insensitive" } },
      { companyName: { contains: query.q, mode: "insensitive" } },
      { invoiceNumber: { contains: query.q, mode: "insensitive" } },
      { poNumber: { contains: query.q, mode: "insensitive" } },
    ]
  }

  if (Object.keys(notification).length > 0) where.notification = notification
  return where
}

function orderBy(
  sort: NotificationSort,
): Prisma.NotificationReceiptOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return [{ notification: { occurredAt: "asc" } }, { id: "asc" }]
  }
  if (sort === "priority") {
    return [
      { notification: { priority: "asc" } },
      { notification: { occurredAt: "desc" } },
      { id: "desc" },
    ]
  }
  return [{ notification: { occurredAt: "desc" } }, { id: "desc" }]
}

function toCreateData(draft: NotificationDraft): Prisma.NotificationCreateManyInput {
  const email = emailIntentFor(draft.eventType)
  return {
    dedupeKey: draft.dedupeKey,
    category: draft.category,
    eventType: draft.eventType,
    priority: draft.priority,
    kind: draft.kind,
    title: draft.title,
    body: draft.body,
    customerName: draft.customerName,
    companyName: draft.companyName,
    invoiceNumber: draft.invoiceNumber,
    poNumber: draft.poNumber,
    entityType: draft.entityType,
    entityId: draft.entityId,
    href: draft.href,
    metadata: draft.metadata,
    emailEligible: email.emailEligible,
    emailStatus: email.emailStatus,
    emailTemplateKey: email.emailTemplateKey,
  }
}

function toSnapshot(order: PurchaseOrderRow): PurchaseOrderSnapshot {
  return {
    id: order.id,
    poNumber: order.customerPONumber?.trim() ?? "",
    status: order.status,
    startOn: civilDate(order.startFrom),
    endOn: civilDate(order.endDate),
    contractId: order.contractId,
    contractName: order.contract?.name?.trim() || null,
    customerName: displayCustomer(order.customer),
    companyName: order.company?.name?.trim() ?? "",
    poAmount: order.poAmount == null ? null : Number(order.poAmount),
    invoices: order.billingCycles.map((cycle) => ({
      invoiceNumber: cycle.invoiceNumber?.trim() ?? "",
      invoiceAmount: Number(cycle.invoiceAmount ?? 0),
      invoiceOn: civilDate(cycle.invoiceDate),
      dueOn: civilDate(cycle.paymentDueDate),
      receipts: cycle.payments.flatMap((payment) => {
        const receivedOn = civilDate(payment.receivedDate)
        if (!receivedOn) return []
        return [{ receivedOn, amount: Number(payment.amount) }]
      }),
    })),
  }
}

function displayCustomer(
  customer: PurchaseOrderRow["customer"],
) {
  const company = customer?.companyName?.trim()
  if (company) return company
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim()
}

function civilDate(value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) return null
  return formatKolkataDate(value)
}

function serialize(row: StoredReceipt): NotificationItem {
  return {
    id: row.id,
    title: row.notification.title,
    body: row.notification.body,
    category: row.notification.category,
    priority: row.notification.priority,
    customerName: row.notification.customerName,
    companyName: row.notification.companyName,
    invoiceNumber: row.notification.invoiceNumber,
    poNumber: row.notification.poNumber,
    href: row.notification.href,
    occurredAt: row.notification.occurredAt.toISOString(),
    read: row.readAt != null,
  }
}

function parseBucket(value?: string): NotificationBucket {
  return NOTIFICATION_BUCKETS.includes(value as NotificationBucket)
    ? (value as NotificationBucket)
    : "all"
}

function parsePriority(value?: string): NotificationPriority | "" {
  return NOTIFICATION_PRIORITIES.includes(value as NotificationPriority)
    ? (value as NotificationPriority)
    : ""
}

function parseSort(value?: string): NotificationSort {
  return NOTIFICATION_SORTS.includes(value as NotificationSort)
    ? (value as NotificationSort)
    : "newest"
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups
}
