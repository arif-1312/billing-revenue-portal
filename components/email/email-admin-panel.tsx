"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Mail, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { retryEmailJob, saveEmailCategories, sendTestEmail } from "@/lib/actions/email-admin"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { NotificationCategory } from "@/lib/notifications/types"
import { cn } from "@/lib/utils"

type EmailStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "RETRYING" | ""

export type EmailAdminView = {
  status: {
    configured: boolean
    host: string | null
    port: string | null
    secure: boolean
    fromName: string
    fromAddressMasked: string | null
    userConfigured: boolean
    passwordConfigured: boolean
  }
  canEdit: boolean
  page: number
  pageSize: number
  total: number
  statusFilter: string
  counts: Record<"PENDING" | "PROCESSING" | "SENT" | "FAILED" | "RETRYING", number>
  categories: Array<{
    category: NotificationCategory
    label: string
    description: string
    emailEnabled: boolean
    locked: boolean
  }>
  jobs: Array<{
    id: string
    recipientEmail: string
    subject: string
    templateKey: string
    status: string
    attemptCount: number
    maxAttempts: number
    lastAttemptAt: string | null
    sentAt: string | null
    lastError: string | null
    eventKey: string
    notificationId: string | null
  }>
}

const FILTERS: Array<{ id: EmailStatus; label: string }> = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "RETRYING", label: "Retrying" },
  { id: "FAILED", label: "Failed" },
  { id: "SENT", label: "Sent" },
  { id: "PROCESSING", label: "Processing" },
]

export function EmailAdminPanel({ data }: { data: EmailAdminView }) {
  const router = useRouter()
  const [categories, setCategories] = useState(data.categories)
  const [pending, setPending] = useState<string | null>(null)
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize))
  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1
  const to = Math.min(data.page * data.pageSize, data.total)

  async function onSaveCategories() {
    setPending("categories")
    const result = await saveEmailCategories(
      categories.filter((category) => category.emailEnabled).map((category) => category.category),
    )
    setPending(null)
    if (!result.success) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  async function onTest() {
    setPending("test")
    const result = await sendTestEmail()
    setPending(null)
    if (!result.success) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  async function onRetry(id: string) {
    setPending(id)
    const result = await retryEmailJob(id)
    setPending(null)
    if (!result.success) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-sky-100 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Email delivery</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                SMTP credentials stay in server environment variables. This page shows connection status and delivery history only.
              </p>
            </div>
          </div>
          <Button type="button" disabled={!data.canEdit || pending === "test"} onClick={() => void onTest()}>
            Send test to me
          </Button>
        </header>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          <StatusTile label="Service" value={data.status.configured ? "Ready" : "Not configured"} />
          <StatusTile label="Host" value={data.status.host || "Not set"} />
          <StatusTile
            label="Port"
            value={data.status.port ? `${data.status.port} · ${data.status.secure ? "TLS" : "STARTTLS"}` : "Not set"}
          />
          <StatusTile
            label="Sender"
            value={data.status.fromAddressMasked ? `${data.status.fromName} · ${data.status.fromAddressMasked}` : data.status.fromName}
          />
        </div>
        <p className="border-t border-sky-100 px-4 py-3 text-sm text-slate-500 sm:px-5">
          Mailbox {data.status.userConfigured ? "configured" : "missing"} · Password {data.status.passwordConfigured ? "configured" : "missing"}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-sky-100 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Optional email categories</h2>
            <p className="mt-1 text-sm text-slate-500">System and security email cannot be turned off.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-sky-100"
            disabled={!data.canEdit || pending === "categories"}
            onClick={() => void onSaveCategories()}
          >
            Save categories
          </Button>
        </header>
        <div className="divide-y divide-sky-100">
          {categories.map((category) => (
            <label key={category.category} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <Checkbox
                className="mt-0.5"
                checked={category.emailEnabled}
                disabled={!data.canEdit || category.locked || pending != null}
                onCheckedChange={(checked) =>
                  setCategories((current) =>
                    current.map((row) =>
                      row.category === category.category ? { ...row, emailEnabled: checked === true } : row,
                    ),
                  )
                }
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{category.label}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-500">{category.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
        <header className="border-b border-sky-100 px-4 py-5 sm:px-5">
          <h2 className="text-lg font-semibold text-slate-900">Delivery log</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.counts.FAILED} failed · {data.counts.RETRYING} retrying · {data.counts.PENDING + data.counts.PROCESSING} waiting · {data.counts.SENT} sent
          </p>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-sky-100 px-3 py-3">
          {FILTERS.map((filter) => (
            <Link
              key={filter.id || "all"}
              href={emailHref(filter.id, 1)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm whitespace-nowrap",
                data.statusFilter === filter.id
                  ? "bg-sky-700 text-white"
                  : "bg-sky-50 text-slate-700",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        {data.jobs.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-slate-500">No email jobs in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-sky-100 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Last activity</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3 text-slate-800">{job.recipientEmail}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{job.subject}</p>
                      <p className="mt-1 text-xs text-slate-500">{job.templateKey}</p>
                      {job.lastError ? <p className="mt-1 text-xs text-rose-700">{job.lastError}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{labelStatus(job.status)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {job.attemptCount}/{job.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{job.sentAt || job.lastAttemptAt || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {job.status === "FAILED" && data.canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-sky-100"
                          disabled={pending === job.id}
                          onClick={() => void onRetry(job.id)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-4 sm:px-5">
          <p className="text-sm text-slate-500">
            Showing {from}{data.total > 0 ? `–${to}` : ""} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className={cn("border-sky-100", data.page <= 1 && "pointer-events-none opacity-50")}>
              <Link href={emailHref(data.statusFilter, Math.max(1, data.page - 1))} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className={cn("border-sky-100", data.page >= pageCount && "pointer-events-none opacity-50")}>
              <Link href={emailHref(data.statusFilter, Math.min(pageCount, data.page + 1))} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold break-all text-slate-900">{value}</p>
    </div>
  )
}

function labelStatus(status: string) {
  if (status === "PENDING") return "Pending"
  if (status === "PROCESSING") return "Processing"
  if (status === "SENT") return "Sent"
  if (status === "FAILED") return "Failed"
  if (status === "RETRYING") return "Retrying"
  return status
}

function emailHref(status: string, page: number) {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/admin/email?${query}` : "/admin/email"
}
