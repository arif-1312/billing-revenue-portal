export const NOTIFICATION_CATEGORIES = [
  "PAYMENT",
  "INVOICE",
  "PURCHASE_ORDER",
  "CONTRACT",
  "SYSTEM",
] as const

export const NOTIFICATION_PRIORITIES = [
  "CRITICAL",
  "HIGH",
  "NORMAL",
  "LOW",
] as const

export const NOTIFICATION_BUCKETS = [
  "all",
  "unread",
  "read",
  "payment",
  "invoice",
  "purchase_order",
  "contract",
  "system",
] as const

export const NOTIFICATION_SORTS = ["newest", "oldest", "priority"] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number]
export type NotificationBucket = (typeof NOTIFICATION_BUCKETS)[number]
export type NotificationSort = (typeof NOTIFICATION_SORTS)[number]
export type NotificationKind = "STATE" | "EVENT"

export type NotificationItem = {
  id: string
  title: string
  body: string
  category: NotificationCategory
  priority: NotificationPriority
  customerName: string | null
  companyName: string | null
  invoiceNumber: string | null
  poNumber: string | null
  href: string | null
  occurredAt: string
  read: boolean
}

export type NotificationCentreData = {
  items: NotificationItem[]
  total: number
  page: number
  pageSize: number
  q: string
  bucket: NotificationBucket
  priority: NotificationPriority | ""
  sort: NotificationSort
  counts: Record<NotificationBucket, number>
  unreadCount: number
  canDelete: boolean
}
