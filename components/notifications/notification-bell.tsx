"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  loadNotificationPreview,
  loadUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications"
import type { NotificationItem } from "@/lib/notifications/types"
import { cn } from "@/lib/utils"

import { NotificationRow } from "./presentation"

type Scope = "all" | "unread"
type Status = "idle" | "loading" | "ready" | "error"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("all")
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [version, setVersion] = useState(0)
  const silentRefresh = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadCount() {
      const result = await loadUnreadNotificationCount()
      if (cancelled || !result.ok) return
      setUnreadCount(result.unreadCount)
    }

    void loadCount()
    const timer = window.setInterval(() => void loadCount(), 60_000)
    const onFocus = () => void loadCount()
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const silent = silentRefresh.current
    silentRefresh.current = false
    if (!silent) setStatus("loading")

    void loadNotificationPreview(scope).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setStatus("error")
        setMessage(result.message)
        return
      }
      setItems(result.items)
      setUnreadCount(result.unreadCount)
      setStatus("ready")
    })

    return () => {
      cancelled = true
    }
  }, [open, scope, version])

  async function onRead(id: string) {
    const result = await markNotificationRead(id)
    if (!result.ok) {
      setStatus("error")
      setMessage(result.message)
      return
    }
    silentRefresh.current = true
    setVersion((current) => current + 1)
  }

  async function onReadAll() {
    const result = await markAllNotificationsRead()
    if (!result.ok) {
      setStatus("error")
      setMessage(result.message)
      return
    }
    silentRefresh.current = true
    setVersion((current) => current + 1)
  }

  const badge = unreadCount && unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null
  const showSkeleton = status === "loading" && items == null

  return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) {
            setItems(null)
            setStatus("loading")
          }
        }}
      >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "relative h-10 w-10 shrink-0 rounded-xl border-sky-100 bg-white/90 shadow-sm hover:bg-sky-50",
            badge && "ring-2 ring-sky-200",
          )}
          aria-label={badge ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4 text-sky-800" />
          {badge ? (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
              {badge}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(calc(100vw-1.5rem),26.5rem)] rounded-xl border-sky-100 p-0 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <p className="text-xs text-slate-500">
              {unreadCount == null ? "Checking unread" : `${unreadCount} unread`}
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-sky-800 disabled:opacity-40"
            disabled={!unreadCount}
            onClick={() => void onReadAll()}
          >
            Mark all as read
          </button>
        </div>

        <div className="flex gap-1 px-3 pb-3" role="tablist" aria-label="Notification filters">
          {(["all", "unread"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={scope === item}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold capitalize",
                scope === item
                  ? "bg-sky-50 text-sky-900"
                  : "text-slate-500 hover:bg-slate-50",
              )}
              onClick={() => {
                if (item === scope) return
                setItems(null)
                setStatus("loading")
                setScope(item)
              }}
            >
              {item === "all" ? "All" : "Unread"}
            </button>
          ))}
        </div>

        <div className="max-h-[min(24rem,calc(100svh-12rem))] overflow-y-auto border-t border-sky-100">
          {showSkeleton ? <PreviewSkeleton /> : null}
          {status === "error" ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-700">{message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setVersion((current) => current + 1)}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {status === "ready" && items?.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-800">
                {scope === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Overdue invoices, payments, and purchase orders will appear here.
              </p>
            </div>
          ) : null}
          {status !== "error" && items && items.length > 0 ? (
            <div>
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  density="compact"
                  onRead={(id) => void onRead(id)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <Link
          href="/admin/notifications"
          className="block border-t border-sky-100 px-4 py-3 text-center text-sm font-semibold text-sky-800 hover:bg-sky-50"
          onClick={() => setOpen(false)}
        >
          View all
        </Link>
      </PopoverContent>
    </Popover>
  )
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
