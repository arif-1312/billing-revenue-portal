import { describe, expect, it } from "vitest"

import { emailIntentFor } from "./channels"

describe("notification email intent", () => {
  it("emails purchase-order and P&L events only", () => {
    const purchaseOrder = emailIntentFor("PO_CREATED")
    const project = emailIntentFor("PL_UPDATED")

    expect(purchaseOrder.emailEligible).toBe(true)
    expect(purchaseOrder.emailStatus).toBe("PENDING")
    expect(project.emailEligible).toBe(true)
    expect(project.emailTemplateKey).toBe("pl_updated")
    expect(emailIntentFor("PAYMENT_OVERDUE").emailEligible).toBe(false)
    expect(emailIntentFor("INVOICE_CREATED").emailEligible).toBe(false)
    expect(emailIntentFor("CONTRACT_EXPIRED").emailEligible).toBe(false)
    expect(emailIntentFor("SYSTEM_RECORD_CHANGE").emailEligible).toBe(false)
  })

  it("keeps standing payment-pending reminders in the notification centre only", () => {
    expect(emailIntentFor("INVOICE_PAYMENT_PENDING").emailEligible).toBe(false)
    expect(emailIntentFor("INVOICE_PAYMENT_PENDING").emailStatus).toBe("NOT_APPLICABLE")
  })

  it("does not email an email-delivery failure alert", () => {
    expect(emailIntentFor("SYSTEM_EMAIL_FAILURE").emailEligible).toBe(false)
  })
})
