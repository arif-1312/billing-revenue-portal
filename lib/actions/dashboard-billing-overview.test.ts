import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { getRevenueDashboard } from "./dashboard";
import { parseKolkataDate } from "@/lib/fiscal-year";

function query(year: string) {
  return {
    company: "all",
    customer: "all",
    status: "all",
    month: "all",
    quarter: "all",
    year,
    monthlyYear: Number(year),
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-1",
    status: "LIVE",
    poAmount: new Prisma.Decimal("10000000"),
    startFrom: parseKolkataDate("2026-10-01"),
    endDate: parseKolkataDate("2027-09-30", true),
    companyId: "company-1",
    billingPlan: {
      name: "Monthly",
      totalBillingCycles: 12,
      billingCycleType: "START",
      status: "ACTIVE",
    },
    contractDuration: { totalNumberOfMonths: 12 },
    billingCycles: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T06:00:00Z"));
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({ ok: true });
  getActiveCompanyContext.mockResolvedValue({ companyId: "company-1", company: { id: "company-1" } });
  findNotes.mockResolvedValue([]);
  findCustomers.mockResolvedValue([]);
  findCycles.mockResolvedValue([]);
  findPurchaseOrders.mockResolvedValue([]);
});

afterEach(() => vi.useRealTimers());

describe("management dashboard billing overview", () => {
  it("compares invoices and receivables at the same date in each FY", async () => {
    const cycle = (year: number, amount: number) => ({
      id: `cycle-${year}`,
      purchaseOrderId: `po-${year}`,
      invoiceNumber: `INV-${year}`,
      invoiceDate: parseKolkataDate(`${year}-11-15`),
      billingSubmittedDate: null,
      paymentDueDate: parseKolkataDate(`${year}-11-18`),
      paymentReceivedDate: parseKolkataDate(`${year}-11-21`),
      paymentReceived: "YES",
      invoiceAmount: new Prisma.Decimal(amount),
      creditNote: new Prisma.Decimal(0),
      collectedAmount: new Prisma.Decimal(amount),
      payments: [{ receivedDate: parseKolkataDate(`${year}-11-21`), amount: new Prisma.Decimal(amount) }],
      purchaseOrder: {
        id: `po-${year}`, customerPONumber: `PO-${year}`, status: "LIVE",
        company: { id: "company-1", name: "SY Associates" }, customer: null,
        ServiceType: null, billingPlan: null, contractDuration: null,
      },
    });
    findCycles.mockResolvedValue([cycle(2025, 500), cycle(2026, 1000), cycle(2027, 2000)]);

    const result = await getRevenueDashboard(query("2026"));

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ amount: 1000, collectedAmount: 0, pastDueAmount: 1000 });
    expect(result.comparison?.label).toBe("FY 2025–26 YTD");
    expect(result.comparison?.records).toHaveLength(1);
    expect(result.comparison?.records[0]).toMatchObject({ amount: 500, collectedAmount: 0, pastDueAmount: 500 });
  });

  it("limits current FY planned billing to date while retaining the full future FY", async () => {
    findPurchaseOrders.mockResolvedValue([order()]);

    const fy2026 = await getRevenueDashboard(query("2026"));
    const fy2027 = await getRevenueDashboard(query("2027"));

    expect(fy2026.billingOverview!.plannedBilling).toBe(1_666_666.66);
    expect(fy2027.billingOverview!.plannedBilling).toBe(5_000_000.02);
  });

  it("sums actual invoiced cycles with GST and excludes them from upcoming billing", async () => {
    findPurchaseOrders.mockResolvedValue([
      order({
        endDate: parseKolkataDate("2027-03-31", true),
        billingCycles: [
          {
            invoiceNumber: "INV-1",
            invoiceDate: parseKolkataDate("2026-10-15"),
            billingSubmittedDate: parseKolkataDate("2026-10-01"),
            invoiceAmount: new Prisma.Decimal("200"),
          },
          {
            invoiceNumber: "",
            invoiceDate: parseKolkataDate("2026-12-01"),
            billingSubmittedDate: parseKolkataDate("2026-12-01"),
            invoiceAmount: new Prisma.Decimal("100"),
          },
        ],
      }),
    ]);

    const result = await getRevenueDashboard(query("2026"));

    expect(result.billingOverview!.billingDoneWithoutGst).toBe(200);
    expect(result.billingOverview!.billingDoneWithGst).toBe(236);
    expect(result.billingOverview!.plannedBilling).toBe(200);
    expect(result.billingOverview!.upcomingBilling).toBe(100);
    expect(result.billingOverview!.billingAchievement).toBe(100);
  });

  it("does not estimate upcoming billing when future schedule rows were never generated", async () => {
    findPurchaseOrders.mockResolvedValue([order()]);

    const result = await getRevenueDashboard(query("2026"));

    expect(result.billingOverview!.upcomingBilling).toBeNull();
  });
});
