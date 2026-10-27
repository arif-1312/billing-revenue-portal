import { describe, expect, it } from "vitest"

import { emailIntentFor } from "./channels"

describe("notification email intent", () => {
  it("queues an email job for payment events that already exist", () => {
    const intent = emailIntentFor("PAYMENT_OVERDUE")

    expect(intent.channel).toBe("EMAIL")
    expect(intent.emailEligible).toBe(true)
    expect(intent.emailStatus).toBe("PENDING")
    expect(intent.emailTemplateKey).toBe("payment_overdue")
  })

  it("keeps standing payment-pending reminders in the notification centre only", () => {
    expect(emailIntentFor("INVOICE_PAYMENT_PENDING").emailEligible).toBe(false)
    expect(emailIntentFor("INVOICE_PAYMENT_PENDING").emailStatus).toBe("NOT_APPLICABLE")
  })

  it("does not email an email-delivery failure alert", () => {
    expect(emailIntentFor("SYSTEM_EMAIL_FAILURE").emailEligible).toBe(false)
  })
})
