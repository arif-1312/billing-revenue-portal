import { describe, expect, it } from "vitest"

import {
  daysFromToday,
  stateNotificationDrafts,
  transitionNotificationDrafts,
  type PurchaseOrderSnapshot,
} from "./model"

const today = new Date("2026-10-24T10:00:00+05:30")

function order(
  overrides: Partial<PurchaseOrderSnapshot> = {},
): PurchaseOrderSnapshot {
  return {
    id: "po-1",
    poNumber: "PO-19",
    status: "LIVE",
    startOn: "2026-04-01",
    endOn: "2027-03-31",
    contractId: null,
    contractName: null,
    customerName: "Acme",
    companyName: "SY Associates",
    poAmount: 12000,
    invoices: [],
    ...overrides,
  }
}

function invoice(
  overrides: Partial<PurchaseOrderSnapshot["invoices"][number]> = {},
) {
  return {
    invoiceNumber: "INV-9",
    invoiceAmount: 1000,
    invoiceOn: "2026-09-01",
    dueOn: "2026-10-20",
    receipts: [],
    ...overrides,
  }
}

function types(drafts: { eventType: string }[]) {
  return drafts.map((draft) => draft.eventType)
}

describe("notification state evaluation", () => {
  it("marks a past due unpaid invoice overdue once for payment and invoice", () => {
    const drafts = stateNotificationDrafts(
      order({ invoices: [invoice({ receipts: [{ receivedOn: "2026-10-01", amount: 250 }] })] }),
      today,
    )

    expect(types(drafts)).toEqual(["PAYMENT_OVERDUE", "INVOICE_OVERDUE"])
    expect(drafts[0]?.body).toContain("Rs.750.00")
    expect(drafts[0]?.dedupeKey).toBe(drafts[0]?.dedupeKey)
    expect(stateNotificationDrafts(
      order({ invoices: [invoice({ receipts: [{ receivedOn: "2026-10-01", amount: 250 }] })] }),
      today,
    ).map((draft) => draft.dedupeKey)).toEqual(drafts.map((draft) => draft.dedupeKey))
  })

  it("does not mark a fully paid or overpaid invoice overdue", () => {
    const paid = stateNotificationDrafts(
      order({
        invoices: [invoice({ receipts: [{ receivedOn: "2026-10-21", amount: 1000 }] })],
      }),
      today,
    )
    const overpaid = stateNotificationDrafts(
      order({
        invoices: [invoice({ receipts: [{ receivedOn: "2026-10-21", amount: 1200 }] })],
      }),
      today,
    )

    expect(types(paid)).not.toContain("PAYMENT_OVERDUE")
    expect(types(overpaid)).not.toContain("INVOICE_OVERDUE")
  })

  it("does not mark an invoice overdue without a due date", () => {
    const drafts = stateNotificationDrafts(
      order({ invoices: [invoice({ dueOn: null })] }),
      today,
    )

    expect(types(drafts)).toEqual(["INVOICE_PAYMENT_PENDING"])
    expect(drafts[0]?.body).toContain("No payment due date")
  })

  it("separates due today, the next three days, and later pending invoices", () => {
    const dueToday = types(stateNotificationDrafts(
      order({ invoices: [invoice({ dueOn: "2026-10-24" })] }),
      today,
    ))
    const dueSoon = types(stateNotificationDrafts(
      order({ invoices: [invoice({ dueOn: "2026-10-27" })] }),
      today,
    ))
    const later = types(stateNotificationDrafts(
      order({ invoices: [invoice({ dueOn: "2026-10-28" })] }),
      today,
    ))

    expect(dueToday).toEqual(["PAYMENT_DUE_TODAY"])
    expect(dueSoon).toEqual(["PAYMENT_DUE_SOON"])
    expect(later).toEqual(["INVOICE_PAYMENT_PENDING"])
  })

  it("uses the Kolkata calendar when UTC is still the previous day", () => {
    const kolkataMorning = new Date("2026-10-23T20:30:00.000Z")
    expect(daysFromToday(kolkataMorning, "2026-10-24")).toBe(0)

    const drafts = stateNotificationDrafts(
      order({ invoices: [invoice({ dueOn: "2026-10-24" })] }),
      kolkataMorning,
    )
    expect(types(drafts)).toEqual(["PAYMENT_DUE_TODAY"])
  })

  it("reminds on live purchase orders and linked contracts inside 30 days", () => {
    const drafts = stateNotificationDrafts(
      order({
        endOn: "2026-11-10",
        contractId: "contract-1",
        contractName: "AMC",
      }),
      today,
    )

    expect(types(drafts)).toEqual(["PO_EXPIRING_SOON", "CONTRACT_EXPIRING_SOON"])
  })

  it("treats a past end date on a live order as expired", () => {
    const drafts = stateNotificationDrafts(
      order({
        endOn: "2026-10-01",
        contractId: "contract-1",
        contractName: "AMC",
      }),
      today,
    )

    expect(types(drafts)).toEqual(["PO_EXPIRED", "CONTRACT_EXPIRED"])
  })

  it("does not call a closed purchase order expired, and skips contracts that are not linked", () => {
    const closed = types(stateNotificationDrafts(
      order({ status: "CLOSED", endOn: "2026-10-01", contractId: "contract-1" }),
      today,
    ))
    const unlinked = types(stateNotificationDrafts(
      order({ endOn: "2026-11-01" }),
      today,
    ))

    expect(closed).toEqual(["CONTRACT_EXPIRED"])
    expect(unlinked).toEqual(["PO_EXPIRING_SOON"])
    expect(unlinked).not.toContain("CONTRACT_EXPIRING_SOON")
  })
})

describe("notification transitions", () => {
  it("records created invoices and a partial payment without a full-payment event", () => {
    const drafts = transitionNotificationDrafts(
      null,
      order({
        invoices: [invoice({ receipts: [{ receivedOn: "2026-10-02", amount: 400 }] })],
      }),
    )

    expect(types(drafts)).toEqual([
      "PO_CREATED",
      "INVOICE_CREATED",
      "PAYMENT_PARTIAL",
      "INVOICE_PARTIALLY_PAID",
    ])
    expect(drafts.find((draft) => draft.eventType === "PAYMENT_PARTIAL")?.body).toContain("Rs.600.00")
  })

  it("records a settling payment as received and fully paid", () => {
    const before = order({ invoices: [invoice()] })
    const after = order({
      invoices: [invoice({ receipts: [{ receivedOn: "2026-10-22", amount: 1000 }] })],
    })
    const drafts = transitionNotificationDrafts(before, after)

    expect(types(drafts)).toEqual(["PAYMENT_RECEIVED", "INVOICE_FULLY_PAID"])
  })

  it("does not repeat a payment that was already recorded", () => {
    const snapshot = order({
      invoices: [invoice({ receipts: [{ receivedOn: "2026-10-22", amount: 400 }] })],
    })

    expect(transitionNotificationDrafts(snapshot, snapshot)).toEqual([])
  })

  it("treats an amount change on the same invoice as an update", () => {
    const before = order({ invoices: [invoice()] })
    const after = order({ invoices: [invoice({ invoiceAmount: 1200 })] })
    const drafts = transitionNotificationDrafts(before, after)

    expect(types(drafts)).toContain("INVOICE_UPDATED")
    expect(types(drafts)).toContain("PO_UPDATED")
    expect(types(drafts)).not.toContain("INVOICE_CREATED")
  })

  it("records closure once when status is the only change", () => {
    const before = order({ invoices: [invoice({ dueOn: "2026-12-01" })] })
    const after = order({
      status: "CLOSED",
      invoices: [invoice({ dueOn: "2026-12-01" })],
    })
    const drafts = transitionNotificationDrafts(before, after)

    expect(types(drafts)).toEqual(["PO_CLOSED"])
  })
})
