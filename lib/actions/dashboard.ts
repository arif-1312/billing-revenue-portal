"use server";

import { format } from "date-fns";
import { PaymentReceived, POStatus, Prisma } from "@prisma/client";

import { fiscalYearToDateWindows, formatFilterDate, parseFilterDate, previousPeriod } from "@/lib/dashboard-presets";
import {
  FIRST_FISCAL_YEAR,
  calendarDaysBetween,
  formatKolkataDate,
  getFiscalYear,
  kolkataCalendar,
  parseKolkataDate,
} from "@/lib/fiscal-year";
import {
  agingBucketForDaysPastDue,
  amountWithGst,
  emptyAging,
  filterTokens,
  GST_RATE,
  type AgingSummary,
  type DashboardFilters,
  type RevenueRecord,
} from "@/lib/revenue-metrics";
import { billedInvoiceAmount, classifyInvoiceReceivable, collectedAmountOf } from "@/lib/invoice-balances";
import { generateBillingCycleSchedule, resolveBillingPlanInterval } from "@/lib/billing-cycle-utils";
import { moneyToNumber, money, splitMoney } from "@/lib/money";
import { canonicalCustomerName, normalizeCustomerKey } from "@/lib/customer-names";
import { canonicalCompanyName, normalizeCompanyKey } from "@/lib/company-names";
import type { CrossFilter } from "@/lib/revenue-metrics";
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

export type BillingOverviewMetrics = {
  plannedBilling: number | null;
  billingDoneWithGst: number | null;
  billingDoneWithoutGst: number | null;
  upcomingBilling: number | null;
  billingAchievement: number | null;
  billingAchievementAbovePlan: boolean;
  gstRate: number;
  plannedRecords: DashboardKpiDetailRecord[];
};

export type RevenuePeriodComparison = {
  label: string;
  summary: RevenueDashboardSummary;
  records: RevenueRecord[];
  billingOverview: BillingOverviewMetrics | null;
  creditNotes: CreditNoteDashboardSummary | null;
};

interface BillingStatusFilters {
  company?: string;
  customer?: string;
  status?: string;
  crossFilter?: CrossFilter | null;
  purchaseOrderIds?: string[];
  startDate?: Date | string;
  endDate?: Date | string;
  month?: string;
  quarter?: string;
  years?: number[];
  timeZone?: "Asia/Kolkata";
  asOfReceivables?: boolean;
}

export type RevenueDashboardQuery = {
  company?: string;
  customer?: string;
  status?: string;
  crossFilter?: CrossFilter | null;
  startDate?: string;
  endDate?: string;
  month?: string;
  quarter?: string;
  year?: string;
  monthlyYear: number;
};

export type CreditNoteDashboardQuery = RevenueDashboardQuery;

export type CreditNoteDashboardSummary = {
  amount: number;
  count: number;
  comparison: { amount: number; count: number; label: string } | null;
};

export type BillingInvoiceLine = {
  id: string;
  invoiceIdentity: string;
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
  invoiceDate: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  recordDate: string | null;
  amount: number;
  gst: number;
  totalAmount: number;
  paymentStatus: string;
  paymentReceived: string;
  collectedAmount: number;
  collectedAsOfDate: number;
  notYetDueAmount: number;
  overdueAmount: number;
  undatedOutstanding: number;
  billingPlan: string;
  contractDuration: string;
  payments: Array<{ receivedDate: string; amount: number }>;
};

export type DashboardKpiDetailRecord = {
  id: string;
  source: "planned" | "credit-note";
  invoiceNumber: string;
  poNumber: string;
  companyName: string;
  customerName: string;
  invoiceDate: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  recordDate: string | null;
  amount: number;
  gst: number | null;
  totalAmount: number | null;
  paymentStatus: string;
  paymentReceived: string;
  poStatus: string;
  scope: string;
  serviceType: string;
  billingPlan: string;
  contractDuration: string;
  collectedAmount: number;
  collectedAsOfDate: number;
  outstanding: number;
  notYetDueAmount: number;
  overdueAmount: number;
  undatedOutstanding: number;
  payments: Array<{ receivedDate: string; amount: number }>;
  noteDetails?: string;
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
  creditNote: number;
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
  timeZone?: BillingStatusFilters["timeZone"],
) {
  return paymentReceipts(cycle)
    .filter((receipt) => timeZone === "Asia/Kolkata"
      ? formatKolkataDate(receipt.receivedDate) <= formatKolkataDate(asOfDate)
      : normalizeDate(receipt.receivedDate) <= asOfDate)
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
  const purchaseOrderFilter: Prisma.PurchaseOrderWhereInput = {};
  const companyId = idFilter(filters?.company);
  const customerId = idFilter(filters?.customer);

  if (companyId) purchaseOrderFilter.companyId = companyId;
  if (customerId) purchaseOrderFilter.customerId = customerId;
  const statuses = dashboardStatuses(filters);
  if (statuses) purchaseOrderFilter.status = { in: statuses };
  if (filters?.purchaseOrderIds) purchaseOrderFilter.id = { in: filters.purchaseOrderIds };

  return Object.keys(purchaseOrderFilter).length > 0
    ? purchaseOrderFilter
    : undefined;
}

function dashboardStatuses(query?: Pick<RevenueDashboardQuery, "status" | "crossFilter">) {
  const statuses = filterTokens(query?.status);
  const cross = query?.crossFilter;
  const selected = cross?.kind === "status"
    ? statuses.length ? statuses.filter((status) => status === cross.value) : [cross.value]
    : statuses;
  if (!statuses.length && cross?.kind !== "status") return undefined;
  return selected.filter((status): status is POStatus => Object.values(POStatus).includes(status as POStatus));
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
  if (filters?.crossFilter?.kind === "month" && MONTHS[financialMonth] !== filters.crossFilter.value) return false;
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

function getCustomerDisplayName(customer?: Pick<NonNullable<CustomerRecord>, "companyName" | "firstName" | "lastName" | "customerCode"> | null) {
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

  const notes = await dashboardCreditNotes(filters);
  for (const note of notes) {
    const normalizedNoteDate = filters?.timeZone === "Asia/Kolkata"
      ? note.date
      : normalizeDate(note.date);
    const fyMonth = fiscalMonthInZone(normalizedNoteDate, filters);
    const isFutureMonth = year === currentFY && fyMonth > currentFYMonth;
    const matchesPeriod =
      (filters?.timeZone === "Asia/Kolkata"
        ? inFinancialYear(note.date, year, filters)
        : normalizedNoteDate >= start && normalizedNoteDate <= end) &&
      isWithinFilterDateRange(normalizedNoteDate, filters) &&
      matchesFilterMonth(normalizedNoteDate, filters);

    if (!isFutureMonth && matchesPeriod) {
      data[fyMonth].billing = roundMoney(
        data[fyMonth].billing - moneyToNumber(note.amount),
      );
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
  const referenceToday = filters?.asOfReceivables ? asOfDate : new Date();

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

          const collectedTillNow = collectedByReceiptDate(cycle, asOfDate, filters?.timeZone);

          collectedAmountTillNow += collectedTillNow;
          const receivable = filters?.asOfReceivables
            ? classifyInvoiceReceivable({ ...cycle, payments: [], collectedAmount: collectedTillNow }, referenceToday)
            : classifyInvoiceReceivable(cycle, referenceToday);
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

  const notes = await dashboardCreditNotes(filters);
  let projectedCreditNotes = money(0);
  let billedCreditNotes = money(0);
  for (const note of notes) {
    if (!matchesSelectedFinancialYears(note.date, year, filters)) continue;

    // Projected revenue covers the whole selected financial year, including
    // credit notes outside the month, quarter, or custom date selection.
    projectedCreditNotes = projectedCreditNotes.plus(note.amount);

    const normalizedNoteDate = filters?.timeZone === "Asia/Kolkata"
      ? note.date
      : normalizeDate(note.date);
    if (!isWithinFilterDateRange(normalizedNoteDate, filters)) continue;
    if (!matchesFilterMonth(normalizedNoteDate, filters)) continue;
    if (normalizedNoteDate > asOfDate) continue;

    billedCreditNotes = billedCreditNotes.plus(note.amount);
  }
  totalRevenueProjected = moneyToNumber(money(totalRevenueProjected).minus(projectedCreditNotes));
  totalRevenueTillNow = moneyToNumber(money(totalRevenueTillNow).minus(billedCreditNotes));

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
  const asOfDate = getSummaryAsOfDate(year, filters);

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
    const collectedAsOfDate = collectedByReceiptDate(cycle, asOfDate, filters?.timeZone);
    const collected = filters?.asOfReceivables ? collectedAsOfDate : getEffectiveCollectedAmount(cycle);
    const receivable = filters?.asOfReceivables
      ? classifyInvoiceReceivable({ ...cycle, payments: [], collectedAmount: collectedAsOfDate }, asOfDate)
      : classifyInvoiceReceivable(cycle);
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
      id: cycle.id,
      invoiceIdentity: `${cycle.purchaseOrder?.company?.id ?? cycle.purchaseOrder?.customer?.id ?? cycle.purchaseOrderId}|${cycle.invoiceNumber.trim().toUpperCase()}|${cycle.invoiceDate ? formatKolkataDate(cycle.invoiceDate) : ""}`,
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
      invoiceDate: cycle.invoiceDate?.toISOString() ?? null,
      dueDate: cycle.paymentDueDate?.toISOString() ?? null,
      scheduledDate: cycle.billingSubmittedDate?.toISOString() ?? null,
      recordDate: invoiceDate.toISOString(),
      amount: roundMoney(billed),
      gst: roundMoney(amountWithGst(billed) - billed),
      totalAmount: roundMoney(amountWithGst(billed)),
      paymentStatus: receivable.outstanding + receivable.overdue + receivable.undated <= 0 && billed > 0
        ? "Paid"
        : collected > 0
          ? "Partially paid"
          : cycle.paymentReceived === PaymentReceived.YES
            ? "Marked paid"
            : "Unpaid",
      paymentReceived: cycle.paymentReceived,
      collectedAmount: roundMoney(collected),
      collectedAsOfDate: roundMoney(collectedAsOfDate),
      notYetDueAmount: roundMoney(receivable.outstanding),
      overdueAmount: roundMoney(receivable.overdue),
      undatedOutstanding: roundMoney(receivable.undated),
      contractDuration,
      billingPlan: cycle.purchaseOrder?.billingPlan?.name || "-",
      payments: (cycle.payments ?? []).map((payment) => ({
        receivedDate: payment.receivedDate.toISOString(),
        amount: moneyToNumber(payment.amount),
      })),
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

        creditNote: roundMoney(moneyToNumber(cycle.creditNote)),

        paymentReceived,

        pendingAmount: pendingAmount > 0 ? pendingAmount : 0,
      };
    });
}

function dashboardPeriods(query: RevenueDashboardQuery) {
  if (query.startDate || query.endDate) query = { ...query, month: "all", quarter: "all" };
  const selectedYears = filterTokens(query.year)
    .map(Number)
    .filter((value) => Number.isInteger(value));
  const filters: BillingStatusFilters = {
    company: query.company,
    customer: query.customer,
    status: query.status,
    crossFilter: query.crossFilter,
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
  const ytd = fiscalYearToDateWindows(new Date());
  const useYtd = year === ytd.financialYear && !query.startDate && !query.endDate &&
    (!query.month || query.month === "all") && (!query.quarter || query.quarter === "all");
  if (useYtd) {
    filters.startDate = ytd.currentStart;
    filters.endDate = ytd.currentEnd;
    filters.asOfReceivables = true;
  }
  const earlier = useYtd && year - 1 >= FIRST_FISCAL_YEAR
    ? {
        year: String(year - 1), month: "all", quarter: "all",
        startDate: parseFilterDate(ytd.previousStart),
        endDate: parseFilterDate(ytd.previousEnd),
        label: `FY ${year - 1}–${String(year).slice(-2)} YTD`,
      }
    : previousPeriod(currentFilters);
  const comparisonFilters: BillingStatusFilters | null = earlier
    ? {
        company: query.company,
        customer: query.customer,
        status: query.status,
        crossFilter: query.crossFilter,
        startDate: earlier.startDate ? formatFilterDate(earlier.startDate) : undefined,
        endDate: earlier.endDate ? formatFilterDate(earlier.endDate) : undefined,
        month: earlier.month,
        quarter: earlier.quarter,
        timeZone: "Asia/Kolkata",
        asOfReceivables: useYtd,
      }
    : null;
  const comparisonYear = earlier ? Number(earlier.year) : undefined;
  return { selectedYears, filters, year, earlier, comparisonFilters, comparisonYear, useYtd };
}

// Credit notes contain a free-text customer name. Match the existing customer
// aliases and common legal suffixes without fuzzy or substring matching.
function creditNoteCustomerKey(name: string) {
  return normalizeCustomerKey(canonicalCustomerName(name))
    .replace(/\bprivate\b/g, "pvt")
    .replace(/\blimited\b/g, "ltd")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

async function dashboardPartyScope(query?: Pick<CreditNoteDashboardQuery, "company" | "customer" | "status" | "crossFilter">) {
  const customerId = idFilter(query?.customer);
  const companyId = idFilter(query?.company);
  const cross = query?.crossFilter;
  const validStatuses = dashboardStatuses(query);
  if (validStatuses?.length === 0) {
    return { customerKeys: new Set<string>(), purchaseOrderIds: [] };
  }
  const companyName = cross?.kind === "company" ? cross.value : undefined;
  const customerName = cross?.kind === "customer" ? cross.value : undefined;
  const needsPurchaseOrder = Boolean(companyId || companyName || validStatuses?.length);
  if (!customerId && !customerName && !needsPurchaseOrder) return { customerKeys: null };

  const purchaseOrderWhere: Prisma.PurchaseOrderWhereInput = {
    ...(companyId ? { companyId } : {}),
    ...(validStatuses?.length ? { status: { in: validStatuses } } : {}),
  };
  const customers = await prisma.customer.findMany({
    where: {
      ...(customerId ? { id: customerId } : {}),
      ...(needsPurchaseOrder ? { purchaseOrders: { some: purchaseOrderWhere } } : {}),
    },
    select: {
      companyName: true,
      firstName: true,
      lastName: true,
      customerCode: true,
      purchaseOrders: {
        where: purchaseOrderWhere,
        select: { id: true, company: { select: { name: true } } },
      },
    },
  });
  const customerKeys = new Set<string>();
  const purchaseOrderIds: string[] = [];
  for (const customer of customers) {
    const key = creditNoteCustomerKey(getCustomerDisplayName(customer));
    if (customerName && key !== creditNoteCustomerKey(customerName)) continue;
    const orders = customer.purchaseOrders.filter((order) => !companyName ||
      (order.company?.name ?? "-") === companyName ||
      (order.company && normalizeCompanyKey(canonicalCompanyName(order.company.name)) ===
        normalizeCompanyKey(canonicalCompanyName(companyName))),
    );
    if (companyName && !orders.length) continue;
    if (key) customerKeys.add(key);
    purchaseOrderIds.push(...orders.map((order) => order.id));
  }
  return { customerKeys, purchaseOrderIds };
}

async function dashboardCreditNotes(filters?: BillingStatusFilters) {
  const { customerKeys } = await dashboardPartyScope(filters);
  if (customerKeys?.size === 0) return [];
  const notes = await prisma.creditNote.findMany({
    select: { customerName: true, date: true, amount: true },
  });
  return customerKeys ? notes.filter((note) => customerKeys.has(creditNoteCustomerKey(note.customerName))) : notes;
}

export async function getCreditNoteDashboardSummary(
  query: CreditNoteDashboardQuery,
): Promise<CreditNoteDashboardSummary> {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) throw new Error(access.message);

  const { year, filters, earlier, comparisonFilters, comparisonYear } = dashboardPeriods(query);
  const { customerKeys } = await dashboardPartyScope(query);
  const summarize = (notes: Array<{ date: Date; amount: Prisma.Decimal }>, periodYear: number | undefined, periodFilters: BillingStatusFilters) => {
    let total = money(0);
    let count = 0;
    for (const note of notes) {
      if (!matchesSelectedFinancialYears(note.date, periodYear, periodFilters)) continue;
      if (!isWithinFilterDateRange(note.date, periodFilters)) continue;
      if (!matchesFilterMonth(note.date, periodFilters)) continue;
      total = total.plus(note.amount);
      count += 1;
    }
    return { amount: moneyToNumber(total), count };
  };

  // Bound the read to the current and comparison fiscal years/date windows.
  const dateWindow = (periodYear: number | undefined, periodFilters: BillingStatusFilters): Prisma.CreditNoteWhereInput => {
    const years = selectedFinancialYears(periodYear, periodFilters);
    let start = years.length ? parseKolkataDate(`${Math.min(...years)}-04-01`) : undefined;
    let end = years.length ? parseKolkataDate(`${Math.max(...years) + 1}-03-31`, true) : undefined;
    if (typeof periodFilters.startDate === "string") {
      const from = parseKolkataDate(periodFilters.startDate);
      if (!start || from > start) start = from;
    }
    if (typeof periodFilters.endDate === "string") {
      const to = parseKolkataDate(periodFilters.endDate, true);
      if (!end || to < end) end = to;
    }
    return start || end ? { date: { gte: start, lte: end } } : {};
  };
  const windows = [dateWindow(year, filters)];
  if (comparisonFilters) windows.push(dateWindow(comparisonYear, comparisonFilters));
  const notes = customerKeys?.size === 0 ? [] : await prisma.creditNote.findMany({
    where: { OR: windows },
    select: { customerName: true, date: true, amount: true },
  });
  const matchingNotes = customerKeys
    ? notes.filter((note) => customerKeys.has(creditNoteCustomerKey(note.customerName)))
    : notes;
  return {
    ...summarize(matchingNotes, year, filters),
    comparison: earlier && comparisonFilters
      ? { ...summarize(matchingNotes, comparisonYear, comparisonFilters), label: earlier.label }
      : null,
  };
}

async function getCreditNoteKpiDetails(
  query: CreditNoteDashboardQuery,
): Promise<DashboardKpiDetailRecord[]> {
  const { year, filters } = dashboardPeriods(query);
  const { customerKeys, purchaseOrderIds = [] } = await dashboardPartyScope(query);
  if (customerKeys?.size === 0) return [];

  const [notes, orders] = await Promise.all([
    prisma.creditNote.findMany({
      select: { id: true, customerName: true, date: true, vchType: true, vchNo: true, amount: true },
    }),
    prisma.purchaseOrder.findMany({
      where: purchaseOrderIds.length ? { id: { in: purchaseOrderIds } } : undefined,
      select: {
        customerPONumber: true,
        status: true,
        scope: true,
        company: { select: { name: true } },
        customer: { select: { companyName: true, firstName: true, lastName: true, customerCode: true } },
        ServiceType: { select: { name: true } },
        billingPlan: { select: { name: true } },
      },
    }),
  ]);

  return notes
    .filter((note) =>
      (!customerKeys || customerKeys.has(creditNoteCustomerKey(note.customerName))) &&
      matchesSelectedFinancialYears(note.date, year, filters) &&
      isWithinFilterDateRange(note.date, filters) &&
      matchesFilterMonth(note.date, filters),
    )
    .map((note) => {
      const noteKey = creditNoteCustomerKey(note.customerName);
      const relatedOrders = orders.filter((order) =>
        order.customer && creditNoteCustomerKey(getCustomerDisplayName(order.customer)) === noteKey,
      );
      const amount = moneyToNumber(note.amount);
      const companies = [...new Set(relatedOrders.map((order) => order.company?.name).filter(Boolean))];
      const purchaseOrders = [...new Set(relatedOrders.map((order) => order.customerPONumber?.trim()).filter(Boolean))];
      return {
        id: `credit-note-${note.id}`,
        source: "credit-note" as const,
        invoiceNumber: "-",
        poNumber: purchaseOrders.length ? purchaseOrders.join(", ") : "-",
        companyName: companies.length ? companies.join(", ") : "-",
        customerName: note.customerName,
        invoiceDate: null,
        dueDate: null,
        scheduledDate: null,
        recordDate: note.date.toISOString(),
        amount: roundMoney(amount),
        gst: null,
        totalAmount: null,
        paymentStatus: "Credit note",
        paymentReceived: "N/A",
        poStatus: [...new Set(relatedOrders.map((order) => order.status))].join(", ") || "-",
        scope: [...new Set(relatedOrders.map((order) => order.scope?.trim()).filter(Boolean))].join(", ") || "-",
        serviceType: [...new Set(relatedOrders.map((order) => order.ServiceType?.name).filter(Boolean))].join(", ") || "-",
        billingPlan: [...new Set(relatedOrders.map((order) => order.billingPlan?.name).filter(Boolean))].join(", ") || "-",
        contractDuration: "-",
        collectedAmount: 0,
        collectedAsOfDate: 0,
        outstanding: 0,
        notYetDueAmount: 0,
        overdueAmount: 0,
        undatedOutstanding: 0,
        payments: [],
        noteDetails: `${note.vchType} ${note.vchNo} · ${formatKolkataDate(note.date)}`,
      };
    });
}

type BillingOverviewPurchaseOrder = Prisma.PurchaseOrderGetPayload<{
  select: {
    id: true;
    customerPONumber: true;
    scope: true;
    status: true;
    poAmount: true;
    startFrom: true;
    endDate: true;
    companyId: true;
    customerId: true;
    company: { select: { name: true } };
    customer: { select: { companyName: true; firstName: true; lastName: true; customerCode: true } };
    ServiceType: { select: { name: true } };
    billingPlan: { select: { name: true; totalBillingCycles: true; billingCycleType: true; status: true } };
    contractDuration: { select: { totalNumberOfMonths: true } };
    billingCycles: {
      select: {
        id: true;
        invoiceNumber: true;
        invoiceDate: true;
        billingSubmittedDate: true;
        invoiceAmount: true;
        paymentDueDate: true;
        paymentReceivedDate: true;
        paymentReceived: true;
        collectedAmount: true;
        payments: { select: { receivedDate: true; amount: true } };
      };
    };
  };
}>;

function addMonthsMinusOneDay(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  result.setDate(result.getDate() - 1);
  return result;
}

function effectivePurchaseOrderEnd(order: BillingOverviewPurchaseOrder) {
  if (order.endDate) return order.endDate;
  if (!order.startFrom) return null;
  const duration = order.contractDuration?.totalNumberOfMonths ?? 0;
  return duration > 0 ? addMonthsMinusOneDay(order.startFrom, duration) : null;
}

function billingDatesForDerivation(order: BillingOverviewPurchaseOrder) {
  if (!order.startFrom || !order.poAmount || !order.billingPlan) {
    return null;
  }

  const plan = order.billingPlan;
  const interval = resolveBillingPlanInterval(plan.totalBillingCycles, plan.name);
  if (!interval.autoGenerate) return null;

  let endDate = order.endDate;
  if (!endDate) {
    const configuredDuration = order.contractDuration?.totalNumberOfMonths ?? 0;
    const inferredDuration = interval.singleCycle
      ? 1
      : interval.intervalMonths * Math.max(0, Math.floor(plan.totalBillingCycles));
    const duration = configuredDuration > 0 ? configuredDuration : inferredDuration;
    if (duration <= 0) return null;
    endDate = addMonthsMinusOneDay(order.startFrom, duration);
  }
  if (endDate < order.startFrom) return null;

  return generateBillingCycleSchedule({
    startDate: order.startFrom,
    endDate,
    totalBillingCycles: plan.totalBillingCycles,
    planName: plan.name,
    type: plan.billingCycleType,
  });
}

function poMayMatchPeriod(order: BillingOverviewPurchaseOrder, filters: BillingStatusFilters) {
  const years = selectedFinancialYears(undefined, filters);
  const poStart = order.startFrom;
  const poEnd = effectivePurchaseOrderEnd(order);
  if (!poStart) return true;

  const yearWindows = years.length > 0
    ? years.map((selectedYear) => ({
        start: parseKolkataDate(`${selectedYear}-04-01`),
        end: parseKolkataDate(`${selectedYear + 1}-03-31`, true),
      }))
    : [{ start: null, end: null }];

  return yearWindows.some(({ start: yearStart, end: yearEnd }) => {
    const start = typeof filters.startDate === "string"
      ? parseKolkataDate(filters.startDate)
      : null;
    const end = typeof filters.endDate === "string"
      ? parseKolkataDate(filters.endDate, true)
      : null;
    const lower = [yearStart, start].filter((item): item is Date => item != null)
      .reduce<Date | null>((value, item) => !value || item > value ? item : value, null);
    const upper = [yearEnd, end].filter((item): item is Date => item != null)
      .reduce<Date | null>((value, item) => !value || item < value ? item : value, null);
    return (!upper || poStart <= upper) && (!lower || !poEnd || poEnd >= lower);
  });
}

function billingDateMatches(date: Date, year: number | undefined, filters: BillingStatusFilters) {
  return matchesSelectedFinancialYears(date, year, filters) &&
    isWithinFilterDateRange(date, filters) &&
    matchesFilterMonth(date, filters);
}

async function getBillingOverviewMetrics(
  year: number | undefined,
  filters: BillingStatusFilters,
): Promise<BillingOverviewMetrics> {
  const orders = await prisma.purchaseOrder.findMany({
    where: getPurchaseOrderFilter(filters),
    select: {
      id: true,
      customerPONumber: true,
      scope: true,
      status: true,
      poAmount: true,
      startFrom: true,
      endDate: true,
      companyId: true,
      customerId: true,
      company: { select: { name: true } },
      customer: { select: { companyName: true, firstName: true, lastName: true, customerCode: true } },
      ServiceType: { select: { name: true } },
      billingPlan: {
        select: {
          name: true,
          totalBillingCycles: true,
          billingCycleType: true,
          status: true,
        },
      },
      contractDuration: { select: { totalNumberOfMonths: true } },
      billingCycles: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          billingSubmittedDate: true,
          invoiceAmount: true,
          paymentDueDate: true,
          paymentReceivedDate: true,
          paymentReceived: true,
          collectedAmount: true,
          payments: { select: { receivedDate: true, amount: true } },
        },
      },
    },
  });

  const asOfDate = getSummaryAsOfDate(year, filters);
  let planned = money(0);
  let plannedAvailable = true;
  let upcoming = money(0);
  let upcomingAvailable = true;
  let invoicedWithoutGst = money(0);
  let invoicedWithGst = money(0);
  let invoicesAvailable = true;
  const invoices = new Map<string, string>();
  const plannedRecords: DashboardKpiDetailRecord[] = [];

  const plannedRecord = (
    order: BillingOverviewPurchaseOrder,
    amount: number,
    scheduledDate: Date,
    cycle?: BillingOverviewPurchaseOrder["billingCycles"][number],
  ): DashboardKpiDetailRecord => {
    const collectedAmount = cycle
      ? getEffectiveCollectedAmount(cycle)
      : 0;
    const invoiceNumber = cycle?.invoiceNumber.trim() || "-";
    const invoiceAmount = amount;
    return {
      id: `planned-${order.id}-${cycle?.id ?? formatKolkataDate(scheduledDate)}`,
      source: "planned",
      invoiceNumber,
      poNumber: order.customerPONumber?.trim() || "-",
      companyName: order.company?.name || "-",
      customerName: getCustomerDisplayName(order.customer),
      invoiceDate: cycle?.invoiceDate?.toISOString() ?? null,
      dueDate: cycle?.paymentDueDate?.toISOString() ?? null,
      scheduledDate: scheduledDate.toISOString(),
      recordDate: scheduledDate.toISOString(),
      amount: roundMoney(invoiceAmount),
      gst: roundMoney(amountWithGst(invoiceAmount) - invoiceAmount),
      totalAmount: roundMoney(amountWithGst(invoiceAmount)),
      paymentStatus: !cycle || !invoiceNumber || invoiceNumber === "-"
        ? "Not invoiced"
        : collectedAmount >= invoiceAmount && invoiceAmount > 0
          ? "Paid"
          : collectedAmount > 0
            ? "Partially paid"
            : cycle.paymentReceived === PaymentReceived.YES
              ? "Marked paid"
              : "Unpaid",
      paymentReceived: cycle?.paymentReceived ?? PaymentReceived.NO,
      poStatus: order.status,
      scope: order.scope?.trim() || "-",
      serviceType: order.ServiceType?.name || "-",
      billingPlan: order.billingPlan?.name || "-",
      contractDuration: order.contractDuration?.totalNumberOfMonths
        ? `${order.contractDuration.totalNumberOfMonths} months`
        : "-",
      collectedAmount: roundMoney(collectedAmount),
      collectedAsOfDate: cycle
        ? roundMoney(collectedByReceiptDate(cycle, asOfDate, filters?.timeZone))
        : 0,
      outstanding: roundMoney(Math.max(invoiceAmount - collectedAmount, 0)),
      notYetDueAmount: 0,
      overdueAmount: 0,
      undatedOutstanding: 0,
      payments: (cycle?.payments ?? []).map((payment) => ({
        receivedDate: payment.receivedDate.toISOString(),
        amount: moneyToNumber(payment.amount),
      })),
    };
  };

  for (const order of orders) {
    const orderOverlaps = poMayMatchPeriod(order, filters);
    const derivedSchedule = order.billingCycles.length === 0 && orderOverlaps
      ? billingDatesForDerivation(order)
      : null;

    if (order.billingCycles.length > 0) {
      for (const cycle of order.billingCycles) {
        const scheduledDate = cycle.billingSubmittedDate ?? cycle.invoiceDate;
        if (!scheduledDate) {
          if (orderOverlaps) {
            plannedAvailable = false;
            if (order.status === POStatus.LIVE) upcomingAvailable = false;
          }
          continue;
        }

        if (billingDateMatches(scheduledDate, year, filters)) {
          if (cycle.invoiceAmount == null) plannedAvailable = false;
          else {
            planned = planned.plus(cycle.invoiceAmount);
            plannedRecords.push(plannedRecord(order, moneyToNumber(cycle.invoiceAmount), scheduledDate, cycle));
          }
        }

        const invoiceNumber = cycle.invoiceNumber.trim();
        if (!invoiceNumber && order.status === POStatus.LIVE &&
            scheduledDate > asOfDate && billingDateMatches(scheduledDate, year, filters)) {
          if (cycle.invoiceAmount == null) upcomingAvailable = false;
          else upcoming = upcoming.plus(cycle.invoiceAmount);
        }

        if (!invoiceNumber) continue;
        if (!cycle.invoiceDate) {
          if (orderOverlaps) invoicesAvailable = false;
          continue;
        }
        if (!billingDateMatches(cycle.invoiceDate, year, filters)) continue;
        if (cycle.invoiceAmount == null) {
          invoicesAvailable = false;
          continue;
        }

        const invoiceKey = `${order.companyId ?? order.customerId ?? order.id}|${invoiceNumber.toUpperCase()}|${formatKolkataDate(cycle.invoiceDate)}`;
        const amount = money(cycle.invoiceAmount);
        const previous = invoices.get(invoiceKey);
        if (previous != null) {
          if (!money(previous).equals(amount)) invoicesAvailable = false;
          continue;
        }
        invoices.set(invoiceKey, amount.toFixed(2));
        invoicedWithoutGst = invoicedWithoutGst.plus(amount);
        invoicedWithGst = invoicedWithGst.plus(amountWithGst(moneyToNumber(amount)));
      }
      continue;
    }

    if (!orderOverlaps) continue;
    if (derivedSchedule) {
      const shares = splitMoney(order.poAmount, derivedSchedule.length);
      derivedSchedule.forEach((cycle, index) => {
        if (billingDateMatches(cycle.scheduledDate, year, filters)) {
          const amount = shares[index] ?? 0;
          planned = planned.plus(amount);
          plannedRecords.push(plannedRecord(order, moneyToNumber(amount), cycle.scheduledDate));
        }
        if (order.status === POStatus.LIVE && cycle.scheduledDate > asOfDate &&
            billingDateMatches(cycle.scheduledDate, year, filters)) {
          // A calculable plan is not an actual generated billing cycle. Keep the
          // upcoming figure unavailable rather than inventing a scheduled row.
          upcomingAvailable = false;
        }
      });
    } else {
      plannedAvailable = false;
      if (order.status === POStatus.LIVE &&
          (!effectivePurchaseOrderEnd(order) || effectivePurchaseOrderEnd(order)! > asOfDate) &&
          poMayMatchPeriod(order, filters)) {
        upcomingAvailable = false;
      }
    }
  }

  const billingDoneWithoutGst = invoicesAvailable
    ? moneyToNumber(invoicedWithoutGst)
    : null;
  const plannedBilling = plannedAvailable ? moneyToNumber(planned) : null;
  const billingAchievement = plannedBilling != null && plannedBilling > 0 && billingDoneWithoutGst != null
    ? Number(((billingDoneWithoutGst / plannedBilling) * 100).toFixed(2))
    : null;

  return {
    plannedBilling,
    billingDoneWithGst: invoicesAvailable ? moneyToNumber(invoicedWithGst) : null,
    billingDoneWithoutGst,
    upcomingBilling: upcomingAvailable ? moneyToNumber(upcoming) : null,
    billingAchievement,
    billingAchievementAbovePlan: billingAchievement != null && billingAchievement > 100,
    gstRate: GST_RATE,
    plannedRecords,
  };
}

export async function getRevenueDashboard(query: RevenueDashboardQuery) {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) throw new Error(access.message);
  const { selectedYears, filters, year, earlier, comparisonFilters, comparisonYear, useYtd } = dashboardPeriods(query);
  if (query.crossFilter?.kind === "company" || query.crossFilter?.kind === "customer") {
    const { purchaseOrderIds } = await dashboardPartyScope(query);
    filters.purchaseOrderIds = purchaseOrderIds ?? [];
    if (comparisonFilters) comparisonFilters.purchaseOrderIds = filters.purchaseOrderIds;
  }
  const monthlyYears = selectedYears.length > 0 ? selectedYears : [query.monthlyYear];
  const comparisonQuery: RevenueDashboardQuery | null = comparisonFilters && comparisonYear != null
    ? {
        ...query,
        year: String(comparisonYear),
        month: comparisonFilters.month,
        quarter: comparisonFilters.quarter,
        startDate: comparisonFilters.startDate
          ? typeof comparisonFilters.startDate === "string"
            ? comparisonFilters.startDate
            : formatFilterDate(comparisonFilters.startDate)
          : undefined,
        endDate: comparisonFilters.endDate
          ? typeof comparisonFilters.endDate === "string"
            ? comparisonFilters.endDate
            : formatFilterDate(comparisonFilters.endDate)
          : undefined,
      }
    : null;
  const [summary, billingDetails, monthlySeries, comparisonSummary, creditNotes, creditNoteRecords, billingOverview, comparisonDetails, comparisonBillingOverview, comparisonCreditNotes, fullYearBillingOverview] = await Promise.all([
    getRevenueDashboardSummary(year, filters),
    getBillingStatusDetails(year, filters),
    Promise.all(monthlyYears.map((item) => getMonthlyBillingData(item, useYtd ? { ...filters, startDate: undefined, endDate: undefined } : filters))),
    comparisonFilters
      ? getRevenueDashboardSummary(comparisonYear, comparisonFilters)
      : Promise.resolve(null),
    getCreditNoteDashboardSummary(query),
    getCreditNoteKpiDetails(query),
    getBillingOverviewMetrics(year, filters).catch((error: unknown) => {
      console.error("Billing overview metrics could not be loaded", error);
      return null;
    }),
    comparisonQuery && comparisonFilters && comparisonYear != null
      ? getBillingStatusDetails(comparisonYear, comparisonFilters)
      : Promise.resolve({ records: [], lines: [] }),
    comparisonQuery && comparisonFilters && comparisonYear != null
      ? getBillingOverviewMetrics(comparisonYear, comparisonFilters).catch((error: unknown) => {
          console.error("Comparison billing overview could not be loaded", error);
          return null;
        })
      : Promise.resolve(null),
    comparisonQuery
      ? getCreditNoteDashboardSummary(comparisonQuery).catch((error: unknown) => {
          console.error("Comparison credit notes could not be loaded", error);
          return null;
        })
      : Promise.resolve(null),
    useYtd
      ? getBillingOverviewMetrics(year, { ...filters, startDate: undefined, endDate: undefined }).catch((error: unknown) => {
          console.error("Full-year billing overview could not be loaded", error);
          return null;
        })
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
      ? {
          label: earlier.label,
          summary: comparisonSummary,
          records: comparisonDetails.records,
          billingOverview: comparisonBillingOverview,
          creditNotes: comparisonCreditNotes,
        }
      : null;

  return {
    summary,
    comparison,
    records: billingDetails.records,
    lines: billingDetails.lines,
    monthly,
    creditNotes,
    creditNoteRecords,
    billingOverview: billingOverview && useYtd
      ? { ...billingOverview, upcomingBilling: fullYearBillingOverview?.upcomingBilling ?? null }
      : billingOverview,
  };
}

export async function getRevenueDashboardFinancialYears() {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) return [getFiscalYear(new Date())];

  const [cycles, purchaseOrders] = await Promise.all([
    prisma.billingCycle.findMany({
      select: {
        billingSubmittedDate: true,
        invoiceDate: true,
        paymentDueDate: true,
        paymentReceivedDate: true,
        payments: { select: { receivedDate: true } },
      },
    }),
    prisma.purchaseOrder.findMany({
      select: { startFrom: true, endDate: true },
    }),
  ]);
  const years = new Set([getFiscalYear(new Date())]);

  for (const cycle of cycles) {
    const dates = [
      cycle.billingSubmittedDate,
      cycle.invoiceDate,
      cycle.paymentDueDate,
      cycle.paymentReceivedDate,
      ...cycle.payments.map((payment) => payment.receivedDate),
    ];
    for (const date of dates) {
      if (date && !Number.isNaN(date.getTime())) years.add(getFiscalYear(date));
    }
  }

  for (const order of purchaseOrders) {
    for (const date of [order.startFrom, order.endDate]) {
      if (date && !Number.isNaN(date.getTime())) years.add(getFiscalYear(date));
    }
  }

  return [...years].sort((left, right) => right - left);
}
