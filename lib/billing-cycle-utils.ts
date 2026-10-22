import { BillingCycleType } from "@prisma/client";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonthSpan(startDate: Date, endDate?: Date | null) {
  if (!endDate) return 1;

  const start = getMonthStart(startDate);
  const end = getMonthStart(endDate);
  const diff =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;

  return Math.max(1, diff);
}

function normalizePlanName(planName?: string | null) {
  return planName?.trim().toLowerCase() ?? "";
}

function normalizePlanKey(planName?: string | null) {
  return normalizePlanName(planName).replace(/[^a-z0-9]/g, "");
}

function matchesPlanVariant(
  normalizedPlanName: string,
  normalizedPlanKey: string,
  variants: string[],
) {
  return variants.some((variant) => {
    const normalizedVariant = variant.toLowerCase();
    const normalizedVariantKey = normalizedVariant.replace(/[^a-z0-9]/g, "");

    return (
      normalizedPlanName.includes(normalizedVariant) ||
      normalizedPlanKey.includes(normalizedVariantKey)
    );
  });
}

export function isOtsName(name?: string | null) {
  const normalizedName = name?.trim().toLowerCase() ?? "";
  const normalizedKey = normalizedName.replace(/[^a-z0-9]/g, "");

  return (
    normalizedKey === "ots" ||
    /\bots\b/.test(normalizedName) ||
    normalizedName.includes("one time") ||
    normalizedName.includes("one-time") ||
    normalizedKey.includes("onetime")
  );
}

function getMidpointDate(startDate: Date, endDate: Date) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const midpoint = start.getTime() + Math.floor((end.getTime() - start.getTime()) / 2);

  return startOfDay(new Date(midpoint));
}

export function resolveBillingPlanInterval(
  totalBillingCycles?: number | null,
  planName?: string | null,
) {
  const normalizedPlanName = normalizePlanName(planName);
  const normalizedPlanKey = normalizePlanKey(planName);

  if (
    matchesPlanVariant(normalizedPlanName, normalizedPlanKey, [
      "milestone",
      "custom",
    ])
  ) {
    return {
      autoGenerate: false,
      singleCycle: false,
      intervalMonths: 0,
    };
  }

  if (isOtsName(planName)) {
    return {
      autoGenerate: true,
      singleCycle: true,
      intervalMonths: 0,
    };
  }

  if (
    matchesPlanVariant(normalizedPlanName, normalizedPlanKey, [
      "monthly",
      "month",
    ])
  ) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 1,
    };
  }

  if (
    matchesPlanVariant(normalizedPlanName, normalizedPlanKey, [
      "quarter",
      "quarterly",
      "quater",
      "quaterly",
      "qutar",
      "qutarely",
      "qtr",
    ])
  ) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 3,
    };
  }

  if (
    matchesPlanVariant(normalizedPlanName, normalizedPlanKey, [
      "halfyear",
      "half-year",
      "half yearly",
      "half-yearly",
      "semi-annual",
      "semi annual",
      "semiannual",
    ])
  ) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 6,
    };
  }

  if (
    matchesPlanVariant(normalizedPlanName, normalizedPlanKey, [
      "year",
      "yearly",
      "annual",
    ])
  ) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 12,
    };
  }

  const safeTotalBillingCycles = Math.max(
    0,
    Math.floor(Number(totalBillingCycles || 0)),
  );

  if (safeTotalBillingCycles <= 0) {
    return {
      autoGenerate: false,
      singleCycle: false,
      intervalMonths: 0,
    };
  }

  if (safeTotalBillingCycles === 1) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 12,
    };
  }

  if (12 % safeTotalBillingCycles === 0) {
    return {
      autoGenerate: true,
      singleCycle: false,
      intervalMonths: 12 / safeTotalBillingCycles,
    };
  }

  return {
    autoGenerate: true,
    singleCycle: false,
    intervalMonths: safeTotalBillingCycles,
  };
}

// function getBillingCycleOffsets(
//   startDate: Date,
//   endDate: Date | null | undefined,
//   intervalMonths: number,
//   singleCycle: boolean,
// ) {
//   if (singleCycle) return [0];

//   const totalMonths = getMonthSpan(startDate, endDate);
//   const safeIntervalMonths = Math.max(1, Math.floor(intervalMonths || 1));
//   const offsets: number[] = [];

//   for (let offset = 0; offset < totalMonths; offset += safeIntervalMonths) {
//     offsets.push(offset);
//   }

//   return offsets;
// }

function getBillingCycleOffsets(
  startDate: Date,
  endDate: Date | null | undefined,
  intervalMonths: number,
  singleCycle: boolean,
) {
  if (singleCycle) return [0];

  const totalMonths = getMonthSpan(startDate, endDate);
  const safeIntervalMonths = Math.max(1, Math.floor(intervalMonths || 1));
  const offsets: number[] = [];

  const cycles = Math.ceil(totalMonths / safeIntervalMonths);

  for (let i = 0; i < cycles; i++) {
    offsets.push(i * safeIntervalMonths);
  }

  return offsets;
}

function getBillingCycleWindow(
  startDate: Date,
  endDate: Date | null | undefined,
  offset: number,
  intervalMonths: number,
  singleCycle: boolean,
) {
  const cycleStartMonth = addMonths(startDate, offset);
  const actualCycleStart =
    offset === 0 ? startOfDay(startDate) : cycleStartMonth;
  const theoreticalCycleEnd = singleCycle
    ? endDate
      ? startOfDay(endDate)
      : getEndOfMonth(cycleStartMonth)
    : getEndOfMonth(
        addMonths(cycleStartMonth, Math.max(1, intervalMonths) - 1),
      );
  const actualCycleEnd =
    endDate && theoreticalCycleEnd > startOfDay(endDate)
      ? startOfDay(endDate)
      : theoreticalCycleEnd;

  return {
    cycleStart: actualCycleStart,
    cycleEnd: actualCycleEnd,
  };
}

function getCycleAnchorDate(
  cycleStart: Date,
  cycleEnd: Date,
  type: BillingCycleType | "START" | "MID" | "END",
) {
  if (type === "END") {
    return cycleEnd;
  }

  if (type === "MID") {
    return getMidpointDate(cycleStart, cycleEnd);
  }

  return cycleStart;
}

export function generateBillingCycleSchedule({
  startDate,
  endDate,
  totalBillingCycles,
  planName,
  type,
}: {
  startDate: Date;
  endDate?: Date | null;
  totalBillingCycles: number;
  planName?: string | null;
  type: BillingCycleType | "START" | "MID" | "END";
}) {
  const planInterval = resolveBillingPlanInterval(totalBillingCycles, planName);

  if (!planInterval.autoGenerate) return [];

  return getBillingCycleOffsets(
    startDate,
    endDate,
    planInterval.intervalMonths,
    planInterval.singleCycle,
  ).map((offset) => {
    const { cycleStart, cycleEnd } = getBillingCycleWindow(
      startDate,
      endDate,
      offset,
      planInterval.intervalMonths,
      planInterval.singleCycle,
    );

    return {
      cycleStart,
      cycleEnd,
      scheduledDate: getCycleAnchorDate(cycleStart, cycleEnd, type),
    };
  });
}

export function getBillingCycleDate(
  baseDate: Date,
  type: BillingCycleType | "START" | "MID" | "END",
) {
  const date = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    1,
  );

  if (type === "MID") {
    date.setDate(15);
    return date;
  }

  if (type === "END") {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  return date;
}

export function getPurchaseOrderCycleDates(
  baseDate: Date,
  type: BillingCycleType | "START" | "MID" | "END",
) {
  const monthStart = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    1,
  );

  if (type === "MID") {
    const midDate = new Date(monthStart);
    midDate.setDate(15);

    return {
      invoiceDate: midDate,
      billingSubmittedDate: midDate,
    };
  }

  if (type === "END") {
    const invoiceDate = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    );

    return {
      invoiceDate,
      billingSubmittedDate: invoiceDate,
    };
  }

  const invoiceDate = monthStart;

  return {
    invoiceDate,
    billingSubmittedDate: invoiceDate,
  };
}

export function generatePurchaseOrderBillingCycles({
  startDate,
  endDate,
  totalBillingCycles,
  planName,
  type,
}: {
  startDate: Date;
  endDate?: Date | null;
  totalBillingCycles: number;
  planName?: string | null;
  type: BillingCycleType | "START" | "MID" | "END";
}) {
  const planInterval = resolveBillingPlanInterval(totalBillingCycles, planName);

  return generateBillingCycleSchedule({
    startDate,
    endDate,
    totalBillingCycles,
    planName,
    type,
  }).map((cycle) => {
    const cycleDates = planInterval.singleCycle
      ? {
          invoiceDate: cycle.scheduledDate,
          billingSubmittedDate: cycle.scheduledDate,
        }
      : getPurchaseOrderCycleDates(cycle.scheduledDate, type);

    return {
      invoiceDate: cycleDates.invoiceDate,
      billingSubmittedDate: cycleDates.billingSubmittedDate,
    };
  });
}

export function generateProjectBillingCycles({
  startDate,
  endDate,
  totalBillingCycles,
  planName,
  type,
  amountPerCycle = 0,
}: {
  startDate: Date;
  endDate?: Date | null;
  totalBillingCycles: number;
  planName?: string | null;
  type: BillingCycleType | "START" | "MID" | "END";
  amountPerCycle?: number;
}) {
  return generateBillingCycleSchedule({
    startDate,
    endDate,
    totalBillingCycles,
    planName,
    type,
  }).map((cycle) => ({
    month: cycle.scheduledDate.getMonth(),
    year: cycle.scheduledDate.getFullYear(),
    billedAmount: 0,
    fms: 0,
    spare: 0,
    billableAmount: amountPerCycle,
    resourceUsed: 0,
    otherCost: [],
  }));
}

export function resolveCycleInvoiceAmount(
  existingAmount: number | null | undefined,
  generatedAmount: number,
  lastGeneratedAmount?: number | null,
) {
  const existing = Number(existingAmount ?? 0);
  const generated = Number(generatedAmount ?? 0);

  if (lastGeneratedAmount == null) {
    return {
      amount: existing > 0 ? existing : generated,
      trackedGeneratedAmount: generated,
    };
  }

  if (existing !== lastGeneratedAmount) {
    return {
      amount: existing,
      trackedGeneratedAmount: lastGeneratedAmount,
    };
  }

  return {
    amount: generated,
    trackedGeneratedAmount: generated,
  };
}

export function formatBillingCycleLabel(
  date?: Date | string | null,
  fallbackMonth?: number,
  fallbackYear?: number,
) {
  if (date) {
    const value = new Date(date);

    if (!Number.isNaN(value.getTime())) {
      return `${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;
    }
  }

  if (
    typeof fallbackMonth === "number" &&
    fallbackMonth >= 0 &&
    fallbackMonth <= 11 &&
    typeof fallbackYear === "number"
  ) {
    return `${MONTH_NAMES[fallbackMonth]} ${fallbackYear}`;
  }

  return "Billing Cycle";
}
