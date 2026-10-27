"use server";

import { format } from "date-fns";
import { PaymentReceived, Prisma } from "@prisma/client";

import { formatFilterDate, parseFilterDate, previousPeriod } from "@/lib/dashboard-presets";
import {
  calendarDaysBetween,
  formatKolkataDate,
  kolkataCalendar,
  parseKolkataDate,
} from "@/lib/fiscal-year";
import {
  agingBucketForDaysPastDue,
  emptyAging,
  filterTokens,
  type AgingSummary,
  type DashboardFilters,
} from "@/lib/revenue-metrics";
import { billedInvoiceAmount, classifyInvoiceReceivable, collectedAmountOf } from "@/lib/invoice-balances";
import { moneyToNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

function emptyDashboardSummary(): RevenueDashboardSummary {
  return {
    totalRevenueProjected: 0,
    totalRevenueTillNow: 0,
    dueForBillingTillNow: 0,
    collectedAmountTillNow: 0,
    pendingCollectionTillNow: 0,
    overdueAmountTillNow: 0,
    partialInvoiceCount: 0,
    collectionEfficiency: 0,
    aging: emptyAging(),
  };
}

const emptyDashboardStats: DashboardStats = {
  billCount: 0,
  billingThisMonth: 0,
  totalBilledAmount: 0,
  totalCollectedAmount: 0,
  totalOverdueAmount: 0,
  collectionEfficiency: 0,
  currentMonth: "",
};

export interface DashboardStats {
  billCount: number;
  billingThisMonth: number;
  totalBilledAmount: number;
  totalCollectedAmount: number;
  totalOverdueAmount: number;
  collectionEfficiency: number;
  currentMonth: string;
}

export interface RevenueDashboardSummary {
  totalRevenueProjected: number;
  totalRevenueTillNow: number;
  dueForBillingTillNow: number;
  collectedAmountTillNow: number;
  pendingCollectionTillNow: number;
  overdueAmountTillNow: number;
  partialInvoiceCount: number;
  collectionEfficiency: number;
  aging: AgingSummary;
}

export type RevenuePeriodComparison = {
  label: string;
  summary: RevenueDashboardSummary;
};

interface BillingStatusFilters {
  company?: string;
  customer?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  month?: string;
  quarter?: string;
  years?: number[];
  timeZone?: "Asia/Kolkata";
}

export type RevenueDashboardQuery = {
  company?: string;
  customer?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
  quarter?: string;
  year?: string;
  monthlyYear: number;
};

export type BillingInvoiceLine = {
  month: string;
  customerName: string;
  companyName: string;
  invoiceNumber: string;
  poNumber: string;
  scope: string;
  serviceType: string;
  billed: number;
  creditNote: number;
  collected: number;
  outstanding: number;
  status: string;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type GroupedRevenueDetail = {
  id: string;
  customerName: string;
  companyId: string | null;
  companyName: string;
  poNumber: string;
  scope: string;
  amount: number;
  creditNote: number;
  collectedAmount: number;
  overdueAmount: number;
  serviceType: string;
  billingPlan: string;
  contractDuration: string;
  period: string;
  status: string;
  pastDueAmount: number;
  undatedOutstanding: number;
};

type RevenueSeries = "billing" | "payment";

type RevenueMonthDetailsParams = {
  month: number;
  year: number;
  series: RevenueSeries;
};

type BillingCycleWithPurchaseOrder = Prisma.BillingCycleGetPayload<{
  include: {
    purchaseOrder: {
      include: {
        ServiceType: true;
        billingPlan: true;
        company: true;
        contractDuration: true;
        customer: true;
      };
    };
  };
}>;

type CustomerRecord = BillingCycleWithPurchaseOrder["purchaseOrder"]["customer"];
type CompanyFilterCycle = {
  purchaseOrder?: {
    customer?: {
      id?: string | null;
    } | null;
    company?: {
      id?: string | null;
    } | null;
  } | null;
};

export type RevenueMonthDetail = {
  id: string;
  month: string;
  year: number;
  companyName: string;
  customerName: string;
  poNumber: string;
  scope: string;
  invoiceNumber: string;
  billedAmount: number;
  paymentReceived: number;
  pendingAmount: number;
};

const MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

function createBusinessDate(
  year: number,
  monthIndex: number,
  day: number,
  endOfDay = false,
) {
  const date = new Date(year, monthIndex, day);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function normalizeDate(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeEndOfDate(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getEarlierDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function getCurrentFinancialYear(date = new Date()) {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  return month < 3 ? year - 1 : year;
}

function getFinancialYearRange(year: number) {
  const start = new Date(year, 3, 1);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(year + 1, 2, 31);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getFinancialMonth(date: Date) {
  const d = new Date(date);
  const monthIndex = d.getMonth();
  return (monthIndex + 9) % 12;
}

function getFinancialYearForDate(date: Date) {
  const d = new Date(date);
  const monthIndex = d.getMonth();
  const year = d.getFullYear();
  return monthIndex < 3 ? year - 1 : year;
}

function getBusinessCalendarYear(date: Date) {
  return new Date(date).getFullYear();
}

function getBusinessMonthLabel(date: Date) {
  return MONTHS[getFinancialMonth(date)];
}

function formatFinancialYearLabel(year: number) {
  return `FY ${year}-${String(year + 1).slice(-2)}`;
}

function fiscalMonthInZone(date: Date, filters?: BillingStatusFilters) {
  if (filters?.timeZone === "Asia/Kolkata") {
    return (kolkataCalendar(date).month - 1 + 9) % 12;
  }

  return getFinancialMonth(date);
}

function getSummaryAsOfDate(
  year?: number,
  filters?: BillingStatusFilters,
  referenceDate = new Date(),
) {
  if (filters?.timeZone === "Asia/Kolkata") {
    const { year: calendarYear, month } = kolkataCalendar(referenceDate);
    const lastDay = new Date(Date.UTC(calendarYear, month, 0)).getUTCDate();
    let asOfYmd = `${calendarYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const selectedYears = selectedFinancialYears(year, filters);
    if (selectedYears.length > 0) {
      const latest = Math.max(...selectedYears);
      const fyEnd = `${latest + 1}-03-31`;
      if (fyEnd < asOfYmd) asOfYmd = fyEnd;
    }

    if (typeof filters.endDate === "string" && filters.endDate < asOfYmd) {
      asOfYmd = filters.endDate;
    }

    return parseKolkataDate(asOfYmd, true);
  }

  const currentMonthEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  );
  let asOfDate = normalizeEndOfDate(currentMonthEnd);

  const selectedYears = selectedFinancialYears(year, filters);
  if (selectedYears.length > 0) {
    const latest = Math.max(...selectedYears);
    asOfDate = getEarlierDate(asOfDate, getFinancialYearRange(latest).end);
  }

  if (filters?.endDate instanceof Date) {
    asOfDate = getEarlierDate(asOfDate, normalizeEndOfDate(filters.endDate));
  }

  return asOfDate;
}

function getFinancialMonthRange(financialYear: number, monthIndex: number) {
  const calendarMonth = monthIndex <= 8 ? monthIndex + 3 : monthIndex - 9;

  const calendarYear = monthIndex <= 8 ? financialYear : financialYear + 1;

  const lastDayOfMonth = new Date(
    Date.UTC(calendarYear, calendarMonth + 1, 0),
  ).getUTCDate();

  const start = createBusinessDate(calendarYear, calendarMonth, 1);
  const end = createBusinessDate(
    calendarYear,
    calendarMonth,
    lastDayOfMonth,
    true,
  );

  return {
    start,
    end,
  };
}

function getInvoiceDate(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    "invoiceDate" | "billingSubmittedDate"
  >,
): Date | null {
  return cycle.invoiceDate ?? cycle.billingSubmittedDate ?? null;
}

function getDueForBillingDate(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    "billingSubmittedDate" | "invoiceDate"
  >,
): Date | null {
  return cycle.billingSubmittedDate ?? cycle.invoiceDate ?? null;
}


function getPaymentDate(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    | "paymentReceived"
    | "paymentReceivedDate"
    | "invoiceDate"
    | "billingSubmittedDate"
    | "collectedAmount"
  >,
): Date | null {
  // Priority 1: Use actual payment received date if recorded
  if (cycle.paymentReceivedDate) {
    return cycle.paymentReceivedDate;
  }

  // Priority 2: If marked as received (YES) but no date recorded,
  // use invoice/billing date as reference for fiscal year mapping
  if (cycle.paymentReceived === PaymentReceived.YES) {
    return cycle.invoiceDate ?? cycle.billingSubmittedDate ?? null;
  }

  return null;
}

function hasPaymentChartRecord(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    "collectedAmount"
  >,
) {
  return Number(cycle.collectedAmount || 0) > 0;
}

function getPaymentChartDate(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    | "paymentReceivedDate"
    | "invoiceDate"
    | "billingSubmittedDate"
    | "collectedAmount"
  >,
): Date | null {
  if (!hasPaymentChartRecord(cycle)) {
    return null;
  }

  return (
    cycle.paymentReceivedDate ??
    cycle.invoiceDate ??
    cycle.billingSubmittedDate ??
    null
  );
}

type StoredPayment = {
  receivedDate?: Date | null;
  amount?: unknown;
};

function getEffectiveCollectedAmount(
  cycle: {
    collectedAmount?: unknown;
    payments?: StoredPayment[] | null;
  },
) {
  return moneyToNumber(collectedAmountOf(cycle));
}

function paymentReceipts(
  cycle: Pick<
    BillingCycleWithPurchaseOrder,
    | "paymentReceived"
    | "paymentReceivedDate"
    | "invoiceDate"
    | "billingSubmittedDate"
    | "collectedAmount"
    | "invoiceAmount"
  > & { payments?: StoredPayment[] | null; creditNote?: unknown },
) {
  const stored = (cycle.payments ?? []).flatMap((payment) => {
    if (!payment.receivedDate) return [];
    const amount = moneyToNumber(payment.amount);
    if (!Number.isFinite(amount) || amount === 0) return [];
    return [{ receivedDate: payment.receivedDate, amount }];
  });

  if (stored.length > 0) return stored;

  const amount = getEffectiveCollectedAmount(cycle);
  const receivedDate = getPaymentChartDate(cycle) ?? getPaymentDate(cycle);
  if (!receivedDate || amount === 0) return [];

  return [{ receivedDate, amount }];
}

function collectedByReceiptDate(
  cycle: Parameters<typeof paymentReceipts>[0],
  asOfDate: Date,
) {
  return paymentReceipts(cycle)
    .filter((receipt) => normalizeDate(receipt.receivedDate) <= asOfDate)
    .reduce((total, receipt) => total + receipt.amount, 0);
}

function idFilter(value?: string) {
  const ids = filterTokens(value);
  if (ids.length === 0) return undefined;
  if (ids.length === 1) return ids[0];
  return { in: ids };
}

function matchesCompanyFilter(
  cycle: CompanyFilterCycle,
  filters?: BillingStatusFilters,
) {
  const companies = filterTokens(filters?.company);
  if (companies.length === 0) return true;
  return companies.includes(String(cycle.purchaseOrder?.company?.id));
}

function matchesCustomerFilter(
  cycle: CompanyFilterCycle,
  filters?: BillingStatusFilters,
) {
  const customers = filterTokens(filters?.customer);
  if (customers.length === 0) return true;
  return customers.includes(String(cycle.purchaseOrder?.customer?.id));
}

function getPurchaseOrderFilter(filters?: BillingStatusFilters) {
  const purchaseOrderFilter: {
    companyId?: string | { in: string[] };
    customerId?: string | { in: string[] };
  } = {};
  const companyId = idFilter(filters?.company);
  const customerId = idFilter(filters?.customer);

  if (companyId) purchaseOrderFilter.companyId = companyId;
  if (customerId) purchaseOrderFilter.customerId = customerId;

  return Object.keys(purchaseOrderFilter).length > 0
    ? purchaseOrderFilter
    : undefined;
}

const FINANCIAL_QUARTER_MONTHS: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
];

function selectedNumbers(value?: string) {
  return filterTokens(value)
    .map(Number)
    .filter((item) => Number.isInteger(item));
}

function matchesFilterMonth(date: Date, filters?: BillingStatusFilters) {
  const financialMonth = fiscalMonthInZone(date, filters);
  const months = selectedNumbers(filters?.month);
  const quarters = selectedNumbers(filters?.quarter);

  if (months.length > 0 && !months.includes(financialMonth)) return false;

  if (quarters.length > 0) {
    const quarterMonths = quarters.flatMap((quarter) => FINANCIAL_QUARTER_MONTHS[quarter - 1] ?? []);
    if (!quarterMonths.includes(financialMonth)) return false;
  }

  return true;
}

function isWithinFilterDateRange(date: Date, filters?: BillingStatusFilters) {
  if (filters?.timeZone === "Asia/Kolkata") {
    const ymd = formatKolkataDate(date);

    if (typeof filters.startDate === "string" && ymd < filters.startDate) {
      return false;
    }

    if (typeof filters.endDate === "string" && ymd > filters.endDate) {
      return false;
    }

    return true;
  }

  if (filters?.startDate instanceof Date) {
    const startDate = normalizeDate(filters.startDate);

    if (date < startDate) {
      return false;
    }
  }

  if (filters?.endDate instanceof Date) {
    const endDate = normalizeEndOfDate(filters.endDate);

    if (date > endDate) {
      return false;
    }
  }

  return true;
}

function selectedFinancialYears(year: number | undefined, filters?: BillingStatusFilters) {
  if (filters?.years?.length) return filters.years;
  if (typeof year === "number" && Number.isInteger(year)) return [year];
  return [];
}

function matchesSelectedFinancialYears(
  date: Date,
  year: number | undefined,
  filters?: BillingStatusFilters,
) {
  const years = selectedFinancialYears(year, filters);
  if (years.length === 0) return true;
  return years.some((item) => inFinancialYear(date, item, filters));
}

function inFinancialYear(date: Date, year: number, filters?: BillingStatusFilters) {
  if (filters?.timeZone === "Asia/Kolkata") {
    const ymd = formatKolkataDate(date);
    return ymd >= `${year}-04-01` && ymd <= `${year + 1}-03-31`;
  }

  const normalized = normalizeDate(date);
  const { start, end } = getFinancialYearRange(year);
  return normalized >= start && normalized <= end;
}

function getCustomerDisplayName(customer?: CustomerRecord | null) {
  if (!customer) return "-";

  if (customer.companyName?.trim()) {
    return customer.companyName;
  }

  const fullName = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || customer.customerCode || "-";
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return emptyDashboardStats;

  const currentFY = getCurrentFinancialYear();

  const { start, end } = getFinancialYearRange(currentFY);

  const currentMonth = getFinancialMonth(new Date());

  const cycles = await prisma.billingCycle.findMany({
    include: {
      payments: {
        select: { amount: true, receivedDate: true },
      },
    },
  });

  let billCount = 0;
  let totalBilledAmount = 0;
  let totalCollectedAmount = 0;
  let totalOverdueAmount = 0;
  let billingThisMonth = 0;
  let collectedThisMonth = 0;

  for (const cycle of cycles) {
    const invoiceDate = getInvoiceDate(cycle);

    if (!invoiceDate) continue;

    const normalizedDate = normalizeDate(invoiceDate);

    if (normalizedDate < start || normalizedDate > end) {
      continue;
    }

    const billed = billedInvoiceAmount(cycle);

    const collected = getEffectiveCollectedAmount(cycle);

    totalBilledAmount += billed;
    totalCollectedAmount += collected;

    billCount++;

    if (getFinancialMonth(normalizedDate) === currentMonth) {
      billingThisMonth += billed;
      collectedThisMonth += collected;
    }

    totalOverdueAmount += classifyInvoiceReceivable(cycle).overdue;
  }

  return {
    billCount,
    billingThisMonth,
    totalBilledAmount,
    totalCollectedAmount,
    totalOverdueAmount,
    collectionEfficiency:
      billingThisMonth > 0
        ? Number(((collectedThisMonth / billingThisMonth) * 100).toFixed(2))
        : 0,
    currentMonth: format(new Date(), "MMM"),
  };
}

export async function getMonthlyBillingData(
  year: number,
  filters?: BillingStatusFilters,
) {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return [];

  const { start, end } = getFinancialYearRange(year);

  const currentDate = new Date();

  const currentFY = getCurrentFinancialYear(currentDate);

  const currentFYMonth = fiscalMonthInZone(currentDate, filters);

  const purchaseOrderFilter = getPurchaseOrderFilter(filters);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      ...(purchaseOrderFilter && {
        purchaseOrder: purchaseOrderFilter,
      }),
    },
    include: {
      payments: true,
    },
  });

  const data = MONTHS.map((month, index) => ({
    month,
    billing: 0,
    creditNote: 0,
    payment: 0,
    overdue: 0,
    projected: 0,
    index,
  }));

  for (const cycle of cycles) {
    const billed = billedInvoiceAmount(cycle);

    const invoiceDate = getInvoiceDate(cycle);

    if (invoiceDate) {
      const normalizedInvoiceDate = filters?.timeZone === "Asia/Kolkata"
        ? invoiceDate
        : normalizeDate(invoiceDate);

      const fyMonth = fiscalMonthInZone(normalizedInvoiceDate, filters);

      const isFutureMonth = year === currentFY && fyMonth > currentFYMonth;
      const matchesPeriod =
        (filters?.timeZone === "Asia/Kolkata"
          ? inFinancialYear(invoiceDate, year, filters)
          : normalizedInvoiceDate >= start && normalizedInvoiceDate <= end) &&
        isWithinFilterDateRange(normalizedInvoiceDate, filters) &&
        matchesFilterMonth(normalizedInvoiceDate, filters);

      if (matchesPeriod) {
        data[fyMonth].projected += billed;
      }

      if (!isFutureMonth && matchesPeriod) {
        data[fyMonth].billing += billed;
        data[fyMonth].creditNote += moneyToNumber(cycle.creditNote);

        data[fyMonth].overdue += classifyInvoiceReceivable(cycle, currentDate).overdue;
      }
    }
    for (const receipt of paymentReceipts(cycle)) {
      const paymentDate = receipt.receivedDate;
      const normalizedPaymentDate = filters?.timeZone === "Asia/Kolkata"
        ? paymentDate
        : normalizeDate(paymentDate);
      const fyMonth = fiscalMonthInZone(normalizedPaymentDate, filters);
      const isFutureMonth = year === currentFY && fyMonth > currentFYMonth;

      if (
        !isFutureMonth &&
        (filters?.timeZone === "Asia/Kolkata"
          ? inFinancialYear(paymentDate, year, filters)
          : normalizedPaymentDate >= start && normalizedPaymentDate <= end) &&
        isWithinFilterDateRange(normalizedPaymentDate, filters) &&
        matchesFilterMonth(normalizedPaymentDate, filters)
      ) {
        data[fyMonth].payment += receipt.amount;
      }
    }
  }

  if (year === currentFY) {
    data.forEach((item) => {
      if (item.index > currentFYMonth) {
        item.billing = 0;
        item.creditNote = 0;
        item.payment = 0;
        item.overdue = 0;
      }
    });
  }

  return data;
}

export async function getRevenueDashboardSummary(
  year?: number,
  filters?: BillingStatusFilters,
): Promise<RevenueDashboardSummary> {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return emptyDashboardSummary();

  const purchaseOrderFilter = getPurchaseOrderFilter(filters);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      ...(purchaseOrderFilter && {
        purchaseOrder: purchaseOrderFilter,
      }),
    },
    select: {
      billingSubmittedDate: true,
      paymentReceived: true,
      paymentReceivedDate: true,
      payments: {
        select: {
          receivedDate: true,
          amount: true,
        },
      },
      paymentDueDate: true,
      collectedAmount: true,
      invoiceAmount: true,
      creditNote: true,
      invoiceDate: true,
      invoiceNumber: true,
    },
  });

  const asOfDate = getSummaryAsOfDate(year, filters);
  const referenceToday = new Date();

  let totalRevenueProjected = 0;
  let totalRevenueTillNow = 0;
  let dueForBillingTillNow = 0;
  let collectedAmountTillNow = 0;
  let pendingCollectionTillNow = 0;
  let overdueAmountTillNow = 0;
  let partialInvoiceCount = 0;
  const aging = emptyAging();

  for (const cycle of cycles) {
    const invoiceDate = getInvoiceDate(cycle);

    if (invoiceDate) {
      const normalizedInvoiceDate = filters?.timeZone === "Asia/Kolkata"
        ? invoiceDate
        : normalizeDate(invoiceDate);
      let matchesFinancialYearSelection = true;

      if (!matchesSelectedFinancialYears(invoiceDate, year, filters)) {
        matchesFinancialYearSelection = false;
      }

      if (matchesFinancialYearSelection) {
        const billedAmount = billedInvoiceAmount(cycle);
        const matchesTillNowSelection =
          isWithinFilterDateRange(normalizedInvoiceDate, filters) &&
          matchesFilterMonth(normalizedInvoiceDate, filters);

        totalRevenueProjected += billedAmount;

        if (
          matchesTillNowSelection &&
          normalizedInvoiceDate <= asOfDate
        ) {
          totalRevenueTillNow += billedAmount;

          const collectedTillNow = collectedByReceiptDate(cycle, asOfDate);

          collectedAmountTillNow += collectedTillNow;
          const receivable = classifyInvoiceReceivable(cycle, referenceToday);
          pendingCollectionTillNow += receivable.outstanding;
          overdueAmountTillNow += receivable.overdue;

          if (collectedTillNow > 0 && receivable.outstanding + receivable.overdue > 0) {
            partialInvoiceCount += 1;
          }

          if (receivable.undated > 0) {
            aging.missingDueDateAmount += receivable.undated;
            aging.missingDueDateCount += 1;
          } else if (receivable.overdue > 0 && cycle.paymentDueDate) {
            const daysPastDue = calendarDaysBetween(referenceToday, cycle.paymentDueDate);
            const bucketId = agingBucketForDaysPastDue(daysPastDue);
            const bucket = aging.buckets.find((item) => item.id === bucketId);
            if (bucket) {
              bucket.amount += receivable.overdue;
              bucket.count += 1;
            }
          } else if (receivable.notYetDue > 0) {
            aging.notYetDueAmount += receivable.notYetDue;
            aging.notYetDueCount += 1;
          }
        }
      }
    }

    const dueForBillingDate = getDueForBillingDate(cycle);

    if (!dueForBillingDate || cycle.invoiceNumber?.trim()) {
      continue;
    }

    const normalizedBillingDate = filters?.timeZone === "Asia/Kolkata"
      ? dueForBillingDate
      : normalizeDate(dueForBillingDate);

    if (!matchesSelectedFinancialYears(dueForBillingDate, year, filters)) {
      continue;
    }

    if (!isWithinFilterDateRange(normalizedBillingDate, filters)) {
      continue;
    }

    if (!matchesFilterMonth(normalizedBillingDate, filters)) {
      continue;
    }

    if (normalizedBillingDate > asOfDate) {
      continue;
    }

    dueForBillingTillNow += billedInvoiceAmount(cycle);
  }

  aging.supported =
    aging.notYetDueCount > 0 || aging.buckets.some((bucket) => bucket.count > 0);

  return {
    totalRevenueProjected,
    totalRevenueTillNow,
    dueForBillingTillNow,
    collectedAmountTillNow,
    pendingCollectionTillNow,
    overdueAmountTillNow,
    partialInvoiceCount,
    collectionEfficiency:
      totalRevenueTillNow > 0
        ? Number(
            ((collectedAmountTillNow / totalRevenueTillNow) * 100).toFixed(2),
          )
        : 0,
    aging,
  };
}

export async function getDueForBillingAmount(
  year?: number,
  filters?: BillingStatusFilters,
) {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return 0;

  const purchaseOrderFilter = getPurchaseOrderFilter(filters);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      ...(purchaseOrderFilter && {
        purchaseOrder: purchaseOrderFilter,
      }),
    },
    select: {
      billingSubmittedDate: true,
      invoiceDate: true,
      invoiceAmount: true,
      creditNote: true,
      invoiceNumber: true,
      purchaseOrder: {
        select: {
          company: {
            select: {
              id: true,
            },
          },
          customer: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  let totalDueForBilling = 0;
  const asOfDate = getSummaryAsOfDate(year, filters);
  
  for (const cycle of cycles) {
    const dueForBillingDate = getDueForBillingDate(cycle);

    if (!dueForBillingDate) {
      continue;
    }

    if (cycle.invoiceNumber?.trim()) {
      continue;
    }

    const normalizedBillingDate = normalizeDate(dueForBillingDate);

    if (!matchesSelectedFinancialYears(dueForBillingDate, year, filters)) {
      continue;
    }

    if (!matchesCompanyFilter(cycle, filters)) {
      continue;
    }

    if (!matchesCustomerFilter(cycle, filters)) {
      continue;
    }

    if (!isWithinFilterDateRange(normalizedBillingDate, filters)) {
      continue;
    }

    if (!matchesFilterMonth(normalizedBillingDate, filters)) {
      continue;
    }

    if (normalizedBillingDate > asOfDate) {
      continue;
    }

    totalDueForBilling += billedInvoiceAmount(cycle);
  }

  return totalDueForBilling;
}

export async function getBillingStatusDetails(
  year?: number,
  filters?: BillingStatusFilters,
) {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return { records: [], lines: [] };

  const cycles = await prisma.billingCycle.findMany({
    include: {
      payments: true,
      purchaseOrder: {
        include: {
          ServiceType: true,
          billingPlan: true,
          company: true,
          contractDuration: true,
          customer: true,
        },
      },
    },
  });

  const groupedRecords = new Map<string, GroupedRevenueDetail>();
  const lines: BillingInvoiceLine[] = [];

  for (const cycle of cycles) {
    const invoiceDate = getInvoiceDate(cycle);

    if (!invoiceDate) {
      continue;
    }

    const normalizedDate = filters?.timeZone === "Asia/Kolkata"
      ? invoiceDate
      : normalizeDate(invoiceDate);

    if (!matchesSelectedFinancialYears(invoiceDate, year, filters)) {
      continue;
    }

    if (!matchesCompanyFilter(cycle, filters)) {
      continue;
    }

    if (!matchesCustomerFilter(cycle, filters)) {
      continue;
    }

    if (!isWithinFilterDateRange(normalizedDate, filters)) {
      continue;
    }

    if (!matchesFilterMonth(normalizedDate, filters)) {
      continue;
    }

    const billed = billedInvoiceAmount(cycle);
    const collected = getEffectiveCollectedAmount(cycle);
    const receivable = classifyInvoiceReceivable(cycle);
    const pendingAmount = receivable.outstanding;
    const overdueBalance = receivable.overdue;
    const financialYear = filters?.timeZone === "Asia/Kolkata"
      ? (kolkataCalendar(normalizedDate).month < 4
        ? kolkataCalendar(normalizedDate).year - 1
        : kolkataCalendar(normalizedDate).year)
      : getFinancialYearForDate(normalizedDate);
    const financialMonth = fiscalMonthInZone(normalizedDate, filters);
    const shouldSplitByMonth =
      (Boolean(filters?.month) && filters?.month !== "all") ||
      (Boolean(filters?.quarter) && filters?.quarter !== "all");
    const period = shouldSplitByMonth
      ? `${MONTHS[financialMonth]} · ${formatFinancialYearLabel(financialYear)}`
      : formatFinancialYearLabel(financialYear);
    const groupKey = shouldSplitByMonth
      ? `${cycle.purchaseOrderId}-${financialYear}-${financialMonth}`
      : `${cycle.purchaseOrderId}-${financialYear}`;
    const configuredDurationMonths =
      cycle.purchaseOrder?.contractDuration?.totalNumberOfMonths;
    const contractDuration =
      typeof configuredDurationMonths === "number" &&
      configuredDurationMonths > 0
        ? `${configuredDurationMonths} months`
        : cycle.purchaseOrder?.contractDuration?.name || "-";
    lines.push({
      month: MONTHS[financialMonth],
      customerName: getCustomerDisplayName(cycle.purchaseOrder?.customer),
      companyName: cycle.purchaseOrder?.company?.name || "-",
      invoiceNumber: cycle.invoiceNumber?.trim() || "-",
      poNumber: cycle.purchaseOrder?.customerPONumber || "-",
      scope: cycle.purchaseOrder?.scope?.trim() || "-",
      serviceType: cycle.purchaseOrder?.ServiceType?.name || "-",
      billed: roundMoney(billed),
      creditNote: roundMoney(moneyToNumber(cycle.creditNote)),
      collected: roundMoney(collected),
      outstanding: roundMoney(pendingAmount + overdueBalance),
      status: cycle.purchaseOrder?.status || "-",
    });
    const existing = groupedRecords.get(groupKey);

    if (existing) {
      existing.amount += billed;
      existing.creditNote += moneyToNumber(cycle.creditNote);
      existing.collectedAmount += collected;
      existing.overdueAmount += pendingAmount;
      existing.pastDueAmount += receivable.overdue;
      existing.undatedOutstanding += receivable.undated;
      continue;
    }

    groupedRecords.set(groupKey, {
      id: groupKey,
      customerName: getCustomerDisplayName(cycle.purchaseOrder?.customer),
      companyId: cycle.purchaseOrder?.company?.id || null,
      companyName: cycle.purchaseOrder?.company?.name || "-",
      poNumber: cycle.purchaseOrder?.customerPONumber || "-",
      scope: cycle.purchaseOrder?.scope?.trim() || "-",
      amount: billed,
      creditNote: moneyToNumber(cycle.creditNote),
      collectedAmount: collected,
      overdueAmount: pendingAmount,
      serviceType: cycle.purchaseOrder?.ServiceType?.name || "-",
      billingPlan: cycle.purchaseOrder?.billingPlan?.name || "-",
      contractDuration,
      period,
      status: cycle.purchaseOrder?.status || "-",
      pastDueAmount: receivable.overdue,
      undatedOutstanding: receivable.undated,
    });
  }

  const records = Array.from(groupedRecords.values()).sort((a, b) => {
    const periodCompare = b.period.localeCompare(a.period);

    if (periodCompare !== 0) {
      return periodCompare;
    }

    const companyCompare = a.companyName.localeCompare(b.companyName);

    if (companyCompare !== 0) {
      return companyCompare;
    }

    return a.poNumber.localeCompare(b.poNumber);
  });

  lines.sort((left, right) => {
    const monthOrder = MONTHS.indexOf(left.month) - MONTHS.indexOf(right.month);
    if (monthOrder !== 0) return monthOrder;
    const customerOrder = left.customerName.localeCompare(right.customerName);
    if (customerOrder !== 0) return customerOrder;
    return left.invoiceNumber.localeCompare(right.invoiceNumber);
  });

  return { records, lines };
}

export async function getRevenueDetailsByMonth(
  params: RevenueMonthDetailsParams,
  filters?: BillingStatusFilters,
): Promise<RevenueMonthDetail[]> {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return [];

  const { start, end } = getFinancialMonthRange(params.year, params.month);
  const purchaseOrderFilter = getPurchaseOrderFilter(filters);

  const cycles = await prisma.billingCycle.findMany({
    where: {
      ...(purchaseOrderFilter && {
        purchaseOrder: purchaseOrderFilter,
      }),
    },
    include: {
      payments: true,
      purchaseOrder: {
        include: {
          company: true,
          customer: true,
        },
      },
    },
  });

  return cycles
    .filter((cycle) => {
      if (!matchesCompanyFilter(cycle, filters)) {
        return false;
      }

      if (!matchesCustomerFilter(cycle, filters)) {
        return false;
      }

      if (params.series === "payment") {
        return paymentReceipts(cycle).some((receipt) => {
          const normalizedDate = normalizeDate(receipt.receivedDate);
          return (
            normalizedDate >= start &&
            normalizedDate <= end &&
            isWithinFilterDateRange(normalizedDate, filters)
          );
        });
      }

      const seriesDate = getInvoiceDate(cycle);

      if (!seriesDate) {
        return false;
      }

      const normalizedDate = normalizeDate(seriesDate);

      if (normalizedDate < start || normalizedDate > end) {
        return false;
      }

      if (!isWithinFilterDateRange(normalizedDate, filters)) {
        return false;
      }

      return true;
    })
    .map((cycle) => {
      const billedAmount = billedInvoiceAmount(cycle);
      const receiptsInMonth = paymentReceipts(cycle).filter((receipt) => {
        const normalizedDate = normalizeDate(receipt.receivedDate);
        return normalizedDate >= start && normalizedDate <= end;
      });
      const paymentReceived =
        params.series === "payment"
          ? receiptsInMonth.reduce((total, receipt) => total + receipt.amount, 0)
          : getEffectiveCollectedAmount(cycle);

      const pendingAmount = classifyInvoiceReceivable(cycle).outstanding;

      const seriesDate =
        params.series === "payment"
          ? receiptsInMonth[0]?.receivedDate
          : getInvoiceDate(cycle);

      return {
        id: cycle.id,

        month: getBusinessMonthLabel(seriesDate || new Date()),

        year: getBusinessCalendarYear(seriesDate || new Date()),

        companyName: cycle.purchaseOrder?.company?.name || "-",

        customerName: getCustomerDisplayName(cycle.purchaseOrder?.customer),

        poNumber: cycle.purchaseOrder?.customerPONumber || "-",

        scope: cycle.purchaseOrder?.scope?.trim() || "-",

        invoiceNumber: cycle.invoiceNumber || "-",

        billedAmount,

        paymentReceived,

        pendingAmount: pendingAmount > 0 ? pendingAmount : 0,
      };
    });
}

export async function getRevenueDashboard(query: RevenueDashboardQuery) {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) {
    return {
      summary: emptyDashboardSummary(),
      comparison: null,
      records: [],
      lines: [],
      monthly: [],
    };
  }

  const selectedYears = filterTokens(query.year)
    .map(Number)
    .filter((value) => Number.isInteger(value));
  const filters: BillingStatusFilters = {
    company: query.company,
    customer: query.customer,
    startDate: query.startDate,
    endDate: query.endDate,
    month: query.month,
    quarter: query.quarter,
    years: selectedYears.length > 0 ? selectedYears : undefined,
    timeZone: "Asia/Kolkata",
  };
  const year = selectedYears.length === 1 ? selectedYears[0] : undefined;
  const currentFilters: DashboardFilters = {
    company: query.company || "all",
    customer: query.customer || "all",
    startDate: parseFilterDate(query.startDate ?? null),
    endDate: parseFilterDate(query.endDate ?? null),
    month: query.month || "all",
    quarter: query.quarter || "all",
    year: query.year || "all",
  };
  const earlier = previousPeriod(currentFilters);
  const comparisonFilters: BillingStatusFilters | null = earlier
    ? {
        company: query.company,
        customer: query.customer,
        startDate: earlier.startDate ? formatFilterDate(earlier.startDate) : undefined,
        endDate: earlier.endDate ? formatFilterDate(earlier.endDate) : undefined,
        month: earlier.month,
        quarter: earlier.quarter,
        timeZone: "Asia/Kolkata",
      }
    : null;
  const comparisonYear = earlier ? Number(earlier.year) : undefined;
  const monthlyYears = selectedYears.length > 0 ? selectedYears : [query.monthlyYear];
  const [summary, billingDetails, monthlySeries, comparisonSummary] = await Promise.all([
    getRevenueDashboardSummary(year, filters),
    getBillingStatusDetails(year, filters),
    Promise.all(monthlyYears.map((item) => getMonthlyBillingData(item, filters))),
    comparisonFilters
      ? getRevenueDashboardSummary(comparisonYear, comparisonFilters)
      : Promise.resolve(null),
  ]);
  const monthly = monthlySeries[0]?.map((point, index) => ({
    month: point.month,
    billing: monthlySeries.reduce((total, series) => total + (series[index]?.billing ?? 0), 0),
    creditNote: monthlySeries.reduce((total, series) => total + (series[index]?.creditNote ?? 0), 0),
    payment: monthlySeries.reduce((total, series) => total + (series[index]?.payment ?? 0), 0),
    overdue: monthlySeries.reduce((total, series) => total + (series[index]?.overdue ?? 0), 0),
    projected: monthlySeries.reduce((total, series) => total + (series[index]?.projected ?? 0), 0),
  })) ?? [];

  const comparison: RevenuePeriodComparison | null =
    earlier && comparisonSummary
      ? { label: earlier.label, summary: comparisonSummary }
      : null;

  return {
    summary,
    comparison,
    records: billingDetails.records,
    lines: billingDetails.lines,
    monthly,
  };
}
