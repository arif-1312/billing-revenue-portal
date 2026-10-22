import { describe, expect, it } from "vitest";

import { classifyInvoiceReceivable } from "./invoice-balances";

const today = new Date("2026-10-21T08:00:00+05:30");

function invoice(overrides: Parameters<typeof classifyInvoiceReceivable>[0]) {
  return {
    invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
    invoiceAmount: 1000,
    collectedAmount: 0,
    paymentReceived: "NO",
    paymentDueDate: new Date("2026-10-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("invoice receivable balances", () => {
  it("keeps an unpaid invoice outstanding until the due date, then moves it to overdue", () => {
    const beforeDue = classifyInvoiceReceivable(
      invoice({ paymentDueDate: new Date("2026-11-01T00:00:00.000Z"), invoiceAmount: 400 }),
      today,
    );
    const dueToday = classifyInvoiceReceivable(
      invoice({ paymentDueDate: new Date("2026-10-21T00:00:00.000Z"), invoiceAmount: 250 }),
      today,
    );
    const afterDue = classifyInvoiceReceivable(invoice({}), today);

    expect(beforeDue).toEqual({ outstanding: 400, overdue: 0, notYetDue: 400, undated: 0 });
    expect(dueToday).toEqual({ outstanding: 0, overdue: 250, notYetDue: 0, undated: 0 });
    expect(afterDue).toEqual({ outstanding: 0, overdue: 1000, notYetDue: 0, undated: 0 });
    expect(beforeDue.outstanding + dueToday.overdue + afterDue.overdue).toBe(1650);
    expect(beforeDue.outstanding + beforeDue.overdue).toBe(400);
    expect(dueToday.outstanding + dueToday.overdue).toBe(250);
  });

  it("keeps a partially collected unpaid invoice at its remaining balance once", () => {
    const parts = classifyInvoiceReceivable(
      invoice({
        invoiceAmount: 1000,
        collectedAmount: 900,
        payments: [{ amount: 250 }, { amount: 150 }],
      }),
      today,
    );

    expect(parts.outstanding).toBe(0);
    expect(parts.overdue).toBe(600);
  });

  it("excludes invoices whose payment has been received", () => {
    const parts = classifyInvoiceReceivable(
      invoice({ paymentReceived: "YES", collectedAmount: 900, invoiceAmount: 1000 }),
      today,
    );

    expect(parts).toEqual({ outstanding: 0, overdue: 0, notYetDue: 0, undated: 0 });
  });

  it("excludes invoices dated after today and invoices with no invoice date", () => {
    expect(
      classifyInvoiceReceivable(invoice({ invoiceDate: new Date("2026-10-22T00:00:00.000Z") }), today).outstanding,
    ).toBe(0);
    expect(classifyInvoiceReceivable(invoice({ invoiceDate: null }), today).outstanding).toBe(0);
  });

  it("keeps an unpaid invoice with no due date outstanding but not overdue", () => {
    const parts = classifyInvoiceReceivable(invoice({ paymentDueDate: null }), today);

    expect(parts).toEqual({ outstanding: 1000, overdue: 0, notYetDue: 0, undated: 1000 });
  });
});
