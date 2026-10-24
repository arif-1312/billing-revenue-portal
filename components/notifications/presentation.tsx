"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Banknote,
  ClipboardList,
  FileClock,
  FileText,
  Settings,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { NotificationCategory, NotificationItem, NotificationPriority } from "@/lib/notifications/types"
import { cn } from "@/lib/utils"

const CATEGORY_ICON = {
  PAYMENT: Banknote,
  INVOICE: FileText,
  PURCHASE_ORDER: ClipboardList,
  CONTRACT: FileClock,
  SYSTEM: Settings,
} satisfies Record<NotificationCategory, typeof FileText>

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  PAYMENT: "Payment",
  INVOICE: "Invoice",
  PURCHASE_ORDER: "Purchase order",
  CONTRACT: "Contract",
  SYSTEM: "System",
}

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
}

const PRIORITY_TONE: Record<NotificationPriority, { dot: string; icon: string }> = {
  CRITICAL: { dot: "bg-rose-600", icon: "bg-rose-50 text-rose-700" },
  HIGH: { dot: "bg-amber-500", icon: "bg-amber-50 text-amber-800" },
  NORMAL: { dot: "bg-sky-600", icon: "bg-sky-50 text-sky-800" },
  LOW: { dot: "bg-slate-300", icon: "bg-slate-100 text-slate-600" },
}

export function notificationContext(item: NotificationItem) {
  const parts: string[] = []
  if (item.customerName) parts.push(item.customerName)
  if (item.companyName && item.companyName !== item.customerName) {
    parts.push(item.companyName)
  }
  if (item.invoiceNumber) parts.push(`Invoice ${item.invoiceNumber}`)
  if (item.poNumber) parts.push(`PO ${item.poNumber}`)
  return parts
}

export function relativeTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNow(date, { addSuffix: true })
}

export function absoluteTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function NotificationRow({
  item,
  density,
  canDelete = false,
  pending = false,
  onRead,
  onDelete,
}: {
  item: NotificationItem
  density: "compact" | "full"
  canDelete?: boolean
  pending?: boolean
  onRead: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const Icon = CATEGORY_ICON[item.category]
  const tone = PRIORITY_TONE[item.priority]
  const context = notificationContext(item)
  const when = relativeTime(item.occurredAt)
  const exact = absoluteTime(item.occurredAt)

  return (
    <article
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
        density === "full" && "sm:px-5 sm:py-4",
        !item.read && "bg-sky-50/80",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-8 items-center justify-center rounded-lg",
          tone.icon,
        )}
        title={CATEGORY_LABEL[item.category]}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{CATEGORY_LABEL[item.category]}</span>
      </div>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={cn(
              "text-sm text-slate-900",
              item.read ? "font-medium" : "font-semibold",
            )}
          >
            <span
              className={cn("mr-2 inline-block size-1.5 rounded-full align-middle", tone.dot)}
              title={PRIORITY_LABEL[item.priority]}
            />
            <span className="sr-only">{PRIORITY_LABEL[item.priority]} priority. </span>
            {item.title}
          </h3>
          <time
            dateTime={item.occurredAt}
            title={exact}
            className="shrink-0 text-xs text-slate-500"
          >
            {when}
          </time>
        </div>

        <p
          className={cn(
            "mt-1 text-sm leading-5 text-slate-600",
            density === "compact" && "line-clamp-2",
          )}
        >
          {item.body}
        </p>

        {context.length > 0 ? (
          <p className="mt-1 truncate text-xs text-slate-500">{context.join(" · ")}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-slate-500">
            {item.read ? "Read" : "Unread"}
          </span>
          {item.href ? (
            <Link
              href={item.href}
              className="text-xs font-semibold text-sky-800 hover:underline"
              onClick={() => {
                if (!item.read) onRead(item.id)
              }}
            >
              View details
            </Link>
          ) : null}
          {!item.read ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-xs font-semibold text-sky-800"
              disabled={pending}
              onClick={() => onRead(item.id)}
            >
              Mark as read
            </Button>
          ) : null}
          {canDelete && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              disabled={pending}
              onClick={() => onDelete(item.id)}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
