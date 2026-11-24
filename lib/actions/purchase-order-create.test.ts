import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, getActiveCompanyContext, findPlan, createParent, createCycle, findInvoices, transaction, after, revalidatePath, safeNotify, publishChange } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getActiveCompanyContext: vi.fn(),
  findPlan: vi.fn(),
  createParent: vi.fn(),
  createCycle: vi.fn(),
  findInvoices: vi.fn(),
  transaction: vi.fn(),
  after: vi.fn(),
  revalidatePath: vi.fn(),
  safeNotify: vi.fn(),
  publishChange: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requirePermission }));
vi.mock("@/lib/company-context", () => ({ getActiveCompanyContext }));
vi.mock("next/server", () => ({ after }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/notifications/publish", () => ({
  safeNotify,
  publishPurchaseOrderChange: publishChange,
}));
vi.mock("@/lib/notifications/store", () => ({ loadPurchaseOrderSnapshots: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingPlan: { findUnique: findPlan, findFirst: findPlan },
    purchaseOrder: { create: createParent },
    $transaction: transaction,
  },
}));

import { createPurchaseOrder } from "./purschase-order";

const records: string[] = [];
let inTransaction = false;
const input = {
  companyId: "company-1",
  customerPONumber: "PO-TEST",
  billingCycles: [{ invoiceNumber: "INV-TEST", invoiceAmount: 100, creditNote: 0, payments: [] }],
  scope: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  records.length = 0;
  inTransaction = false;
  requirePermission.mockResolvedValue({ ok: true });
  getActiveCompanyContext.mockResolvedValue({ companyId: "company-1", company: { id: "company-1" } });
  findInvoices.mockResolvedValue([]);
  createParent.mockImplementation(async () => {
    records.push("po-created");
    return { id: "po-created" };
  });
  createCycle.mockResolvedValue({ id: "cycle-created" });
  safeNotify.mockImplementation(async (task: () => Promise<void>) => task());
  publishChange.mockResolvedValue(undefined);
  transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => {
    const before = [...records];
    inTransaction = true;
    try {
      return await run({
        purchaseOrder: { create: createParent },
        billingCycle: { create: createCycle, findMany: findInvoices },
        $executeRaw: vi.fn(),
      });
    } catch (error) {
      records.splice(0, records.length, ...before);
      throw error;
    } finally {
      inTransaction = false;
    }
  });
});

describe("create purchase order submission", () => {
  it("does not leave a saved PO behind when a billing cycle fails", async () => {
    createCycle.mockRejectedValue(new Error("Billing cycle could not be saved"));
    const result = await createPurchaseOrder(input);
    expect(result).toMatchObject({ success: false, message: "Billing cycle could not be saved" });
    expect(records).toEqual([]);
    expect(after).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the PO and its cycles in one transaction, with enough time for multiple cycles", async () => {
    createParent.mockImplementation(async () => {
      expect(inTransaction).toBe(true);
      records.push("po-created");
      return { id: "po-created" };
    });
    expect(await createPurchaseOrder(input)).toMatchObject({ success: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });
    expect(createCycle).toHaveBeenCalledTimes(1);
    expect(records).toEqual(["po-created"]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/revenue");
  });

  it("returns success for navigation before notification work starts", async () => {
    expect(await createPurchaseOrder(input)).toEqual({ success: true, message: "Purchase Order created successfully" });
    expect(after).toHaveBeenCalledOnce();
    expect(safeNotify).not.toHaveBeenCalled();
    expect(publishChange).not.toHaveBeenCalled();

    await after.mock.calls[0][0]();
    expect(safeNotify).toHaveBeenCalledOnce();
    expect(publishChange).toHaveBeenCalledWith(null, "po-created");
  });

  it("rejects duplicate invoice numbers without leaving a PO behind", async () => {
    findInvoices.mockResolvedValue([{ id: "existing-cycle", invoiceNumber: "INV-TEST" }]);
    expect(await createPurchaseOrder(input)).toMatchObject({ success: false, message: "Invoice number INV-TEST already exists" });
    expect(records).toEqual([]);
  });

  it("keeps generated billing cycles inside the parent transaction", async () => {
    findPlan.mockResolvedValue({ totalBillingCycles: 1, name: "Monthly", billingCycleType: "START" });
    const result = await createPurchaseOrder({
      ...input,
      billingPlanId: "plan-1",
      billingCycles: [],
      startFrom: "2026-04-01",
      endDate: "2026-04-30",
      poAmount: 100,
    });
    expect(result).toMatchObject({ success: true });
    expect(transaction).toHaveBeenCalledOnce();
    expect(createParent.mock.calls[0][0].data.billingCycles.create).toHaveLength(1);
    expect(createCycle).not.toHaveBeenCalled();
  });

  it("does not create or schedule anything without create permission", async () => {
    requirePermission.mockResolvedValue({ ok: false, message: "Unauthorized" });
    expect(await createPurchaseOrder(input)).toEqual({ success: false, message: "Unauthorized" });
    expect(createParent).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
});
