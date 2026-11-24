"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  fieldLabel,
  formatAuditValue,
  type ActivityLogRow,
  type AuditChange,
} from "@/lib/audit-format"
import { cn } from "@/lib/utils"

type ActivityLogViewProps = {
  rows: ActivityLogRow[]
  total: number
  page: number
  pageSize: number
  q: string
  model: string
  action: string
  models: string[]
}

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function ActivityLogView({
  rows,
  total,
  page,
  pageSize,
  q,
  model,
  action,
  models,
}: ActivityLogViewProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<ActivityLogRow | null>(null)

  const visibleSelected = selected && rows.some((row) => row.id === selected.id)
    ? selected
    : null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const filters = { q, model, action }
  const hasFilters = Boolean(q || model || action)

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-2xl font-bold">Activity Log</CardTitle>
          <p className="text-sm text-slate-500">
            Every create, update, and delete, with the person who made it and
            the values before and after.
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <form
            key={`${q}|${model}|${action}`}
            action="/admin/activity-log"
            className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const params = new URLSearchParams()

              for (const [key, value] of data.entries()) {
                const text = String(value).trim()
                if (text) params.set(key, text)
              }

              const query = params.toString()
              router.push(query ? `/admin/activity-log?${query}` : "/admin/activity-log")
            }}
          >
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search user or record id"
              className="max-w-sm"
              aria-label="Search user or record id"
            />

            <select
              name="model"
              defaultValue={model}
              className={selectClassName}
              aria-label="Record type"
            >
              <option value="">All records</option>
              {models.map((item) => (
                <option key={item} value={item}>
                  {fieldLabel(item)}
                </option>
              ))}
            </select>

            <select
              name="action"
              defaultValue={action}
              className={selectClassName}
              aria-label="Action"
            >
              <option value="">All actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
            </select>

            <div className="flex items-center gap-2">
              <Button type="submit" className="bg-[#1976D2] hover:bg-[#155EA8]">
                Filter
              </Button>
              {hasFilters ? (
                <Button variant="outline" asChild>
                  <Link href="/admin/activity-log">Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-sky-300/60 bg-sky-600 hover:bg-sky-600">
                  <TableHead className="whitespace-nowrap text-sky-50">
                    When
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-sky-50">
                    Who
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-sky-50">
                    Action
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-sky-50">
                    Record
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-sky-50">
                    What changed
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-right text-sky-50">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={
                        index % 2 === 0
                          ? "bg-emerald-50/70 hover:bg-emerald-100/80"
                          : "bg-white hover:bg-slate-50"
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(row.createdAt), "dd MMM yyyy, h:mm a")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.userName || "System"}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={row.action} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{fieldLabel(row.model)}</div>
                        <div
                          className="font-mono text-xs text-slate-500"
                          title={row.recordId || undefined}
                        >
                          {shortId(row.recordId)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {row.summary}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelected(row)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {hasFilters
                        ? "No changes match these filters."
                        : "No changes have been recorded yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">{from}</span>
              {total > 0 ? (
                <>
                  {" "}
                  – <span className="font-semibold text-slate-700">{to}</span>
                </>
              ) : null}{" "}
              of <span className="font-semibold text-slate-700">{total}</span>{" "}
              entries
            </p>

            <div className="flex items-center gap-2">
              <p className="mr-2 text-sm text-slate-500">
                Page <span className="font-semibold text-slate-700">{page}</span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">{pageCount}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
              >
                <Link
                  href={pageHref(Math.max(1, page - 1), filters)}
                  aria-disabled={page <= 1}
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
                  page >= pageCount && "pointer-events-none opacity-50",
                )}
              >
                <Link
                  href={pageHref(Math.min(pageCount, page + 1), filters)}
                  aria-disabled={page >= pageCount}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      <Dialog open={Boolean(visibleSelected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          {visibleSelected ? <AuditDetail row={visibleSelected} /> : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function AuditDetail({ row }: { row: ActivityLogRow }) {
  const entries = Object.entries(row.changes ?? {})

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {fieldLabel(row.model)} {actionPast(row.action)}
        </DialogTitle>
        <DialogDescription>
          {row.userName || "System"} ·{" "}
          {format(new Date(row.createdAt), "dd MMM yyyy, h:mm a")}
          {row.recordId ? ` · ${row.recordId}` : ""}
        </DialogDescription>
      </DialogHeader>

      {entries.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([field, change]) => (
                <TableRow key={field}>
                  <TableCell className="align-top font-medium">
                    {fieldLabel(field)}
                  </TableCell>
                  <ValueCell value={(change as AuditChange).from} />
                  <ValueCell value={(change as AuditChange).to} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No field values changed.</p>
      )}
    </>
  )
}

function ValueCell({ value }: { value: unknown }) {
  const text = formatAuditValue(value)
  const multiline = text.includes("\n")

  return (
    <TableCell className="align-top">
      <pre
        className={cn(
          "font-sans text-sm whitespace-pre-wrap break-words",
          multiline && "max-h-40 overflow-auto rounded-md bg-slate-50 p-2 text-xs",
        )}
      >
        {text}
      </pre>
    </TableCell>
  )
}

function ActionBadge({ action }: { action: ActivityLogRow["action"] }) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        action === "CREATE" && "bg-emerald-100 text-emerald-800",
        action === "UPDATE" && "bg-sky-100 text-sky-800",
        action === "DELETE" && "bg-rose-100 text-rose-800",
      )}
    >
      {actionLabel(action)}
    </Badge>
  )
}

function actionLabel(action: ActivityLogRow["action"]) {
  if (action === "CREATE") return "Create"
  if (action === "DELETE") return "Delete"
  return "Update"
}

function actionPast(action: ActivityLogRow["action"]) {
  if (action === "CREATE") return "created"
  if (action === "DELETE") return "deleted"
  return "updated"
}

function shortId(recordId: string | null) {
  if (!recordId) return "—"
  return recordId.length > 8 ? `${recordId.slice(0, 8)}…` : recordId
}

function pageHref(
  page: number,
  filters: { q: string; model: string; action: string },
) {
  const params = new URLSearchParams()

  if (filters.q) params.set("q", filters.q)
  if (filters.model) params.set("model", filters.model)
  if (filters.action) params.set("action", filters.action)
  if (page > 1) params.set("page", String(page))

  const query = params.toString()
  return query ? `/admin/activity-log?${query}` : "/admin/activity-log"
}
