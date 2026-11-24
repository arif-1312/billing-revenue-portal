import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, getActiveCompanyContext, findNotes, findCustomers, findCycles, findPurchaseOrders } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getActiveCompanyContext: vi.fn(),
  findNotes: vi.fn(),
  findCustomers: vi.fn(),
  findCycles: vi.fn(),
  findPurchaseOrders: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requirePermission }));
vi.mock("@/lib/company-context", () => ({ getActiveCompanyContext }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditNote: { findMany: findNotes },
    customer: { findMany: findCustomers },
    billingCycle: { findMany: findCycles },
    purchaseOrder: { findMany: findPurchaseOrders },
  },
}));

import { getCreditNoteDashboardSummary, getRevenueDashboard, getRevenueDashboardSummary, type CreditNoteDashboardQuery } from "./dashboard";
import { parseKolkataDate } from "@/lib/fiscal-year";

const query: CreditNoteDashboardQuery = {
  company: "all",
  customer: "all",
  month: "all",
  quarter: "all",
  year: "2025",
  monthlyYear: 2025,
};

function note(customerName: string, date: string, amount: string) {
  return { companyId: "co-tech", customerName, date: parseKolkataDate(date), amount: new Prisma.Decimal(amount) };
}

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({ ok: true });
  getActiveCompanyContext.mockResolvedValue({ companyId: "co-tech", company: { id: "co-tech" } });
  findCustomers.mockResolvedValue([]);
  findCycles.mockResolvedValue([]);
  findPurchaseOrders.mockResolvedValue([]);
  findNotes.mockResolvedValue([
    note("Hitachi systems India Pvt Ltd", "2025-04-01", "100"),
    note("Exato Technologies Private Limited", "2025-05-15", "200"),
    note("HITACHI SYSTEMS INDIA PRIVATE LIMITED", "2025-07-15", "300"),
    note("Unmatched customer", "2026-03-31", "400"),
    note("Hitachi", "2026-04-01", "500"),
    note("Hitachi", "2025-03-31", "50"),
    note("Exato", "2024-04-01", "60"),
  ]);
});

describe("projected revenue after credit notes", () => {
  function cycle(date: string, amount: number) {
    return {
      invoiceDate: parseKolkataDate(date),
      invoiceNumber: `INV-${date}`,
      invoiceAmount: new Prisma.Decimal(amount),
      creditNote: new Prisma.Decimal(25),
      payments: [],
      collectedAmount: new Prisma.Decimal(0),
      paymentDueDate: null,
    };
  }

  beforeEach(() => {
    findCycles.mockResolvedValue([
      cycle("2025-04-01", 1000),
      cycle("2025-07-01", 2000),
      cycle("2024-04-01", 500),
    ]);
  });

  it("subtracts the selected year's credit register once from pre-GST invoices", async () => {
    const result = await getRevenueDashboardSummary(2025, { timeZone: "Asia/Kolkata" });
    expect(result.totalRevenueProjected).toBe(2000);
    expect(result.totalRevenueTillNow).toBe(2000);
  });

  it.each([
    { month: "0" },
    { quarter: "1" },
    { startDate: "2025-05-01", endDate: "2025-05-31" },
  ])("deducts full-year credit notes even with a narrower period: %j", async (filters) => {
    const result = await getRevenueDashboardSummary(2025, { ...filters, timeZone: "Asia/Kolkata" });
    expect(result.totalRevenueProjected).toBe(2000);
    if ("month" in filters) expect(result.totalRevenueTillNow).toBe(900);
  });

  it("uses the same customer and company matching as the Credit Notes card", async () => {
    findCustomers.mockResolvedValue([{
      companyName: "Hitachi", firstName: "", lastName: null, customerCode: "HIT",
      purchaseOrders: [{ company: { name: "SY Associates" } }],
    }]);
    const result = await getRevenueDashboardSummary(2025, {
      company: "co-tech", customer: "customer-1", timeZone: "Asia/Kolkata",
    });
    expect(result.totalRevenueProjected).toBe(2600);
    expect(findCycles.mock.calls[0][0].where).toEqual({
      purchaseOrder: { companyId: "co-tech", customerId: "customer-1" },
    });
    expect(findCustomers.mock.calls[0][0].where).toEqual({
      companyId: "co-tech", id: "customer-1", purchaseOrders: { some: { companyId: "co-tech" } },
    });
  });

  it("subtracts the credit notes for every selected financial year", async () => {
    const result = await getRevenueDashboardSummary(undefined, { years: [2024, 2025], timeZone: "Asia/Kolkata" });
    expect(result.totalRevenueProjected).toBe(2390);
  });

  it("preserves currency precision and negative net revenue", async () => {
    findCycles.mockResolvedValue([cycle("2025-04-01", 0.3)]);
    findNotes.mockResolvedValue([note("A", "2025-04-01", "0.10")]);
    expect((await getRevenueDashboardSummary(2025)).totalRevenueProjected).toBe(0.2);
    findNotes.mockResolvedValue([note("A", "2025-04-01", "1.00")]);
    expect((await getRevenueDashboardSummary(2025)).totalRevenueProjected).toBe(-0.7);
  });

  it("keeps the gross total when no credit notes match", async () => {
    findNotes.mockResolvedValue([]);
    expect((await getRevenueDashboardSummary(2025)).totalRevenueProjected).toBe(3000);
  });
});

describe("dashboard credit note summary", () => {
  it("compares current FY notes with the same date last FY", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T06:00:00Z"));
    try {
      findNotes.mockResolvedValue([
        note("A", "2026-11-20", "10"), note("A", "2026-11-21", "100"),
        note("A", "2025-11-20", "20"), note("A", "2025-11-21", "200"),
      ]);
      const result = await getCreditNoteDashboardSummary({ ...query, year: "2026", monthlyYear: 2026 });
      expect(result).toMatchObject({ amount: 10, comparison: { amount: 20, label: "FY 2025–26 YTD" } });
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects an unauthorized dashboard request before reading data", async () => {
    requirePermission.mockResolvedValue({ ok: false, message: "Unauthorized" });
    await expect(getRevenueDashboard(query)).rejects.toThrow("Unauthorized");
    expect(findNotes).not.toHaveBeenCalled();
    expect(findCycles).not.toHaveBeenCalled();
    expect(findPurchaseOrders).not.toHaveBeenCalled();
  });

  it("requires dashboard permission before reading financial data", async () => {
    requirePermission.mockResolvedValue({ ok: false, message: "Unauthorized" });
    await expect(getCreditNoteDashboardSummary(query)).rejects.toThrow("Unauthorized");
    expect(requirePermission).toHaveBeenCalledWith("/admin/dashboard", "view");
    expect(findNotes).not.toHaveBeenCalled();
    expect(findCustomers).not.toHaveBeenCalled();
  });

  it("totals persisted notes separately from invoice credit amounts and compares financial years", async () => {
    await expect(getCreditNoteDashboardSummary(query)).resolves.toEqual({
      amount: 1000,
      count: 4,
      comparison: { amount: 110, count: 2, label: "FY 2024–25" },
    });
    expect(findNotes).toHaveBeenCalledWith({
      where: { companyId: "co-tech", OR: [
        { date: { gte: parseKolkataDate("2025-04-01"), lte: parseKolkataDate("2026-03-31", true) } },
        { date: { gte: parseKolkataDate("2024-04-01"), lte: parseKolkataDate("2025-03-31", true) } },
      ] },
      select: { customerName: true, date: true, amount: true },
    });
    expect(findCustomers).not.toHaveBeenCalled();
  });

  it.each([
    [{ month: "0" }, 100, 1, { amount: 50, count: 1, label: "prior month" }],
    [{ quarter: "2" }, 300, 1, { amount: 300, count: 2, label: "prior quarter" }],
    [{ month: "0,3" }, 400, 2, null],
    [{ quarter: "1,2", month: "0,3,11" }, 400, 2, null],
    [{ year: "2024,2025" }, 1110, 6, null],
    [{ year: "all" }, 1610, 7, null],
    [{ startDate: "2025-05-01", endDate: "2025-07-31", month: "0", quarter: "4" }, 500, 2, null],
    [{ startDate: "2025-07-01", endDate: "2025-07-31" }, 300, 1, { amount: 0, count: 0, label: "prior period" }],
    [{ startDate: "2025-07-15" }, 700, 2, null],
    [{ startDate: "2026-04-01", endDate: "2026-03-31" }, 0, 0, null],
  ])("reuses fiscal, multi-select, custom-date, and comparison rules: %j", async (patch, amount, count, comparison) => {
    const result = await getCreditNoteDashboardSummary({ ...query, ...patch });
    expect(result).toEqual({ amount, count, comparison });
  });

  it("uses inclusive Kolkata boundaries at the financial year change", async () => {
    findNotes.mockResolvedValue([
      { ...note("A", "2025-04-01", "10"), date: new Date("2025-03-31T18:29:59.999Z") },
      { ...note("A", "2025-04-01", "20"), date: new Date("2025-03-31T18:30:00.000Z") },
      { ...note("A", "2026-03-31", "30"), date: new Date("2026-03-31T18:29:59.999Z") },
      { ...note("A", "2026-04-01", "40"), date: new Date("2026-03-31T18:30:00.000Z") },
    ]);
    expect(await getCreditNoteDashboardSummary(query)).toMatchObject({ amount: 50, count: 2 });
  });

  it("keeps decimal totals exact and returns zero for an empty period", async () => {
    findNotes.mockResolvedValue([
      note("A", "2025-04-01", "0.10"),
      note("A", "2025-04-02", "0.20"),
    ]);
    expect(await getCreditNoteDashboardSummary(query)).toMatchObject({ amount: 0.3, count: 2 });
    findNotes.mockResolvedValue([]);
    expect(await getCreditNoteDashboardSummary(query)).toMatchObject({ amount: 0, count: 0 });
  });

  it("matches customer IDs through canonical names and legal suffixes in both periods", async () => {
    findCustomers.mockResolvedValue([{
      companyName: "Hitachi", firstName: "", lastName: null, customerCode: "HIT",
      purchaseOrders: [],
    }]);
    expect(await getCreditNoteDashboardSummary({ ...query, customer: "customer-1,customer-2" })).toEqual({
      amount: 400,
      count: 2,
      comparison: { amount: 50, count: 1, label: "FY 2024–25" },
    });
    expect(findCustomers.mock.calls[0][0].where).toEqual({ companyId: "co-tech", id: { in: ["customer-1", "customer-2"] } });
  });

  it("combines company, customer, and status selections on the same purchase order and counts a note once", async () => {
    findCustomers.mockResolvedValue([{
      companyName: "Exato", firstName: "", lastName: null, customerCode: "EX",
      purchaseOrders: [{ company: { name: "SY Associates" } }, { company: { name: "SY Associates" } }],
    }]);
    expect(await getCreditNoteDashboardSummary({ ...query, company: "co-tech", customer: "c-1", status: "LIVE" })).toEqual({
      amount: 200,
      count: 1,
      comparison: { amount: 60, count: 1, label: "FY 2024–25" },
    });
    expect(findCustomers.mock.calls[0][0].where).toEqual({
      companyId: "co-tech",
      id: "c-1",
      purchaseOrders: { some: { companyId: "co-tech", status: { in: ["LIVE"] } } },
    });
  });

  it("matches customer and company chart selections using the existing aliases", async () => {
    findCustomers.mockResolvedValue([
      { companyName: "Hitachi", firstName: "", lastName: null, customerCode: "HIT", purchaseOrders: [{ company: { name: "Technosys" } }] },
      { companyName: "Exato", firstName: "", lastName: null, customerCode: "EX", purchaseOrders: [{ company: { name: "SY Associates" } }] },
    ]);
    expect(await getCreditNoteDashboardSummary({ ...query, crossFilter: { kind: "customer", value: "Exato" } })).toMatchObject({ amount: 200, count: 1 });
    expect(await getCreditNoteDashboardSummary({ ...query, crossFilter: { kind: "company", value: "sy" } })).toMatchObject({ amount: 200, count: 1 });
  });

  it("returns an empty summary for unmatched parties or conflicting status filters without reading all notes", async () => {
    expect(await getCreditNoteDashboardSummary({ ...query, customer: "missing-customer" })).toMatchObject({ amount: 0, count: 0 });
    expect(findNotes).not.toHaveBeenCalled();
    expect(await getCreditNoteDashboardSummary({ ...query, status: "LIVE", crossFilter: { kind: "status", value: "CLOSED" } })).toMatchObject({ amount: 0, count: 0 });
    expect(findNotes).not.toHaveBeenCalled();
  });

  it("propagates database errors instead of presenting them as a zero balance", async () => {
    findNotes.mockRejectedValue(new Error("Database unavailable"));
    await expect(getCreditNoteDashboardSummary(query)).rejects.toThrow("Database unavailable");
  });
});

describe("credit deductions across dashboard filters", () => {
  function matches(value: string, selection: string | { in: string[] } | undefined) {
    return selection === undefined || (typeof selection === "string" ? selection === value : selection.in.includes(value));
  }

  beforeEach(() => {
    const parties = [
      {
        id: "customer-hitachi", companyId: "co-tech", companyName: "Hitachi", firstName: "", lastName: null, customerCode: "HIT",
        purchaseOrders: [{ id: "po-hitachi", companyId: "co-tech", status: "CLOSED", company: { id: "co-tech", name: "Technosys" } }],
      },
      {
        id: "customer-exato", companyId: "co-sy", companyName: "Exato", firstName: "", lastName: null, customerCode: "EX",
        purchaseOrders: [{ id: "po-exato", companyId: "co-sy", status: "LIVE", company: { id: "co-sy", name: "SY Associates" } }],
      },
    ];
    type OrderFilter = { id?: string | { in: string[] }; companyId?: string | { in: string[] }; customerId?: string | { in: string[] }; status?: { in: string[] } };
    const cycles = parties.map((customer, index) => ({
      invoiceDate: parseKolkataDate(index === 0 ? "2025-04-01" : "2025-05-15"),
      invoiceNumber: `INV-${index}`, invoiceAmount: new Prisma.Decimal((index + 1) * 1000),
      creditNote: new Prisma.Decimal(25), payments: [], collectedAmount: new Prisma.Decimal(0),
      billingSubmittedDate: null, paymentReceivedDate: null, paymentDueDate: null,
      purchaseOrderId: customer.purchaseOrders[0].id,
      purchaseOrder: {
        ...customer.purchaseOrders[0], customerId: customer.id, customer,
        ServiceType: null, billingPlan: null, contractDuration: null,
      },
    }));
    findCustomers.mockImplementation(async ({ where, select }) => parties
      .filter((customer) => matches(customer.id, where.id) && customer.companyId === where.companyId)
      .map((customer) => ({
        ...customer,
        purchaseOrders: customer.purchaseOrders.filter((order) => {
          const filter: OrderFilter = select.purchaseOrders.where;
          return matches(order.companyId, filter.companyId) && matches(order.status, filter.status);
        }),
      }))
      .filter((customer) => !where.purchaseOrders || customer.purchaseOrders.length > 0));
    findCycles.mockImplementation(async ({ where }: { where?: { purchaseOrder?: OrderFilter } }) => cycles.filter((cycle) => {
      const filter = where?.purchaseOrder;
      return !filter || (
        matches(cycle.purchaseOrderId, filter.id) &&
        matches(cycle.purchaseOrder.companyId, filter.companyId) &&
        matches(cycle.purchaseOrder.customerId, filter.customerId) &&
        matches(cycle.purchaseOrder.status, filter.status)
      );
    }));
  });

  it.each([
    [{ company: "co-sy" }, 0, 0],
    [{ company: "co-tech,co-sy" }, 400, 600],
    [{ customer: "customer-hitachi" }, 400, 600],
    [{ customer: "customer-hitachi,customer-exato" }, 400, 600],
    [{ status: "LIVE" }, 0, 0],
    [{ status: "CLOSED" }, 400, 600],
    [{ status: "LIVE,CLOSED" }, 400, 600],
    [{ company: "co-tech", customer: "customer-exato" }, 0, 0],
    [{ company: "co-sy", status: "CLOSED" }, 0, 0],
    [{ crossFilter: { kind: "company", value: "sy" } }, 0, 0],
    [{ crossFilter: { kind: "customer", value: "Hitachi" } }, 400, 600],
    [{ crossFilter: { kind: "status", value: "CLOSED" } }, 400, 600],
    [{ status: "LIVE", crossFilter: { kind: "status", value: "CLOSED" } }, 0, 0],
    [{ company: "co-tech", month: "3" }, 300, -300],
    [{ customer: "customer-hitachi", quarter: "2" }, 300, -300],
    [{ status: "LIVE", startDate: "2025-05-01", endDate: "2025-05-31" }, 0, 0],
    [{ crossFilter: { kind: "month", value: "May" } }, 200, -200],
  ] satisfies Array<[Partial<CreditNoteDashboardQuery>, number, number]>)(
    "keeps the card, billed total, and monthly chart aligned for %j",
    async (patch, credit, billed) => {
      const result = await getRevenueDashboard({ ...query, ...patch });
      expect(result.creditNotes?.amount).toBe(credit);
      expect(result.summary.totalRevenueTillNow).toBe(billed);
      expect(result.monthly.reduce((total, month) => total + month.billing, 0)).toBe(billed);
    },
  );

  it("applies party and status filters to projected revenue without narrowing the financial year", async () => {
    const result = await getRevenueDashboard({ ...query, customer: "customer-hitachi", status: "CLOSED", month: "3" });
    expect(result.summary.totalRevenueTillNow).toBe(-300);
    expect(result.summary.totalRevenueProjected).toBe(600);
  });

  it("preserves decimal precision under a customer filter", async () => {
    findNotes.mockResolvedValue([note("Hitachi", "2025-04-01", "0.10"), note("Hitachi", "2025-04-02", "0.20")]);
    const result = await getRevenueDashboard({ ...query, customer: "customer-hitachi" });
    expect(result.creditNotes?.amount).toBe(0.3);
    expect(result.summary.totalRevenueTillNow).toBe(999.7);
    expect(result.monthly[0].billing).toBe(999.7);
  });
});
