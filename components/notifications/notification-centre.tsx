"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications"
import type {
  NotificationBucket,
  NotificationCentreData,
  NotificationSort,
} from "@/lib/notifications/types"
import { cn } from "@/lib/utils"

import { NotificationRow } from "./presentation"

const BUCKETS: { id: NotificationBucket; label: string }[] = [
  { id: "all", label: "All notifications" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "payment", label: "Payments" },
  { id: "invoice", label: "Invoices" },
  { id: "purchase_order", label: "Purchase orders" },
  { id: "contract", label: "Contracts" },
  { id: "system", label: "System" },
]

const selectClassName =
  "h-9 rounded-md border border-sky-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus-visible:border-sky-300 focus-visible:ring-[3px] focus-visible:ring-sky-100"

export function NotificationCentre(data: NotificationCentreData) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize))
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1
  const to = Math.min(data.page * data.pageSize, data.total)
  const filters = {
    q: data.q,
    bucket: data.bucket,
    sort: data.sort,
  }

  async function onRead(id: string) {
    setPendingId(id)
    setError("")
    const result = await markNotificationRead(id)
    setPendingId(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this notification?")) return
    setPendingId(id)
    setError("")
    const result = await deleteNotification(id)
    setPendingId(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  async function onReadAll() {
    setMarkingAll(true)
    setError("")
    const result = await markAllNotificationsRead()
    setMarkingAll(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-sky-100 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Notification centre
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.unreadCount === 1
              ? "1 unread notification"
              : `${data.unreadCount} unread notifications`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-sky-100"
          disabled={data.unreadCount === 0 || markingAll}
          onClick={() => void onReadAll()}
        >
          Mark all as read
        </Button>
      </header>

      <div className="md:flex">
        <nav
          aria-label="Notification categories"
          className="flex gap-1 overflow-x-auto border-b border-sky-100 px-3 py-3 md:block md:w-60 md:shrink-0 md:border-r md:border-b-0 md:px-3 md:py-4"
        >
          {BUCKETS.map((item) => {
            const active = data.bucket === item.id
            return (
              <Link
                key={item.id}
                href={centreHref({ ...filters, bucket: item.id, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm md:w-full",
                  active
                    ? "bg-sky-50 font-semibold text-sky-900"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span>{item.label}</span>
                <span className="text-xs tabular-nums text-slate-500">
                  {data.counts[item.id]}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <form
            key={`${data.q}|${data.sort}|${data.bucket}`}
            className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 lg:flex-row lg:flex-wrap lg:items-center"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const next = {
                q: String(form.get("q") ?? ""),
                bucket: data.bucket,
                sort: String(form.get("sort") ?? "newest") as NotificationSort,
                page: 1,
              }
              router.push(centreHref(next))
            }}
          >
            <Input
              name="q"
              defaultValue={data.q}
              placeholder="Search title, customer, invoice, or PO"
              aria-label="Search notifications"
              className="max-w-md border-sky-100"
            />
            <select
              name="sort"
              defaultValue={data.sort}
              aria-label="Sort"
              className={selectClassName}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
            </select>
            <Button type="submit" variant="outline" className="border-sky-100">
              Apply
            </Button>
          </form>

          {error ? (
            <p className="px-4 py-3 text-sm text-rose-700 sm:px-5" role="alert">
              {error}
            </p>
          ) : null}

          {data.items.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-sm font-semibold text-slate-800">{emptyTitle(data)}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Overdue invoices, payments, purchase orders, contracts, and system activity will appear here.
              </p>
            </div>
          ) : (
            <div>
              {data.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  density="full"
                  canDelete={data.canDelete}
                  pending={pendingId === item.id}
                  onRead={(id) => void onRead(id)}
                  onDelete={(id) => void onDelete(id)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-700">{from}</span>
              {data.total > 0 ? (
                <>
                  {" "}
                  – <span className="font-semibold text-slate-700">{to}</span>
                </>
              ) : null}{" "}
              of <span className="font-semibold text-slate-700">{data.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <p className="mr-2 text-sm text-slate-500">
                Page <span className="font-semibold text-slate-700">{data.page}</span> of{" "}
                <span className="font-semibold text-slate-700">{pageCount}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className={cn("border-sky-100", data.page <= 1 && "pointer-events-none opacity-50")}
              >
                <Link
                  href={centreHref({ ...filters, page: Math.max(1, data.page - 1) })}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className={cn(
                  "border-sky-100",
                  data.page >= pageCount && "pointer-events-none opacity-50",
                )}
              >
                <Link
                  href={centreHref({ ...filters, page: Math.min(pageCount, data.page + 1) })}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function NotificationCentreError({ message }: { message: string }) {
  return (
    <section className="rounded-2xl border border-sky-100 bg-white px-6 py-16 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Notification centre</h1>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </section>
  )
}

function emptyTitle(data: NotificationCentreData) {
  if (data.q) return "No notifications match these filters."
  if (data.bucket === "unread") return "No unread notifications."
  if (data.bucket === "read") return "No read notifications."
  if (data.bucket !== "all") return "Nothing in this category."
  return "No notifications yet."
}

function centreHref(input: {
  q: string
  bucket: NotificationBucket
  sort: NotificationSort
  page: number
}) {
  const params = new URLSearchParams()
  const q = input.q.trim()
  if (q) params.set("q", q)
  if (input.bucket !== "all") params.set("bucket", input.bucket)
  if (input.sort !== "newest") params.set("sort", input.sort)
  if (input.page > 1) params.set("page", String(input.page))
  const query = params.toString()
  return query ? `/admin/notifications?${query}` : "/admin/notifications"
}
