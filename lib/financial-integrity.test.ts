import { describe, expect, it, vi } from "vitest";

import {
  flushAuditEvents,
  runInAuditBuffer,
  stageFinancialAuditForTests,
} from "./audit";
import {
  assertInvoiceNumbersAvailable,
  invoiceNumberKey,
  lockPurchaseOrders,
} from "./financial-write";
import {
  collectedAmountDisagrees,
  collectedAmountOf,
} from "./invoice-balances";
import { moneyEquals, moneyToNumber, splitMoney } from "./money";
import {
  importPaymentReplacementBlock,
  purchaseOrderDeleteBlock,
} from "./purchase-order-guard";

describe("purchase order deletion rules", () => {
  it("blocks ordinary deletion of a closed order and of paid history", () => {
    expect(purchaseOrderDeleteBlock({
      status: "CLOSED",
      actorIsSystem: false,
      hasPaidCycle: false,
    })).toMatch(/Closed purchase orders/);

    expect(purchaseOrderDeleteBlock({
      status: "LIVE",
      actorIsSystem: false,
      hasPaidCycle: true,
    })).toMatch(/Paid billing history/);

    expect(purchaseOrderDeleteBlock({
      status: "CLOSED",
      actorIsSystem: true,
      hasPaidCycle: true,
    })).toBeNull();

    expect(purchaseOrderDeleteBlock({
      status: "LIVE",
      actorIsSystem: false,
      hasPaidCycle: false,
    })).toBeNull();
  });
});

describe("import payment history", () => {
  it("rejects a spreadsheet that would replace existing receipts", () => {
    expect(importPaymentReplacementBlock({
      paymentCount: 2,
      paymentTotal: 20000,
      incomingCollected: 45000,
    })).toMatch(/cannot be replaced/);

    expect(importPaymentReplacementBlock({
      paymentCount: 2,
      paymentTotal: "20000.00",
      incomingCollected: 20000,
    })).toBeNull();

    expect(importPaymentReplacementBlock({
      paymentCount: 0,
      paymentTotal: 0,
      incomingCollected: 20000,
    })).toBeNull();
  });
});

describe("collected amount source", () => {
  it("uses payment rows once and does not treat a paid flag as cash", () => {
    const invoice = {
      invoiceAmount: 50000,
      creditNote: 5000,
      collectedAmount: 0,
      payments: [{ amount: 20000 }],
    };

    expect(moneyToNumber(collectedAmountOf(invoice))).toBe(20000);
    expect(collectedAmountDisagrees(invoice)).toBe(true);
    expect(moneyToNumber(collectedAmountOf({
      collectedAmount: 0,
      payments: [],
    }))).toBe(0);
  });
});

describe("purchase order amount splits", () => {
  it("keeps the remainder paise on the last cycle", () => {
    const shares = splitMoney("10000.01", 3);
    const total = shares.reduce((sum, share) => sum.plus(share));

    expect(shares.map((share) => moneyToNumber(share))).toEqual([
      3333.33,
      3333.33,
      3333.35,
    ]);
    expect(moneyEquals(total, "10000.01")).toBe(true);
  });
});

describe("invoice numbers", () => {
  it("rejects a new duplicate and a repeated new number", async () => {
    const query = vi.fn().mockResolvedValue([])
    const findMany = vi.fn().mockResolvedValue([])

    await expect(assertInvoiceNumbersAvailable(
      { $queryRaw: query, $executeRaw: vi.fn(), billingCycle: { findMany } } as never,
      [
        { invoiceNumber: " INV-9 " },
        { invoiceNumber: "inv-9" },
      ],
    )).rejects.toThrow(/repeated/i)
  })

  it("rejects a new invoice that uses a number already stored", async () => {
    const query = vi.fn().mockResolvedValue([])
    const findMany = vi.fn().mockResolvedValue([
      { id: "cycle-2", invoiceNumber: "inv-9" },
    ])

    await expect(assertInvoiceNumbersAvailable(
      { $queryRaw: query, $executeRaw: vi.fn(), billingCycle: { findMany } } as never,
      [{ invoiceNumber: "INV-9" }],
    )).rejects.toThrow(/already exists/i)
  })

  it("still allows an existing duplicate to be saved without renumbering it", async () => {
    const query = vi.fn().mockResolvedValue([])
    const findMany = vi.fn().mockResolvedValue([
      { id: "cycle-1", invoiceNumber: "INV-9" },
      { id: "cycle-2", invoiceNumber: "inv-9" },
    ])

    await expect(assertInvoiceNumbersAvailable(
      { $queryRaw: query, $executeRaw: vi.fn(), billingCycle: { findMany } } as never,
      [{ invoiceNumber: "INV-9", exceptId: "cycle-1" }],
    )).resolves.toBeUndefined()
  })

  it("allows two invoices to exchange numbers", async () => {
    const query = vi.fn().mockResolvedValue([])
    const findMany = vi.fn().mockResolvedValue([
      { id: "cycle-a", invoiceNumber: "INV-1" },
      { id: "cycle-b", invoiceNumber: "INV-2" },
    ])

    await expect(assertInvoiceNumbersAvailable(
      { $queryRaw: query, $executeRaw: vi.fn(), billingCycle: { findMany } } as never,
      [
        { invoiceNumber: "INV-2", exceptId: "cycle-a" },
        { invoiceNumber: "INV-1", exceptId: "cycle-b" },
      ],
    )).resolves.toBeUndefined()
  });

  it("locks purchase orders in sorted order", async () => {
    const seen: string[] = []
    const query = vi.fn(async (strings: TemplateStringsArray, id: string) => {
      seen.push(id)
      expect(strings.join(" ")).toContain("FOR UPDATE")
      return []
    })

    await lockPurchaseOrders({ $queryRaw: query } as never, ["b", "a", "b"])

    expect(seen).toEqual(["a", "b"])
    expect(invoiceNumberKey(" Inv-1 ")).toBe("inv-1")
    expect(invoiceNumberKey("   ")).toBe("")
  })
});

describe("audit transaction flush", () => {
  it("stops the caller when the audit insert fails", async () => {
    const createMany = vi.fn().mockRejectedValue(new Error("audit failed"))
    const writer = { auditLog: { createMany } }
    let committed = false

    await expect(runInAuditBuffer({} as never, async () => {
      stageFinancialAuditForTests()
      await flushAuditEvents(writer)
      committed = true
    })).rejects.toThrow("audit failed")

    expect(committed).toBe(false)
    expect(createMany).toHaveBeenCalledOnce()
  });

  it("writes one audit row and does not repeat it after the buffer is cleared", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const writer = { auditLog: { createMany } }

    await runInAuditBuffer(writer as never, async () => {
      stageFinancialAuditForTests()
      await flushAuditEvents(writer)
    })

    expect(createMany).toHaveBeenCalledOnce()
    const row = createMany.mock.calls[0][0].data[0]
    expect(row.model).toBe("PurchaseOrder")
    expect(row.action).toBe("UPDATE")
    expect(row.userName).toBe("auditor")
    expect(JSON.stringify(row)).not.toMatch(/password|token/i)
  });
});
