import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("email service boundaries", () => {
  it("does not change an email when an in-app notification is marked read", () => {
    const source = readFileSync("lib/notifications/store.ts", "utf8")
    const start = source.indexOf("export async function markNotificationReceiptRead")
    const end = source.indexOf("export async function markAllNotificationReceiptsRead")
    const markRead = source.slice(start, end)

    expect(markRead).not.toMatch(/emailJob|EmailJob|emailStatus/)
  })

  it("does not repeat financial writes while delivering or retrying mail", () => {
    const deliver = readFileSync("lib/email/deliver.ts", "utf8")
    const queue = readFileSync("lib/email/queue.ts", "utf8")
    const attempt = readFileSync("lib/email/attempt.ts", "utf8")
    const combined = `${deliver}\n${queue}\n${attempt}`

    expect(combined).not.toMatch(/purchaseOrder|billingCycle|BillingCyclePayment/)
  })

  it("does not put SMTP secrets in the admin interface", () => {
    const panel = readFileSync("components/email/email-admin-panel.tsx", "utf8")
    const preferences = readFileSync("components/notifications/notification-preferences.tsx", "utf8")

    expect(panel).not.toMatch(/SMTP_PASSWORD|type="password"/)
    expect(preferences).not.toMatch(/SMTP_PASSWORD/)
  })
})
