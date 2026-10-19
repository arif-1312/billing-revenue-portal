export type DashboardFilters = {
  company: string;
  customer: string;
  startDate?: Date;
  endDate?: Date;
  month: string;
  quarter: string;
  year: string;
};

/** Empty means every value. Multiple choices are stored as comma-separated tokens. */
export function filterTokens(value: string | null | undefined) {
  if (!value || value === "all") return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token && token !== "all");
}

export function toggleFilterToken(current: string, token: string) {
  const selected = filterTokens(current);
  const next = selected.includes(token)
    ? selected.filter((item) => item !== token)
    : [...selected, token];

  if (next.length === 0) return "all";
  if (next.every((item) => /^\d+$/.test(item))) {
    next.sort((left, right) => Number(left) - Number(right));
  }
  return next.join(",");
}

export type RevenueRecord = {
  id?: string | number | null;
  period?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  poNumber?: string | null;
  scope?: string | null;
  amount?: number | string | null;
  collectedAmount?: number | string | null;
  overdueAmount?: number | string | null;
  serviceType?: string | null;
  billingPlan?: string | null;
  contractDuration?: string | null;
  status?: string | null;
  pastDueAmount?: number | string | null;
  undatedOutstanding?: number | string | null;
};

export type MonthPoint = {
  month: string;
  billing: number;
  payment: number;
  overdue: number;
  projected?: number;
};

export type CrossFilter =
  | { kind: "customer"; value: string }
  | { kind: "company"; value: string }
  | { kind: "month"; value: string }
  | { kind: "status"; value: string };

export type PartyRow = {
  name: string;
  billed: number;
  collected: number;
  due: number;
  pastDue: number;
  efficiency: number;
  records: number;
};

export type TrendPolarity = "higher-is-better" | "lower-is-better" | "neutral";
export type TrendTone = "good" | "bad" | "neutral";
export type AgingBucketId = "0-30" | "31-60" | "61-90" | "90+";

export type AgingBucket = {
  id: AgingBucketId;
  label: string;
  amount: number;
  count: number;
};

export type AgingSummary = {
  supported: boolean;
  buckets: AgingBucket[];
  notYetDueAmount: number;
  notYetDueCount: number;
  missingDueDateAmount: number;
  missingDueDateCount: number;
};

export const AGING_BUCKETS: Array<{ id: AgingBucketId; label: string }> = [
  { id: "0-30", label: "0–30 days" },
  { id: "31-60", label: "31–60 days" },
  { id: "61-90", label: "61–90 days" },
  { id: "90+", label: "Over 90 days" },
];

export function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatInr(value: number, compact = false) {
  const amount = toNumber(value);

  if (!compact) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  const absolute = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (absolute >= 1_00_00_000) {
    return `${sign}₹${(absolute / 1_00_00_000).toFixed(2)} Cr`;
  }

  if (absolute >= 1_00_000) {
    return `${sign}₹${(absolute / 1_00_000).toFixed(2)} L`;
  }

  return formatInr(amount, false);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    toNumber(value),
  );
}

export function formatPercent(value: number) {
  return `${toNumber(value).toFixed(2)}%`;
}

/** Stored collected amounts are exclusive of GST. */
export const GST_RATE = 0.18;

export function amountWithGst(amount: number) {
  return Math.round((toNumber(amount) * (1 + GST_RATE) + Number.EPSILON) * 100) / 100;
}

export function percentDelta(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function ratePointDelta(current: number, previous: number, previousBase: number) {
  if (previousBase <= 0) return null;
  return current - previous;
}

export function trendTone(delta: number | null, polarity: TrendPolarity): TrendTone {
  if (delta == null || delta === 0 || polarity === "neutral") return "neutral";
  const rising = delta > 0;
  if (polarity === "higher-is-better") return rising ? "good" : "bad";
  return rising ? "bad" : "good";
}

export function emptyAging(): AgingSummary {
  return {
    supported: false,
    buckets: AGING_BUCKETS.map((bucket) => ({ ...bucket, amount: 0, count: 0 })),
    notYetDueAmount: 0,
    notYetDueCount: 0,
    missingDueDateAmount: 0,
    missingDueDateCount: 0,
  };
}

export function agingBucketForDaysPastDue(daysPastDue: number): AgingBucketId | null {
  if (daysPastDue < 1) return null;
  if (daysPastDue <= 30) return "0-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

export function collectionSlices(collected: number, outstanding: number, pastDue: number) {
  if (pastDue > outstanding + 1) return null;

  const overdue = Math.min(Math.max(pastDue, 0), Math.max(outstanding, 0));
  const pending = Math.max(outstanding - overdue, 0);

  return [
    { name: "Collected", value: Math.max(collected, 0) },
    { name: "Pending", value: pending },
    { name: "Overdue", value: overdue },
  ];
}

export type StatusTone = "bad" | "warn" | "good";

export function efficiencyTone(value: number): StatusTone {
  if (value < 50) return "bad";
  if (value <= 80) return "warn";
  return "good";
}

export function efficiencyLabel(value: number) {
  const tone = efficiencyTone(value);
  if (tone === "bad") return "Below 50%";
  if (tone === "warn") return "50–80%";
  return "Above 80%";
}

export function sumRecords(records: RevenueRecord[]) {
  return records.reduce(
    (totals, record) => {
      totals.billed += toNumber(record.amount);
      totals.collected += toNumber(record.collectedAmount);
      totals.due += toNumber(record.overdueAmount);
      totals.pastDue += toNumber(record.pastDueAmount);
      totals.undated += toNumber(record.undatedOutstanding);
      return totals;
    },
    { billed: 0, collected: 0, due: 0, pastDue: 0, undated: 0 },
  );
}

export function efficiencyOf(collected: number, billed: number) {
  if (billed <= 0) return 0;
  return Number(((collected / billed) * 100).toFixed(2));
}

export function applyRecordFilters(
  records: RevenueRecord[],
  status: string,
  crossFilter: CrossFilter | null,
) {
  const statuses = filterTokens(status);
  return records.filter((record) => {
    if (statuses.length > 0 && !statuses.includes(record.status || "Unknown")) return false;
    if (!crossFilter || crossFilter.kind === "month") return true;
    if (crossFilter.kind === "customer") {
      return (record.customerName || "Unknown") === crossFilter.value;
    }
    if (crossFilter.kind === "company") {
      return (record.companyName || "Unknown") === crossFilter.value;
    }
    return (record.status || "Unknown") === crossFilter.value;
  });
}

export function groupByParty(
  records: RevenueRecord[],
  key: "customerName" | "companyName",
): PartyRow[] {
  const groups = new Map<string, PartyRow>();

  for (const record of records) {
    const name = record[key]?.trim() || "Unknown";
    const current = groups.get(name) ?? {
      name,
      billed: 0,
      collected: 0,
      due: 0,
      pastDue: 0,
      efficiency: 0,
      records: 0,
    };
    current.billed += toNumber(record.amount);
    current.collected += toNumber(record.collectedAmount);
    current.due += toNumber(record.overdueAmount);
    current.pastDue += toNumber(record.pastDueAmount);
    current.records += 1;
    groups.set(name, current);
  }

  return [...groups.values()]
    .map((row) => ({
      ...row,
      efficiency: efficiencyOf(row.collected, row.billed),
    }))
    .sort((left, right) => right.billed - left.billed);
}

export function topParties(rows: PartyRow[], key: "billed" | "due", limit = 5) {
  return [...rows].sort((left, right) => right[key] - left[key]).slice(0, limit);
}

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const MISSING_AGING_FIELDS = [
  "invoice due date",
  "payment received date",
  "invoice number on each billing row",
];
