import { describe, expect, it } from "vitest"

import { maskEmailAddress, normalizeEmailAddress } from "./address"
import { attemptDelivery } from "./attempt"
import { publicSmtpStatus, readSmtpConfig } from "./config"
import { applicationLink } from "./links"
import { buildMimeMessage } from "./mime"
import { deliveryOutcome, summarizeEmailJobs } from "./outcome"
import { dedupePlannedJobs, planEmailJobs, type EmailNotificationSource } from "./plan"
import { normalizeCategoryEmailInput, normalizePreferenceInput } from "./preference-input"
import { emailIsMandatory, requiredViewRoute, shouldDeliverInApp } from "./policy"
import { renderNotificationEmail } from "./template"

const now = new Date("2026-10-27T08:00:00.000Z")

const purchaseOrder: EmailNotificationSource = {
  id: "11111111-1111-4111-8111-111111111111",
  dedupeKey: "PO_CREATED|po-1",
  category: "PURCHASE_ORDER",
  eventType: "PO_CREATED",
  priority: "NORMAL",
  title: "Purchase order created",
  body: "Purchase order PO-2026-001 for ABC Pvt. Ltd. was created.",
  customerName: "ABC Pvt. Ltd.",
  companyName: "ABC Pvt. Ltd.",
  invoiceNumber: null,
  poNumber: "PO-2026-001",
  href: "/admin/revenue/view/po-1",
  occurredAt: "2026-10-27T08:00:00.000Z",
  emailEligible: true,
}

const revenueUser = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "Asha@Example.com",
  firstName: "Asha",
  lastName: "Rao",
  viewRoutes: ["/admin/revenue", "/admin/notifications"],
}

const outsider = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "outsider@example.com",
  firstName: "Out",
  lastName: "Sider",
  viewRoutes: ["/admin/notifications"],
}

describe("email planning", () => {
  it("creates one purchase-order email for an authorized recipient", () => {
    const jobs = planEmailJobs({
      notifications: [purchaseOrder],
      users: [revenueUser, outsider],
      preferences: [],
      categoryEnabled: {},
    })

    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.recipientEmail).toBe("asha@example.com")
    expect(jobs[0]?.subject).toBe("New Purchase Order Created — PO-2026-001")
    expect(jobs[0]?.idempotencyKey).toBe(`email:${purchaseOrder.id}:${revenueUser.id}`)
    expect(jobs[0]?.eventKey).toBe(purchaseOrder.dedupeKey)
    expect(JSON.stringify(jobs[0]?.payload)).not.toMatch(/password|poAmount|outstanding/i)
  })

  it("does not create a second job for the same notification and recipient", () => {
    const once = planEmailJobs({
      notifications: [purchaseOrder, purchaseOrder],
      users: [revenueUser],
      preferences: [],
      categoryEnabled: {},
    })
    const twice = planEmailJobs({
      notifications: [purchaseOrder],
      users: [revenueUser],
      preferences: [],
      categoryEnabled: {},
    })

    expect(dedupePlannedJobs([...once, ...twice])).toHaveLength(1)
  })

  it("respects a disabled optional email category and a user opt-out", () => {
    const optedOut = planEmailJobs({
      notifications: [purchaseOrder],
      users: [revenueUser],
      preferences: [{ userId: revenueUser.id, category: "PURCHASE_ORDER", emailEnabled: false }],
      categoryEnabled: { PURCHASE_ORDER: true },
    })
    const paused = planEmailJobs({
      notifications: [purchaseOrder],
      users: [revenueUser],
      preferences: [],
      categoryEnabled: { PURCHASE_ORDER: false },
    })

    expect(optedOut).toHaveLength(0)
    expect(paused).toHaveLength(0)
  })

  it("still emails a mandatory security alert when the user turns email off", () => {
    const jobs = planEmailJobs({
      notifications: [{
        ...purchaseOrder,
        id: "44444444-4444-4444-8444-444444444444",
        category: "SYSTEM",
        eventType: "SYSTEM_USER_ACTIVITY",
        priority: "HIGH",
        title: "User account deactivated",
        body: "A user account was deactivated.",
        poNumber: null,
        customerName: null,
        companyName: null,
        href: "/admin/users",
      }],
      users: [{ ...revenueUser, viewRoutes: ["/admin/users"] }],
      preferences: [{ userId: revenueUser.id, category: "SYSTEM", emailEnabled: false }],
      categoryEnabled: { SYSTEM: false },
    })

    expect(emailIsMandatory({ category: "SYSTEM", priority: "HIGH" })).toBe(true)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.subject).toBe("User account deactivated")
  })

  it("keeps critical in-app alerts even when the category is muted", () => {
    expect(shouldDeliverInApp({
      category: "PAYMENT",
      priority: "CRITICAL",
      inAppEnabled: false,
    })).toBe(true)
    expect(shouldDeliverInApp({
      category: "PAYMENT",
      priority: "NORMAL",
      inAppEnabled: false,
    })).toBe(false)
  })
})

describe("email templates and links", () => {
  it("escapes content and points the button at the authenticated record", () => {
    const rendered = renderNotificationEmail({
      portalName: "Billing & Revenue Portal",
      recipientName: "Asha <Rao>",
      title: "Purchase order created",
      body: "Created <script>alert(1)</script>",
      category: "PURCHASE_ORDER",
      poNumber: "PO-2026-001",
      companyName: "ABC Pvt. Ltd.",
      href: "/admin/revenue/view/po-1",
      occurredAt: "2026-10-27T08:00:00.000Z",
      baseUrl: "http://localhost:3000",
    })

    expect(rendered.html).toContain("Hello Asha &lt;Rao&gt;")
    expect(rendered.html).toContain("&lt;script&gt;")
    expect(rendered.html).not.toContain("<script>")
    expect(rendered.html).toContain("http://localhost:3000/admin/revenue/view/po-1")
    expect(rendered.html).toContain("View purchase order")
    expect(rendered.text).toContain("PO-2026-001")
    expect(applicationLink("//evil.example")).toBeNull()
    expect(applicationLink("https://evil.example", "http://localhost:3000")).toBeNull()
  })

  it("routes financial mail through revenue access and keeps bcc out of the header", () => {
    expect(requiredViewRoute("INVOICE", "/admin/revenue/view/po-1")).toBe("/admin/revenue")
    const mime = buildMimeMessage({
      fromName: "Billing",
      fromAddress: "billing@example.com",
      to: ["asha@example.com"],
      cc: ["audit@example.com"],
      bcc: ["hidden@example.com"],
      subject: "Invoice Created — INV-1",
      text: "Hello",
      html: "<p>Hello</p>",
    })

    expect(mime.message).toContain("Cc: audit@example.com")
    expect(mime.message).not.toContain("hidden@example.com")
    expect(mime.recipients).toContain("hidden@example.com")
  })
})

describe("delivery outcome", () => {
  it("retries a temporary failure and stops at the attempt limit", () => {
    const first = deliveryOutcome({
      attemptCount: 0,
      maxAttempts: 5,
      result: "temporary",
      now,
      error: "SMTP command failed: 450 mailbox busy",
    })
    const last = deliveryOutcome({
      attemptCount: 4,
      maxAttempts: 5,
      result: "temporary",
      now,
      error: "SMTP command failed: 450 mailbox busy",
    })

    expect(first.status).toBe("RETRYING")
    expect(first.attemptCount).toBe(1)
    expect(first.nextAttemptAt.getTime()).toBe(now.getTime() + 2 * 60 * 1000)
    expect(last.status).toBe("FAILED")
    expect(last.attemptCount).toBe(5)
  })

  it("does not consume an attempt when SMTP is not configured", () => {
    const outcome = deliveryOutcome({
      attemptCount: 2,
      maxAttempts: 5,
      result: "deferred",
      now,
    })

    expect(outcome.status).toBe("PENDING")
    expect(outcome.attemptCount).toBe(2)
  })

  it("marks a successful send without changing any other record", () => {
    const outcome = deliveryOutcome({
      attemptCount: 0,
      maxAttempts: 5,
      result: "sent",
      now,
    })

    expect(outcome.status).toBe("SENT")
    expect(outcome.sentAt).toEqual(now)
    expect(Object.keys(outcome).sort()).toEqual([
      "attemptCount",
      "lastAttemptAt",
      "lastError",
      "nextAttemptAt",
      "sentAt",
      "status",
    ])
  })

  it("summarizes open jobs as pending and mixed results as sent", () => {
    expect(summarizeEmailJobs({ RETRYING: 1, SENT: 1 })).toBe("PENDING")
    expect(summarizeEmailJobs({ SENT: 1, FAILED: 1 })).toBe("SENT")
    expect(summarizeEmailJobs({ FAILED: 2 })).toBe("FAILED")
    expect(summarizeEmailJobs({})).toBe("SKIPPED")
  })
})

describe("mocked transport", () => {
  const config = {
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "billing@example.com",
    password: "mailbox-secret",
    fromName: "Billing & Revenue Portal",
    fromAddress: "billing@example.com",
  }

  it("sends the rendered message and does not call the transport when SMTP is missing", async () => {
    const sent: string[] = []
    const delivered = await attemptDelivery({
      job: {
        recipientEmail: "asha@example.com",
        cc: [],
        bcc: [],
        subject: "New Purchase Order Created — PO-2026-001",
        attemptCount: 0,
        maxAttempts: 5,
        payload: {
          recipientName: "Asha",
          title: "Purchase order created",
          body: "Purchase order PO-2026-001 was created.",
          category: "PURCHASE_ORDER",
          eventType: "PO_CREATED",
          poNumber: "PO-2026-001",
          invoiceNumber: "",
          companyName: "ABC Pvt. Ltd.",
          customerName: "ABC Pvt. Ltd.",
          href: "/admin/revenue/view/po-1",
          occurredAt: "2026-10-27T08:00:00.000Z",
        },
      },
      config,
      now,
      portalName: "Billing & Revenue Portal",
      baseUrl: "http://localhost:3000",
      transport: async (mail) => {
        sent.push(mail.html)
      },
    })
    const skipped = await attemptDelivery({
      job: {
        recipientEmail: "asha@example.com",
        cc: [],
        bcc: [],
        subject: "New Purchase Order Created — PO-2026-001",
        attemptCount: 0,
        maxAttempts: 5,
        payload: { title: "Purchase order created", body: "Created" },
      },
      config: null,
      now,
      portalName: "Billing & Revenue Portal",
      transport: async () => {
        throw new Error("transport should not run")
      },
    })

    expect(delivered.status).toBe("SENT")
    expect(sent[0]).toContain("http://localhost:3000/admin/revenue/view/po-1")
    expect(sent.join("")).not.toContain("mailbox-secret")
    expect(skipped.status).toBe("PENDING")
    expect(skipped.attemptCount).toBe(0)
  })

  it("treats a temporary SMTP failure as a retry and a bad address as final", async () => {
    const retried = await attemptDelivery({
      job: {
        recipientEmail: "asha@example.com",
        cc: [],
        bcc: [],
        subject: "Invoice Overdue — INV-9",
        attemptCount: 0,
        maxAttempts: 5,
        payload: { title: "Invoice overdue", body: "Invoice INV-9 is overdue." },
      },
      config,
      now,
      portalName: "Billing & Revenue Portal",
      transport: async () => {
        throw new Error("SMTP command failed: 450 try again")
      },
    })
    const rejected = await attemptDelivery({
      job: {
        recipientEmail: "not an email",
        cc: [],
        bcc: [],
        subject: "Invoice Overdue",
        attemptCount: 0,
        maxAttempts: 5,
        payload: { title: "Invoice overdue", body: "Invoice INV-9 is overdue." },
      },
      config,
      now,
      portalName: "Billing & Revenue Portal",
      transport: async () => {
        throw new Error("should not send")
      },
    })

    expect(retried.status).toBe("RETRYING")
    expect(rejected.status).toBe("FAILED")
    expect(rejected.lastError).toBe("Invalid recipient address")
  })
})

describe("smtp configuration", () => {
  it("keeps the password out of the admin status", () => {
    const env = {
      NODE_ENV: "test",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "billing@example.com",
      SMTP_PASSWORD: "mailbox-secret",
      SMTP_FROM_NAME: "Billing & Revenue Portal",
    } as NodeJS.ProcessEnv

    const status = publicSmtpStatus(env)
    expect(readSmtpConfig(env)?.password).toBe("mailbox-secret")
    expect(status.configured).toBe(true)
    expect(status.passwordConfigured).toBe(true)
    expect(JSON.stringify(status)).not.toContain("mailbox-secret")
    expect(status.fromAddressMasked).toBe(maskEmailAddress("billing@example.com"))
    expect(normalizeEmailAddress("bad address")).toBeNull()
  })
})

describe("preference locks", () => {
  it("does not let a user or administrator turn off mandatory system email", () => {
    const preferences = normalizePreferenceInput(
      ["PAYMENT", "INVOICE", "PURCHASE_ORDER", "CONTRACT", "SYSTEM"].map((category) => ({
        category,
        inAppEnabled: false,
        emailEnabled: false,
      })),
    )
    const categories = normalizeCategoryEmailInput(["PAYMENT"])

    expect(preferences?.find((row) => row.category === "SYSTEM")).toMatchObject({
      inAppEnabled: true,
      emailEnabled: true,
    })
    expect(preferences?.find((row) => row.category === "PAYMENT")?.emailEnabled).toBe(false)
    expect(categories.find((row) => row.category === "SYSTEM")?.emailEnabled).toBe(true)
    expect(categories.find((row) => row.category === "INVOICE")?.emailEnabled).toBe(false)
  })
})
