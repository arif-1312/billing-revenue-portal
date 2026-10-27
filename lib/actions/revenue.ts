"use server";

import {
  getCurrentFinancialYear,
  getFinancialYearRangeToDate,
} from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { billedInvoiceAmount, collectedAmountOf, classifyInvoiceReceivable } from "@/lib/invoice-balances";
import { moneyToNumber } from "@/lib/money";
import { requirePermission, type PermissionRule } from "@/lib/rbac";

const revenueReaders: PermissionRule[] = [
  { route: "/admin/dashboard", action: "view" },
];

function getInvoiceDate(cycle: {
  invoiceDate?: Date | null;
  billingSubmittedDate?: Date | null;
  paymentDueDate?: Date | null;
}) {
  return (
    cycle.invoiceDate ??
    cycle.billingSubmittedDate ??
    cycle.paymentDueDate ??
    null
  );
}

function getEffectiveCollectedAmount(cycle: {
  collectedAmount?: unknown;
  payments?: { amount?: unknown }[] | null;
}) {
  return moneyToNumber(collectedAmountOf(cycle));
}

// ================= REVENUE SUMMARY =================
export async function getRevenueSummary(
  year = getCurrentFinancialYear(),
) {
  const access = await requirePermission("/admin/revenue", "view", revenueReaders);
  if (!access.ok) {
    return { billed: 0, collected: 0, overdue: 0, outstanding: 0, efficiency: 0 };
  }

  const { start, end } = getFinancialYearRangeToDate(year);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      OR: [
        {
          invoiceDate: {
            gte: start,
            lte: end,
          },
        },
        {
          billingSubmittedDate: {
            gte: start,
            lte: end,
          },
        },
        {
          paymentDueDate: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    select: {
      invoiceAmount: true,
      creditNote: true,
      collectedAmount: true,
      invoiceDate: true,
      billingSubmittedDate: true,
      paymentDueDate: true,
      paymentReceived: true,
      payments: {
        select: { amount: true },
      },
    },
  });

  const today = new Date();
  let billed = 0, collected = 0, overdue = 0;

  cycles.forEach(c => {
    const invoiceDate = getInvoiceDate(c);
    if (!invoiceDate || invoiceDate < start || invoiceDate > end) {
      return;
    }

    const inv = billedInvoiceAmount(c);
    const col = getEffectiveCollectedAmount(c);
    billed += inv;
    collected += col;

    overdue += classifyInvoiceReceivable(c, today).overdue;
  });

  return { billed, collected, overdue, outstanding: billed - collected, efficiency: billed ? (collected / billed) * 100 : 0 };
}

// ================= REVENUE BY COMPANY =================
export async function getRevenueByCompany(
  year = getCurrentFinancialYear(),
) {
  const access = await requirePermission("/admin/revenue", "view", revenueReaders);
  if (!access.ok) return [];

  const { start, end } = getFinancialYearRangeToDate(year);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      OR: [
        {
          invoiceDate: {
            gte: start,
            lte: end,
          },
        },
        {
          billingSubmittedDate: {
            gte: start,
            lte: end,
          },
        },
        {
          paymentDueDate: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    select: {
      invoiceAmount: true,
      creditNote: true,
      collectedAmount: true,
      invoiceDate: true,
      billingSubmittedDate: true,
      paymentDueDate: true,
      paymentReceived: true,
      payments: {
        select: { amount: true },
      },
      purchaseOrder: {
        select: {
          customer: {
            select: {
              companyName: true,
            },
          },
        },
      },
    },
  });

  const map = new Map<string, { billed: number; collected: number }>();

  cycles.forEach((c) => {
    const invoiceDate = getInvoiceDate(c);
    if (!invoiceDate || invoiceDate < start || invoiceDate > end) {
      return;
    }

    const name = c.purchaseOrder?.customer?.companyName || "Unknown";

    if (!map.has(name)) {
      map.set(name, { billed: 0, collected: 0 });
    }

    const entry = map.get(name)!;

    entry.billed += billedInvoiceAmount(c);
    entry.collected += getEffectiveCollectedAmount(c);
  });

  return Array.from(map.entries()).map(([companyName, rev]) => ({
    companyName,
    billed: rev.billed,
    collected: rev.collected,
    overdue: rev.billed - rev.collected,
  }));
}

// ================= REVENUE BY CUSTOMER =================
export async function getRevenueByCustomer(
  year = getCurrentFinancialYear(),
) {
  const access = await requirePermission("/admin/revenue", "view", revenueReaders);
  if (!access.ok) return [];

  const { start, end } = getFinancialYearRangeToDate(year);

  const data = await prisma.billingCycle.findMany({
    where: {
      OR: [
        {
          invoiceDate: {
            gte: start,
            lte: end,
          },
        },
        {
          billingSubmittedDate: {
            gte: start,
            lte: end,
          },
        },
        {
          paymentDueDate: {
            gte: start,
            lte: end,
          },
        },
      ],
    },
    select: {
      invoiceAmount: true,
      creditNote: true,
      collectedAmount: true,
      invoiceDate: true,
      billingSubmittedDate: true,
      paymentDueDate: true,
      paymentReceived: true,
      payments: {
        select: { amount: true },
      },
      purchaseOrder: {
        select: { customerId: true },
      },
    },
  });

  const map = new Map<string, { billed: number; collected: number }>();
  data.forEach(item => {
    const invoiceDate = getInvoiceDate(item);
    if (!invoiceDate || invoiceDate < start || invoiceDate > end) {
      return;
    }

    const cid = item.purchaseOrder?.customerId;
    if (!cid) return;

    if (!map.has(cid)) map.set(cid, { billed: 0, collected: 0 });
    const existing = map.get(cid)!;
    existing.billed += billedInvoiceAmount(item);
    existing.collected += getEffectiveCollectedAmount(item);
  });

  return Array.from(map.entries()).map(([customerId, rev]) => ({
    customerId,
    billed: rev.billed,
    collected: rev.collected,
    overdue: rev.billed - rev.collected,
  }));
}

// ================= UPCOMING PAYMENTS =================
export async function getUpcomingPayments() {
  const access = await requirePermission("/admin/revenue", "view", revenueReaders);
  if (!access.ok) return [];

  const today = new Date();
  const cycles = await prisma.billingCycle.findMany({
    where: { paymentDueDate: { gt: today } },
    select: { invoiceNumber: true, paymentDueDate: true, invoiceAmount: true, creditNote: true },
    orderBy: { paymentDueDate: "asc" },
  });

  return cycles.map((cycle) => ({
    invoiceNumber: cycle.invoiceNumber,
    paymentDueDate: cycle.paymentDueDate,
    invoiceAmount: billedInvoiceAmount(cycle),
  }));
}
