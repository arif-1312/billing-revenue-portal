"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveNotificationPreferences } from "@/lib/actions/notification-preferences"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { NotificationCategory } from "@/lib/notifications/types"

export type PreferenceRow = {
  category: NotificationCategory
  label: string
  description: string
  inAppEnabled: boolean
  emailEnabled: boolean
  inAppLocked: boolean
  emailLocked: boolean
  emailPaused: boolean
}

export function NotificationPreferences({ items }: { items: PreferenceRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(items)
  const [pending, setPending] = useState(false)

  function update(category: NotificationCategory, key: "inAppEnabled" | "emailEnabled", value: boolean) {
    setRows((current) =>
      current.map((row) => (row.category === category ? { ...row, [key]: value } : row)),
    )
  }

  async function onSave() {
    setPending(true)
    const result = await saveNotificationPreferences({
      items: rows.map((row) => ({
        category: row.category,
        inAppEnabled: row.inAppEnabled,
        emailEnabled: row.emailEnabled,
      })),
    })
    setPending(false)
    if (!result.success) {
      toast.error(result.message)
      return
    }
    toast.success(result.message)
    router.refresh()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <header className="border-b border-sky-100 px-4 py-5 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Notification preferences</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Choose which categories appear in the notification centre. Purchase order and P&L changes are also emailed.
        </p>
      </header>
      <div className="divide-y divide-sky-100">
        {rows.map((row) => (
          <div key={row.category} className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{row.description}</p>
              {row.emailPaused ? (
                <p className="mt-1 text-sm text-amber-800">An administrator has paused email for this category.</p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={row.inAppEnabled}
                disabled={row.inAppLocked || pending}
                onCheckedChange={(checked) => update(row.category, "inAppEnabled", checked === true)}
              />
              In-app
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={row.emailEnabled}
                disabled={row.emailLocked || row.emailPaused || pending}
                onCheckedChange={(checked) => update(row.category, "emailEnabled", checked === true)}
              />
              Email
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-sky-100 px-4 py-4 sm:px-5">
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          Save preferences
        </Button>
      </div>
    </section>
  )
}
