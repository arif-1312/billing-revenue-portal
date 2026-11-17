import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, findNotes, findCustomers, findCycles, findPurchaseOrders } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findNotes: vi.fn(),
  findCustomers: vi.fn(),
  findCycles: vi.fn(),
  findPurchaseOrders: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ requirePermission }));
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
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({ ok: true });
  findNotes.mockResolvedValue([]);
  findCustomers.mockResolvedValue([]);
  findCycles.mockResolvedValue([]);
  findPurchaseOrders.mockResolvedValue([]);
});

describe("management dashboard billing overview", () => {
  it("allocates a multi-year monthly PO only to the cycles in each FY", async () => {
    findPurchaseOrders.mockResolvedValue([order()]);

    const fy2026 = await getRevenueDashboard(query("2026"));
    const fy2027 = await getRevenueDashboard(query("2027"));

    expect(fy2026.billingOverview!.plannedBilling).toBe(4_999_999.98);
    expect(fy2027.billingOverview!.plannedBilling).toBe(5_000_000.02);
    expect(
      fy2026.billingOverview!.plannedBilling! + fy2027.billingOverview!.plannedBilling!,
    ).toBe(10_000_000);
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
    expect(result.billingOverview!.plannedBilling).toBe(300);
    expect(result.billingOverview!.upcomingBilling).toBe(100);
    expect(result.billingOverview!.billingAchievement).toBe(66.67);
  });

  it("does not estimate upcoming billing when future schedule rows were never generated", async () => {
    findPurchaseOrders.mockResolvedValue([order()]);

    const result = await getRevenueDashboard(query("2026"));

    expect(result.billingOverview!.upcomingBilling).toBeNull();
  });
});
