import { describe, expect, it } from "vitest"

import { emailIntentFor } from "./channels"

describe("notification email intent", () => {
  it("keeps phase 1 delivery in-app even for events that can be emailed later", () => {
    const intent = emailIntentFor("PAYMENT_OVERDUE")

    expect(intent.channel).toBe("EMAIL")
    expect(intent.emailEligible).toBe(true)
    expect(intent.emailStatus).toBe("NOT_APPLICABLE")
    expect(intent.emailTemplateKey).toBe("payment_overdue")
  })

  it("does not mark routine record edits as email eligible", () => {
    expect(emailIntentFor("INVOICE_UPDATED").emailEligible).toBe(false)
    expect(emailIntentFor("INVOICE_UPDATED").emailStatus).toBe("NOT_APPLICABLE")
  })
})
