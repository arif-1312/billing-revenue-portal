"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { AgingSummary } from "@/lib/revenue-metrics";
import type {
  BillingInvoiceLine,
  BillingOverviewMetrics,
  CreditNoteDashboardSummary,
  DashboardKpiDetailRecord,
} from "@/lib/actions/dashboard";
import {
  formatCount,
  formatInr,
  formatPercent,
  downloadCsv,
  groupByParty,
  toNumber,
  topParties,
  type CrossFilter,
  type MonthPoint,
  type PartyRow,
  type RevenueRecord,
  type TrendTone,
} from "@/lib/revenue-metrics";

import { ChartCard } from "./chart-card";
import { FyBadge, FyLabelProvider } from "./fy-badge";
import { PoRenewalTable } from "./po-renewal-table";
import { DataTable } from "./data-table";
import { HoverAmount, KpiCard, type KpiDetailKey } from "./kpi-card";
import { StatusBadge } from "./status-badge";

const chartConfig = {
  billing: { label: "Billed amount without GST", color: "#1976D2" },
  mrr: { label: "MRR", color: "#1976D2" },
  payment: { label: "Collected amount without GST", color: "#15966A" },
  outstanding: { label: "Outstanding amount without GST", color: "#E69A23" },
  overdue: { label: "Overdue", color: "#DC4545" },
  pending: { label: "Pending", color: "#E69A23" },
} satisfies ChartConfig;

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const collectionEfficiencyConfig = {
  efficiency: { label: "Monthly collection-to-billing ratio", color: "#15966A" },
} satisfies ChartConfig;

const sliceColor: Record<string, string> = {
  Collected: "#15966A",
  Pending: "#E69A23",
  Outstanding: "#E69A23",
  Overdue: "#DC4545",
};

function displayPartyName(name?: string | null) {
  const value = name?.trim();
  if (!value || value === "-") return "Unassigned";
  return value;
}

function fiscalMonthLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "short",
  }).format(date);
}

function namedRows(rows: PartyRow[]) {
  return rows.map((row) => ({
    ...row,
    rawName: row.name,
    name: displayPartyName(row.name),
  }));
}

const axisTick = { fill: "#64748B", fontSize: 11 };
const tooltipStyle = {
  border: "1px solid #e4e8ee",
  borderRadius: 6,
  fontSize: 12,
  boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
};

type Delta = { text: string; tone: TrendTone };

export function OverviewView({
  billed,
  netBilled,
  collected,
  outstanding,
  notYetDue,
  overdue,
  collectionEfficiency,
  overdueInvoiceCount,
  collectionEfficiencyAvailable,
  netBilledAvailable,
  creditNotes,
  creditNoteRecords,
  creditNotesError,
  partial,
  projected,
  dueForBilling,
  billingOverview,
  deltas,
  slices,
  collectionStatusTotal,
  monthly,
  recordRows,
  invoiceLines,
  onKpiClick,
  loading,
  error,
  focusMonths,
  onMonth,
  onCrossFilter,
}: {
  billed: number;
  netBilled: number;
  collected: number;
  outstanding: number;
  notYetDue: number;
  overdue: number | null;
  collectionEfficiency: number;
  overdueInvoiceCount: number;
  collectionEfficiencyAvailable: boolean;
  netBilledAvailable: boolean;
  creditNotes: CreditNoteDashboardSummary | null;
  creditNoteRecords: DashboardKpiDetailRecord[];
  creditNotesError: boolean;
  partial: number;
  projected: number;
  dueForBilling: number;
  billingOverview: BillingOverviewMetrics | null;
  deltas: Record<"planned" | "billed" | "billingDone" | "billingAchievement" | "creditNotes" | "netBilled" | "collected" | "outstanding" | "notYetDue" | "overdue" | "efficiency", Delta>;
  slices: Array<{ name: string; value: number }>;
  collectionStatusTotal: number;
  monthly: MonthPoint[];
  recordRows: RevenueRecord[];
  invoiceLines: BillingInvoiceLine[];
  onKpiClick: (key: KpiDetailKey) => void;
  loading: boolean;
  error: string | null;
  focusMonths: string[];
  onMonth: (month: string) => void;
  onCrossFilter: (filter: CrossFilter) => void;
}) {
  const mrrFillId = `mrr-fill-${useId().replace(/:/g, "")}`;
  const [activeCollectionDetail, setActiveCollectionDetail] = useState<"overdue" | "upcoming" | "aging" | null>(null);
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string | null>(null);
  const [followUpMode, setFollowUpMode] = useState<"overdue" | "upcoming">("overdue");
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [followUpSort, setFollowUpSort] = useState<"dueDate" | "outstanding" | "age">("dueDate");
  const [followUpPage, setFollowUpPage] = useState(1);
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);
  const billedByMonth = new Map<string, number>();
  for (const line of invoiceLines) {
    billedByMonth.set(
      line.month,
      (billedByMonth.get(line.month) ?? 0) + line.billed,
    );
  }
  const mrrMonths =
    focusMonths.length > 0
      ? monthly.filter((point) => focusMonths.includes(point.month))
      : monthly;
  const mrrRows = mrrMonths.map((point) => ({
    month: point.month,
    MRR: billedByMonth.get(point.month) ?? 0,
  }));
  const planByMonth = new Map<string, number>();
  for (const plan of billingOverview?.plannedRecords ?? []) {
    const month = fiscalMonthLabel(plan.scheduledDate);
    if (month && months.includes(month)) {
      planByMonth.set(month, (planByMonth.get(month) ?? 0) + plan.amount);
    }
  }
  const creditNotesByMonth = new Map<string, number>();
  for (const note of creditNoteRecords) {
    const month = fiscalMonthLabel(note.recordDate);
    if (month && months.includes(month)) {
      creditNotesByMonth.set(month, (creditNotesByMonth.get(month) ?? 0) + note.amount);
    }
  }
  const billingAnalyticsRows = monthly
    .filter((point) => focusMonths.length === 0 || focusMonths.includes(point.month))
    .map((point) => {
      const planned = planByMonth.get(point.month) ?? 0;
      const actual = invoiceLines
        .filter((line) => line.month === point.month)
        .reduce((total, line) => total + line.billed, 0);
      return {
        month: point.month,
        Planned: planned,
        "Actual billed": actual,
        "Billing achievement": planned > 0 ? Number(((actual / planned) * 100).toFixed(2)) : null,
        "Credit notes": creditNotesByMonth.get(point.month) ?? 0,
      };
    });
  const billingStatusTotals = new Map<string, { amount: number; invoices: Set<string> }>();
  for (const line of invoiceLines) {
    const status = line.status || "Unknown";
    const current = billingStatusTotals.get(status) ?? { amount: 0, invoices: new Set<string>() };
    current.amount += line.billed;
    if (line.invoiceNumber && line.invoiceNumber !== "-") current.invoices.add(line.invoiceIdentity);
    billingStatusTotals.set(status, current);
  }
  const billingStatusRows = [...billingStatusTotals].map(([name, value]) => ({
    name,
    value: value.amount,
    invoices: value.invoices.size,
  }));
  const openCollectionSlice = (name: string) => {
    if (name === "Collected") onKpiClick("totalCollected");
    else if (name === "Overdue") onKpiClick("overdueAmount");
    else if (name === "Pending") onKpiClick("pendingCollection");
    else onKpiClick("totalReceivables");
  };
  const monthRows = monthly.map((point) => ({
    month: point.month,
    "Billed amount without GST": point.billing,
    "Collected amount without GST": point.payment,
    "Outstanding amount without GST": invoiceLines
      .filter((line) => line.month === point.month)
      .reduce((total, line) => total + line.notYetDueAmount + line.overdueAmount + line.undatedOutstanding, 0),
  }));
  const companies = topParties(
    groupByParty(recordRows, "companyName"),
    "billed",
    8,
  );
  const customerUndated = new Map<string, number>();
  for (const record of recordRows) {
    const name = record.customerName?.trim() || "Unknown";
    customerUndated.set(
      name,
      (customerUndated.get(name) ?? 0) + toNumber(record.undatedOutstanding),
    );
  }
  const customerExposure = groupByParty(recordRows, "customerName").map((row) => ({
    ...row,
    due: row.due + row.pastDue + (customerUndated.get(row.name) ?? 0),
  }));
  const customers = topParties(customerExposure, "due", 10);
  const overdueCompanies = groupByParty(recordRows, "companyName")
    .filter((row) => row.pastDue > 0)
    .sort((left, right) => right.pastDue - left.pastDue)
    .slice(0, 10);
  const companyRows = companies.map((row) => ({
    Company: displayPartyName(row.name),
    "Billed amount without GST": row.billed,
    "Collected amount without GST": row.collected,
  }));
  const customerCompanies = new Map<string, Set<string>>();
  const customerOverdueInvoiceIds = new Map<string, Set<string>>();
  for (const record of recordRows) {
    const customer = record.customerName?.trim() || "Unknown";
    const company = record.companyName?.trim();
    if (company && company !== "-") {
      const names = customerCompanies.get(customer) ?? new Set<string>();
      names.add(company);
      customerCompanies.set(customer, names);
    }
  }
  for (const line of invoiceLines) {
    if (line.overdueAmount <= 0 || !line.invoiceNumber || line.invoiceNumber === "-") continue;
    const customer = line.customerName?.trim() || "Unknown";
    const invoiceIds = customerOverdueInvoiceIds.get(customer) ?? new Set<string>();
    invoiceIds.add(line.invoiceIdentity || `${line.companyName}|${line.invoiceNumber}|${line.invoiceDate ?? ""}`);
    customerOverdueInvoiceIds.set(customer, invoiceIds);
  }
  const customerRows = customers.map((row) => ({
    Customer: displayPartyName(row.name),
    Company: [...(customerCompanies.get(row.name) ?? [])].join(", ") || "Unassigned",
    "Total outstanding": row.due,
    "Overdue amount": row.pastDue,
    "Overdue invoices": customerOverdueInvoiceIds.get(row.name)?.size ?? 0,
  }));
  const overdueCompanyRows = overdueCompanies.map((row) => ({
    Company: displayPartyName(row.name),
    "Overdue amount without GST": row.pastDue,
  }));
  const companyUndated = new Map<string, number>();
  for (const record of recordRows) {
    const name = record.companyName?.trim() || "Unknown";
    companyUndated.set(name, (companyUndated.get(name) ?? 0) + toNumber(record.undatedOutstanding));
  }
  const outstandingCompanies = groupByParty(recordRows, "companyName")
    .map((row) => ({
      ...row,
      due: row.due + row.pastDue + (companyUndated.get(row.name) ?? 0),
    }))
    .filter((row) => row.due > 0)
    .sort((left, right) => right.due - left.due)
    .slice(0, 10);
  const outstandingCompanyRows = outstandingCompanies.map((row) => ({
    Company: displayPartyName(row.name),
    "Outstanding amount without GST": row.due,
    "Overdue amount without GST": row.pastDue,
  }));
  const todayDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dateValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };
  const todayTimestamp = Date.parse(`${todayDate}T00:00:00Z`);
  const invoiceBalances = new Map<string, {
    identity: string;
    invoiceNumber: string;
    customerName: string;
    companyName: string;
    dueDate: string;
    outstanding: number;
    paymentStatus: string;
  }>();
  for (const line of invoiceLines) {
    if (!line.invoiceNumber || line.invoiceNumber === "-" || !line.invoiceDate) continue;
    const status = `${line.status} ${line.paymentStatus} ${line.paymentReceived}`.toLowerCase();
    if (status.includes("cancel")) continue;
    const outstanding = line.notYetDueAmount + line.overdueAmount + line.undatedOutstanding;
    if (outstanding <= 0) continue;
    const dueDate = dateValue(line.dueDate ?? "");
    const identity = line.invoiceIdentity || `${line.companyName}|${line.invoiceNumber}|${line.invoiceDate}`;
    const current = invoiceBalances.get(identity) ?? {
      identity,
      invoiceNumber: line.invoiceNumber,
      customerName: line.customerName?.trim() || "Unknown",
      companyName: line.companyName?.trim() || "-",
      dueDate,
      outstanding: 0,
      paymentStatus: line.paymentStatus,
    };
    if (dueDate && (!current.dueDate || dueDate < current.dueDate)) current.dueDate = dueDate;
    current.outstanding += outstanding;
    invoiceBalances.set(identity, current);
  }
  const distinctInvoices = [...invoiceBalances.values()].filter((invoice) => invoice.outstanding > 0);
  const overdueInvoices = distinctInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate <= todayDate);
  const overdueAmount = overdueInvoices.reduce((total, invoice) => total + invoice.outstanding, 0);
  const overdueCustomers = new Map<string, {
    amount: number;
    invoiceCount: number;
    companies: Map<string, number>;
  }>();
  for (const invoice of overdueInvoices) {
    const customer = overdueCustomers.get(invoice.customerName) ?? {
      amount: 0,
      invoiceCount: 0,
      companies: new Map<string, number>(),
    };
    customer.amount += invoice.outstanding;
    customer.invoiceCount += 1;
    customer.companies.set(invoice.companyName, (customer.companies.get(invoice.companyName) ?? 0) + invoice.outstanding);
    overdueCustomers.set(invoice.customerName, customer);
  }
  const topOverdueCustomer = [...overdueCustomers]
    .map(([name, details]) => ({ name, ...details }))
    .sort((left, right) => right.amount - left.amount)[0] ?? null;
  const upcomingInvoices = distinctInvoices.filter((invoice) => {
    const dueTimestamp = Date.parse(`${invoice.dueDate}T00:00:00Z`);
    return invoice.dueDate > todayDate && dueTimestamp <= todayTimestamp + 30 * 86_400_000;
  });
  const upcomingAmount = upcomingInvoices.reduce((total, invoice) => total + invoice.outstanding, 0);
  const upcomingCustomers = new Set(upcomingInvoices.map((invoice) => invoice.customerName));
  const nearestUpcomingDate = upcomingInvoices
    .map((invoice) => invoice.dueDate)
    .sort()[0] ?? null;
  const agingBuckets = [
    { label: "Not Due", amount: 0, invoices: 0, color: "#1976D2" },
    { label: "0–15 Days", amount: 0, invoices: 0, color: "#D99520" },
    { label: "16–30 Days", amount: 0, invoices: 0, color: "#E69A23" },
    { label: "31–45 Days", amount: 0, invoices: 0, color: "#C66A1B" },
    { label: "Above 45 Days", amount: 0, invoices: 0, color: "#DC4545" },
    { label: "No Due Date", amount: 0, invoices: 0, color: "#94A3B8" },
  ];
  const agingByLabel = new Map(agingBuckets.map((bucket) => [bucket.label, bucket]));
  for (const invoice of distinctInvoices) {
    let label = "No Due Date";
    if (invoice.dueDate) {
      const daysLate = Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000);
      label = daysLate < 0 ? "Not Due" : daysLate <= 15 ? "0–15 Days" : daysLate <= 30 ? "16–30 Days" : daysLate <= 45 ? "31–45 Days" : "Above 45 Days";
    }
    const bucket = agingByLabel.get(label)!;
    bucket.amount += invoice.outstanding;
    bucket.invoices += 1;
  }
  const totalInvoiceOutstanding = distinctInvoices.reduce((total, invoice) => total + invoice.outstanding, 0);
  const customerOutstanding = new Map<string, {
    amount: number;
    overdue: number;
    invoices: number;
    overdueInvoices: number;
    oldestOverdueDays: number;
    companies: Map<string, number>;
  }>();
  const companyOutstanding = new Map<string, number>();
  for (const invoice of distinctInvoices) {
    const isOverdue = Boolean(invoice.dueDate && invoice.dueDate <= todayDate);
    const age = isOverdue ? Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000) : 0;
    const customer = customerOutstanding.get(invoice.customerName) ?? {
      amount: 0, overdue: 0, invoices: 0, overdueInvoices: 0, oldestOverdueDays: 0, companies: new Map<string, number>(),
    };
    customer.amount += invoice.outstanding;
    customer.invoices += 1;
    if (isOverdue) {
      customer.overdue += invoice.outstanding;
      customer.overdueInvoices += 1;
      customer.oldestOverdueDays = Math.max(customer.oldestOverdueDays, age);
    }
    customer.companies.set(invoice.companyName, (customer.companies.get(invoice.companyName) ?? 0) + invoice.outstanding);
    customerOutstanding.set(invoice.customerName, customer);
    companyOutstanding.set(invoice.companyName, (companyOutstanding.get(invoice.companyName) ?? 0) + invoice.outstanding);
  }
  const topOutstandingCustomers = [...customerOutstanding]
    .map(([name, detail]) => ({ name, ...detail, company: [...detail.companies].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "-" }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);
  const collectionStatusRows = [
    { name: "Collected", value: Math.max(collected, 0), color: "#15966A" },
    { name: "Pending", value: Math.max(totalInvoiceOutstanding - overdueAmount, 0), color: "#E69A23" },
    { name: "Overdue", value: overdueAmount, color: "#DC4545" },
  ];
  const collectionChartTotal = collectionStatusRows.reduce((total, item) => total + item.value, 0);
  const companyCollectionRows = groupByParty(recordRows, "companyName").map((row) => {
    const due = companyOutstanding.get(row.name) ?? 0;
    return { name: displayPartyName(row.name), rawName: row.name, billed: row.billed, collected: row.collected, outstanding: due, efficiency: row.billed > 0 ? row.collected / row.billed * 100 : null };
  }).sort((left, right) => right.outstanding - left.outstanding).slice(0, 10);
  const formatCollectionDate = (value: string) => {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };
  const selectedCollectionInvoices = activeCollectionDetail === "overdue"
    ? overdueInvoices
    : activeCollectionDetail === "upcoming"
      ? upcomingInvoices
      : activeCollectionDetail === "aging" && selectedAgingBucket
        ? distinctInvoices.filter((invoice) => {
          const bucket = agingBuckets.find((item) => item.label === selectedAgingBucket);
          if (!bucket) return false;
          if (!invoice.dueDate) return selectedAgingBucket === "No Due Date";
          const daysLate = Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000);
          const label = daysLate < 0 ? "Not Due" : daysLate <= 15 ? "0–15 Days" : daysLate <= 30 ? "16–30 Days" : daysLate <= 45 ? "31–45 Days" : "Above 45 Days";
          return label === selectedAgingBucket;
        })
        : [];
  const followUpInvoices = followUpMode === "overdue" ? overdueInvoices : upcomingInvoices;
  const filteredFollowUps = followUpInvoices.filter((invoice) =>
    [invoice.invoiceNumber, invoice.customerName, invoice.companyName]
      .some((value) => value.toLocaleLowerCase().includes(followUpQuery.trim().toLocaleLowerCase())),
  ).sort((left, right) => followUpSort === "outstanding"
    ? right.outstanding - left.outstanding
    : followUpSort === "age"
      ? Date.parse(`${left.dueDate}T00:00:00Z`) - Date.parse(`${right.dueDate}T00:00:00Z`)
      : left.dueDate.localeCompare(right.dueDate));
  const followUpPageCount = Math.max(1, Math.ceil(filteredFollowUps.length / 8));
  const displayedFollowUps = filteredFollowUps.slice((Math.min(followUpPage, followUpPageCount) - 1) * 8, Math.min(followUpPage, followUpPageCount) * 8);
  const monthlyEfficiency = monthly.map((point) => ({
    month: point.month,
    efficiency: point.billing > 0 ? Number(((point.payment / point.billing) * 100).toFixed(2)) : null,
  }));

  return (
    <div className="space-y-3">
      <section aria-labelledby="billing-overview-heading" className="space-y-2">
        <h2
          id="billing-overview-heading"
          className="border-l-2 border-[#1976D2] pl-2 text-xs font-semibold tracking-wide text-[#1976D2]"
        >
          BILLING OVERVIEW
        </h2>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {/* Planned Billing - Blue */}
          <KpiCard
            label="Planned Billing (without GST)"
            detailKey="plannedBilling"
            onOpenDetails={onKpiClick}
            value={billingOverview?.plannedBilling ?? 0}
            unavailable={billingOverview?.plannedBilling == null}
            hint="Sum actual billing-cycle schedule amounts dated in the selected FY and filters. When a PO has no cycles, its amount is allocated across derived plan cycles only when the plan frequency, amount, and duration are available. PO GST treatment is not stored; the dashboard treats PO amounts as GST-exclusive."
            accent="billing"
            deltaText={deltas.planned.text}
            deltaTone={deltas.planned.tone}
          />

          {/* Billed Amount - Cyan Blue */}
          <KpiCard
            label="Billed Amount (without GST)"
            detailKey="billedAmount"
            onOpenDetails={onKpiClick}
            value={billed}
            hint="Sum of invoice amounts from billing cycles matching the current invoice date, company, customer, status, and cross-filter selection."
            accent="billing"
            deltaText={deltas.billed.text}
            deltaTone={deltas.billed.tone}
          />

          {/* Credit Notes - Purple */}
          <KpiCard
            label="Credit Note Amount"
            detailKey="creditNoteAmount"
            onOpenDetails={onKpiClick}
            value={creditNotes?.amount ?? 0}
            unavailable={!creditNotes || creditNotesError}
            hint="Credit notes dated in the selected period. Customer names are matched to customer records; company and billing status selections use those customers' purchase orders. Each note is counted once, even when several orders match. The credit note schema has no GST-treatment field; Net Billed keeps the existing subtraction basis."
            accent="billing"
            deltaText={deltas.creditNotes.text}
            deltaTone={deltas.creditNotes.tone}
          />

          {/* Net Billed - Indigo */}
          <KpiCard
            label="Net Billed Amount"
            detailKey="netBilledAmount"
            onOpenDetails={onKpiClick}
            value={netBilled}
            unavailable={!netBilledAvailable}
            hint="Existing calculation: invoice amounts before GST minus the credit-note register amount for the selected period. The credit-note table does not record GST treatment."
            accent="billing"
            deltaText={deltas.netBilled.text}
            deltaTone={deltas.netBilled.tone}
          />

          {/* Billing Done Including GST - Teal */}
          <KpiCard
            label="Billing Done (Including GST)"
            detailKey="billingDone"
            onOpenDetails={onKpiClick}
            value={billingOverview?.billingDoneWithGst ?? 0}
            unavailable={billingOverview?.billingDoneWithGst == null}
            hint={`BillingCycle is the existing invoice record: rows with an invoice number and invoice date are counted once per company, invoice number, and date. Invoice amount is treated as GST-exclusive using the existing dashboard ${(1 + (billingOverview?.gstRate ?? 0.18)).toFixed(2)} GST multiplier. The schema has no draft, void, or cancelled-invoice flag.`}
            accent="billing"
            deltaText={deltas.billingDone.text}
            deltaTone={deltas.billingDone.tone}
          />

          {/* Billing Achievement - Green */}
          <KpiCard
            label="Billing Achievement"
            detailKey="billingAchievement"
            onOpenDetails={onKpiClick}
            value={billingOverview?.billingAchievement ?? 0}
            mode="percent"
            unavailable={billingOverview?.billingAchievement == null}
            hint="Billing Done is normalized to GST-exclusive invoice amounts before comparison with the GST-exclusive PO plan. A result over 100% is retained and flagged as above plan."
            accent="billing"
            deltaText={`${billingOverview?.billingAchievementAbovePlan ? "Above plan · " : ""}${deltas.billingAchievement.text}`}
            deltaTone={deltas.billingAchievement.tone}
          />
        </div>
      </section>
      
      <section
        aria-labelledby="collection-overview-heading"
        className="space-y-2"
      >
        <h2
          id="collection-overview-heading"
          className="border-l-2 border-[#15966A] pl-2 text-xs font-semibold tracking-wide text-[#15966A]"
        >
          COLLECTION OVERVIEW
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Collected (without GST)"
            detailKey="totalCollected"
            onOpenDetails={onKpiClick}
            value={collected}
            hint="Sum of payment ledger receipts before GST in the current filters. The with-GST figure adds the existing 18% GST display rate."
            accent="collected"
            deltaText={deltas.collected.text}
            deltaTone={deltas.collected.tone}
          />
          <KpiCard
            label="Total Receivables (without GST)"
            detailKey="totalReceivables"
            onOpenDetails={onKpiClick}
            value={outstanding}
            hint="Not yet due plus overdue plus unpaid balances without a due date, using the existing invoice balance calculation."
            accent="receivables"
            deltaText={deltas.outstanding.text}
            deltaTone={deltas.outstanding.tone}
          />
          <KpiCard
            label="Outstanding Amount (without GST)"
            detailKey="notYetDue"
            onOpenDetails={onKpiClick}
            value={notYetDue}
            hint="Unpaid invoice balances with a due date that has not passed."
            accent="notDue"
            deltaText={deltas.notYetDue.text}
            deltaTone={deltas.notYetDue.tone}
          />
          <KpiCard
            label="Overdue Amount (without GST)"
            detailKey="overdueAmount"
            onOpenDetails={onKpiClick}
            value={overdue ?? 0}
            unavailable={overdue == null}
            hint="Invoices with payment received status No whose payment due date is today or earlier."
            accent="overdue"
            deltaText={deltas.overdue.text}
            deltaTone={deltas.overdue.tone}
          />
          <KpiCard
            label="Collection Efficiency"
            detailKey="collectionEfficiency"
            onOpenDetails={onKpiClick}
            value={collectionEfficiency}
            mode="percent"
            unavailable={!collectionEfficiencyAvailable}
            hint="Current-period collections before GST divided by net billed amount before GST."
            accent="collected"
            deltaText={deltas.efficiency.text}
            deltaTone={deltas.efficiency.tone}
          />
          <KpiCard
            label="Overdue Invoice Count"
            detailKey="overdueInvoiceCount"
            onOpenDetails={onKpiClick}
            value={overdueInvoiceCount}
            mode="number"
            hint="Distinct actual invoices with a due date before today and a positive outstanding balance. Fully paid invoices are excluded."
            accent="overdue"
            deltaText="Distinct unpaid invoices"
            deltaTone="bad"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SecondaryStat
          label="Total revenue projected without GST"
          value={projected}
          hint="All invoiced amounts before GST, minus credit notes dated in the selected financial year. Month, quarter, and date filters do not reduce this total."
        />
        <SecondaryStat
          label="Due for billing till now"
          value={dueForBilling}
          hint="Cycles that do not yet have an invoice number."
        />
      </div>

      <section className="space-y-3">
        <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
          <ChartCard title="Receivables Aging Analysis" description="Outstanding invoice balances by age. Percentages use total outstanding invoice balances, including a separate no-due-date bucket." filename="receivables-aging-analysis.csv" rows={agingBuckets.map((bucket) => ({ Bucket: bucket.label, Invoices: bucket.invoices, "Outstanding without GST": bucket.amount, "Share of outstanding %": totalInvoiceOutstanding > 0 ? Number((bucket.amount / totalInvoiceOutstanding * 100).toFixed(2)) : 0 }))} loading={loading} error={error} empty={distinctInvoices.length === 0}>
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
                <BarChart data={agingBuckets} layout="vertical" margin={{ left: 4, right: 12 }} onClick={(state) => { if (state?.activeLabel) { setSelectedAgingBucket(String(state.activeLabel)); setActiveCollectionDetail("aging"); } }} style={{ cursor: "pointer" }}>
                  <CartesianGrid horizontal={false} stroke="#eef1f4"/><XAxis type="number" tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick}/><YAxis type="category" dataKey="label" width={100} tickLine={false} axisLine={false} tick={axisTick}/><Tooltip formatter={(value, name, item) => name === "amount" ? [formatInr(Number(value)), `${item.payload.invoices} invoices`] : value} contentStyle={tooltipStyle}/><Bar dataKey="amount" name="Outstanding without GST" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false}>{agingBuckets.map((bucket) => <Cell key={bucket.label} fill={bucket.color} cursor="pointer" onClick={() => { setSelectedAgingBucket(bucket.label); setActiveCollectionDetail("aging"); }}/>)}</Bar>
                </BarChart>
              </ChartContainer>
              <div className="space-y-2">
                {agingBuckets.map((bucket) => <button type="button" key={bucket.label} onClick={() => { setSelectedAgingBucket(bucket.label); setActiveCollectionDetail("aging"); }} className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left hover:bg-[#F8FAFC]" title={`${bucket.label}: ${formatInr(bucket.amount)}, ${bucket.invoices} invoices`}><span className="flex min-w-0 items-center gap-1.5 text-[10px] text-[#64748B]"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: bucket.color }}/><span className="truncate">{bucket.label}</span></span><span className="shrink-0 text-right"><span className="block font-mono text-[10px] font-medium tabular-nums text-[#17365D]">{formatInr(bucket.amount, true)}</span><span className="text-[9px] text-[#64748B]">{totalInvoiceOutstanding > 0 ? formatPercent(bucket.amount / totalInvoiceOutstanding * 100) : "0.00%"} · {bucket.invoices}</span></span></button>)}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Collection Status Distribution" description="Collected, pending and overdue values use the current dashboard selection. Pending and overdue are mutually exclusive outstanding balances." filename="collection-status-distribution.csv" rows={collectionStatusRows.map((row) => ({ Status: row.name, Amount: row.value, "Share %": collectionChartTotal > 0 ? Number((row.value / collectionChartTotal * 100).toFixed(2)) : 0 }))} loading={loading} error={error} empty={collectionChartTotal === 0}>
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="relative mx-auto h-60 w-full max-w-[22rem]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart><Pie data={collectionStatusRows} dataKey="value" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false} onClick={(item) => { if (item.name === "Collected") onKpiClick("totalCollected"); else if (item.name === "Pending") onKpiClick("pendingCollection"); else setActiveCollectionDetail("overdue"); }} style={{ cursor: "pointer" }}>{collectionStatusRows.map((row) => <Cell key={row.name} fill={row.color}/>)}</Pie><Tooltip formatter={(value, name) => [`${formatInr(Number(value))} (${collectionChartTotal > 0 ? formatPercent(Number(value) / collectionChartTotal * 100) : "0.00%"})`, name]} contentStyle={tooltipStyle}/></PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] text-[#64748B]">Total position</span><strong className="max-w-[90%] truncate font-mono text-sm font-semibold tabular-nums text-[#17365D]">{formatInr(collectionChartTotal, true)}</strong></div>
              </div>
              <div className="space-y-2">{collectionStatusRows.map((row) => <button key={row.name} type="button" onClick={() => row.name === "Collected" ? onKpiClick("totalCollected") : row.name === "Pending" ? onKpiClick("pendingCollection") : setActiveCollectionDetail("overdue")} className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-[#F8FAFC]"><span className="flex items-center gap-2 text-xs text-[#64748B]"><span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }}/>{row.name}</span><span className="text-right"><span className="block font-mono text-xs font-semibold tabular-nums text-[#17365D]">{formatInr(row.value, true)}</span><span className="text-[10px] text-[#64748B]">{collectionChartTotal > 0 ? formatPercent(row.value / collectionChartTotal * 100) : "0.00%"}</span></span></button>)}</div>
            </div>
          </ChartCard>
        </div>

        {activeCollectionDetail ? (
          <div id="collection-priority-details" className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#17365D]">{activeCollectionDetail === "overdue" ? "Overdue invoice details" : activeCollectionDetail === "aging" ? `${selectedAgingBucket ?? "Aging"} invoice details` : "Upcoming collection details"}</h3><p className="mt-0.5 text-xs text-[#64748B]">{formatCount(selectedCollectionInvoices.length)} distinct invoices · dashboard filters applied</p></div><button type="button" onClick={() => setActiveCollectionDetail(null)} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F1F4F8] hover:text-[#17365D]">Close</button></div>
            {selectedCollectionInvoices.length ? <div className="max-h-72 overflow-auto"><table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="px-4 py-2.5 font-semibold">Invoice</th><th className="px-4 py-2.5 font-semibold">Customer</th><th className="px-4 py-2.5 font-semibold">Company</th><th className="px-4 py-2.5 font-semibold">Due date</th><th className="px-4 py-2.5 text-right font-semibold">Outstanding</th></tr></thead><tbody className="divide-y divide-[#F1F4F8]">{selectedCollectionInvoices.map((invoice) => <tr key={invoice.identity} className="text-[#17365D]"><td className="whitespace-nowrap px-4 py-2.5 font-medium">{invoice.invoiceNumber}</td><td className="max-w-52 truncate px-4 py-2.5" title={invoice.customerName}>{invoice.customerName}</td><td className="max-w-52 truncate px-4 py-2.5" title={invoice.companyName}>{invoice.companyName}</td><td className="whitespace-nowrap px-4 py-2.5">{formatCollectionDate(invoice.dueDate)}{invoice.dueDate ? <span className="text-[#64748B]"> · {invoice.dueDate < todayDate ? `${Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000)} days overdue` : `${Math.floor((Date.parse(`${invoice.dueDate}T00:00:00Z`) - todayTimestamp) / 86_400_000)} days`}</span> : null}</td><td className="whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums">{formatInr(invoice.outstanding)}</td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-[#64748B]">No matching invoices for the current dashboard filters.</p>}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
          <ChartCard title="Top 10 Outstanding Customers" description="Customer balances after partial payments. Click a row to open its outstanding invoice details." filename="top-outstanding-customers.csv" rows={topOutstandingCustomers.map((customer) => ({ Customer: customer.name, Company: customer.company, "Total outstanding": customer.amount, Overdue: customer.overdue, "Unpaid invoices": customer.invoices, "Oldest overdue days": customer.oldestOverdueDays }))} loading={loading} error={error} empty={topOutstandingCustomers.length === 0} className="h-full">
            <div className="max-h-80 overflow-auto"><table className="w-full min-w-[660px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="px-3 py-2.5 font-semibold">Customer</th><th className="px-3 py-2.5 font-semibold">Company</th><th className="px-3 py-2.5 text-right font-semibold">Outstanding</th><th className="px-3 py-2.5 text-right font-semibold">Overdue</th><th className="px-3 py-2.5 text-right font-semibold">Invoices</th><th className="px-3 py-2.5 text-right font-semibold">Oldest</th></tr></thead><tbody className="divide-y divide-[#F1F4F8]">{topOutstandingCustomers.map((customer) => <tr key={customer.name} className="text-[#17365D]"><td className="px-3 py-2.5"><button type="button" onClick={() => { onCrossFilter({ kind: "customer", value: customer.name }); onKpiClick("totalReceivables"); }} className="max-w-40 truncate text-left font-medium hover:text-[#1976D2]" title={customer.name}>{customer.name}</button></td><td className="max-w-40 truncate px-3 py-2.5" title={customer.company}>{customer.company}</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{formatInr(customer.amount, true)}</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-[#DC4545]">{formatInr(customer.overdue, true)}</td><td className="px-3 py-2.5 text-right tabular-nums">{customer.invoices}</td><td className="px-3 py-2.5 text-right tabular-nums">{customer.oldestOverdueDays}d</td></tr>)}</tbody></table></div>
          </ChartCard>

          <div className="flex h-full flex-col">
            <ChartCard title="Collection Follow-up & Upcoming Payments" description="Filtered open invoices sorted by due date, outstanding balance, or overdue age." filename="collection-follow-ups.csv" rows={filteredFollowUps.map((invoice) => ({ Customer: invoice.customerName, Company: invoice.companyName, Invoice: invoice.invoiceNumber, "Due date": invoice.dueDate, "Days overdue": invoice.dueDate && invoice.dueDate < todayDate ? Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000) : 0, Outstanding: invoice.outstanding, "Payment status": invoice.paymentStatus }))} loading={loading} error={error} className="flex-1">
              <div className="flex flex-wrap items-center gap-2 pb-2"><div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"><button type="button" onClick={() => { setFollowUpMode("overdue"); setFollowUpPage(1); setShowAllFollowUps(false); }} className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${followUpMode === "overdue" ? "bg-white text-[#DC4545] shadow-sm" : "text-[#64748B]"}`}>Overdue</button><button type="button" onClick={() => { setFollowUpMode("upcoming"); setFollowUpPage(1); setShowAllFollowUps(false); }} className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${followUpMode === "upcoming" ? "bg-white text-[#1976D2] shadow-sm" : "text-[#64748B]"}`}>Upcoming</button></div><input aria-label="Search collection follow-ups" value={followUpQuery} onChange={(event) => { setFollowUpQuery(event.target.value); setFollowUpPage(1); }} placeholder="Search customer or invoice" className="h-8 min-w-36 flex-1 rounded-md border border-[#E2E8F0] px-2 text-xs outline-none focus:ring-2 focus:ring-[#1976D2]/30"/><select aria-label="Sort follow-ups" value={followUpSort} onChange={(event) => setFollowUpSort(event.target.value as "dueDate" | "outstanding" | "age")} className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs text-[#64748B]"><option value="dueDate">Sort: due date</option><option value="outstanding">Sort: amount</option><option value="age">Sort: age</option></select><button type="button" onClick={() => downloadCsv("collection-follow-ups.csv", filteredFollowUps.map((invoice) => ({ Customer: invoice.customerName, Company: invoice.companyName, Invoice: invoice.invoiceNumber, "Due date": invoice.dueDate, Outstanding: invoice.outstanding, "Payment status": invoice.paymentStatus })))} className="h-8 rounded-md border border-[#E2E8F0] px-2.5 text-xs font-medium text-[#17365D] hover:bg-[#F8FAFC]">Export</button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="px-2 py-2 font-semibold">Customer · Invoice</th><th className="px-2 py-2 font-semibold">Due</th><th className="px-2 py-2 text-right font-semibold">Outstanding</th><th className="px-2 py-2 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-[#F1F4F8]">{displayedFollowUps.length === 0 ? <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-[#64748B]">No invoices match this tab and the current filters.</td></tr> : displayedFollowUps.map((invoice) => { const overdueRow = invoice.dueDate < todayDate; const dueToday = invoice.dueDate === todayDate; const partialRow = invoice.paymentStatus === "Partially paid"; const statusLabel = overdueRow ? `Overdue${partialRow ? " · Partially paid" : ""}` : dueToday ? `Due today${partialRow ? " · Partially paid" : ""}` : partialRow ? "Partially paid" : "Upcoming"; return <tr key={invoice.identity} className="text-[#17365D]"><td className="px-2 py-2"><button type="button" onClick={() => { onCrossFilter({ kind: "customer", value: invoice.customerName }); onKpiClick("totalReceivables"); }} className="block max-w-52 truncate text-left font-medium hover:text-[#1976D2]" title={`${invoice.customerName} · ${invoice.invoiceNumber}`}>{invoice.customerName}</button><span className="block truncate text-[10px] text-[#64748B]">{invoice.invoiceNumber}</span></td><td className="whitespace-nowrap px-2 py-2">{formatCollectionDate(invoice.dueDate)} <span className="text-[#64748B]">{dueToday ? "· Due today" : overdueRow ? `· ${Math.floor((todayTimestamp - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86_400_000)}d overdue` : ""}</span></td><td className="whitespace-nowrap px-2 py-2 text-right font-mono tabular-nums">{formatInr(invoice.outstanding, true)}</td><td className="px-2 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${overdueRow ? "bg-[#FDECEC] text-[#DC4545]" : dueToday ? "bg-[#FFF4DE] text-[#B7791F]" : "bg-[#EAF3FF] text-[#1976D2]"}`}>{statusLabel}</span></td></tr>;})}</tbody></table></div>
              <div className="mt-2 flex items-center justify-between border-t border-[#F1F4F8] pt-2"><button type="button" onClick={() => setShowAllFollowUps((value) => !value)} className="text-[10px] font-medium text-[#1976D2]">{showAllFollowUps ? "Show less" : `View all (${filteredFollowUps.length})`}</button>{!showAllFollowUps ? <div className="flex items-center gap-2 text-[10px] text-[#64748B]"><button type="button" disabled={followUpPage <= 1} onClick={() => setFollowUpPage((page) => Math.max(1, page - 1))} className="disabled:opacity-40">Previous</button><span>{Math.min(followUpPage, followUpPageCount)} / {followUpPageCount}</span><button type="button" disabled={followUpPage >= followUpPageCount} onClick={() => setFollowUpPage((page) => Math.min(followUpPageCount, page + 1))} className="disabled:opacity-40">Next</button></div> : null}</div>
            </ChartCard>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          <ChartCard title="Monthly Collection Trend" description="Billed, collected, and outstanding amounts in the selected period. Select a month to filter the dashboard." filename="monthly-collection-trend.csv" rows={monthRows.map((row) => ({ Month: row.month, Billed: row["Billed amount without GST"], Collected: row["Collected amount without GST"], Outstanding: row["Outstanding amount without GST"] }))} loading={loading} error={error} empty={monthRows.every((row) => row["Billed amount without GST"] === 0 && row["Collected amount without GST"] === 0 && row["Outstanding amount without GST"] === 0)}>
            <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full"><ComposedChart data={monthRows} onClick={(state) => { if (state?.activeLabel) onMonth(String(state.activeLabel)); }} style={{ cursor: "pointer" }}><CartesianGrid vertical={false} stroke="#eef1f4"/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick}/><YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72}/><Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle}/><Legend/><Bar dataKey="Billed amount without GST" name="Billed" fill="#1976D2" radius={[2,2,0,0]} maxBarSize={16} isAnimationActive={false}/><Bar dataKey="Collected amount without GST" name="Collected" fill="#15966A" radius={[2,2,0,0]} maxBarSize={16} isAnimationActive={false}/><Line dataKey="Outstanding amount without GST" name="Outstanding" stroke="#E69A23" strokeWidth={2} dot={false} isAnimationActive={false}/></ComposedChart></ChartContainer>
          </ChartCard>
          <ChartCard title="Collection by Company" description="Company collection totals and outstanding exposure from the current dashboard selection." filename="collection-by-company.csv" rows={companyCollectionRows.map((row) => ({ Company: row.name, Billed: row.billed, Collected: row.collected, Outstanding: row.outstanding, "Collection %": row.efficiency == null ? "N/A" : Number(row.efficiency.toFixed(2)) }))} loading={loading} error={error} empty={companyCollectionRows.length === 0}>
            <div className="max-h-60 overflow-auto"><table className="w-full min-w-[480px] border-collapse text-left text-xs"><thead className="sticky top-0 bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"><tr><th className="px-3 py-2.5 font-semibold">Company</th><th className="px-3 py-2.5 text-right font-semibold">Billed</th><th className="px-3 py-2.5 text-right font-semibold">Collected</th><th className="px-3 py-2.5 text-right font-semibold">Outstanding</th><th className="px-3 py-2.5 text-right font-semibold">Collection</th></tr></thead><tbody className="divide-y divide-[#F1F4F8]">{companyCollectionRows.map((row) => <tr key={row.name}><td className="px-3 py-2.5"><button type="button" onClick={() => { onCrossFilter({ kind: "company", value: row.rawName }); onKpiClick("totalReceivables"); }} className="max-w-40 truncate text-left font-medium text-[#17365D] hover:text-[#1976D2]" title={row.name}>{row.name}</button></td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{formatInr(row.billed, true)}</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-[#15966A]">{formatInr(row.collected, true)}</td><td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{formatInr(row.outstanding, true)}</td><td className="px-3 py-2.5 text-right tabular-nums">{row.efficiency == null ? "N/A" : formatPercent(row.efficiency)}</td></tr>)}</tbody></table></div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Highest overdue customer", value: topOverdueCustomer?.name ?? "None", detail: topOverdueCustomer ? formatInr(topOverdueCustomer.amount) : "No overdue balance", tone: "text-[#DC4545]" },
            { label: "Total overdue exposure", value: formatInr(overdueAmount, true), detail: `${formatCount(overdueInvoices.length)} invoices · ${formatCount(overdueCustomers.size)} customers`, tone: "text-[#DC4545]" },
            { label: "Multiple overdue invoices", value: formatCount([...overdueCustomers.values()].filter((customer) => customer.invoiceCount > 1).length), detail: "Customers with more than one overdue invoice", tone: "text-[#E69A23]" },
            { label: "Highest aging category", value: [...agingBuckets].filter((bucket) => bucket.label !== "Not Due" && bucket.label !== "No Due Date" && bucket.amount > 0).sort((left, right) => right.amount - left.amount)[0]?.label ?? "None", detail: "Largest dated overdue balance bucket", tone: "text-[#DC4545]" },
            { label: "Upcoming collections", value: formatInr(upcomingAmount, true), detail: `${formatCount(upcomingInvoices.length)} invoices due within 30 days`, tone: "text-[#1976D2]" },
            { label: "Highest outstanding company", value: companyCollectionRows[0]?.name ?? "None", detail: companyCollectionRows[0] ? formatInr(companyCollectionRows[0].outstanding) : "No outstanding balance", tone: "text-[#17365D]" },
          ].map((insight) => <article key={insight.label} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.035)]"><p className="text-[10px] font-medium text-[#64748B]">{insight.label}</p><p className={`mt-1 truncate text-sm font-semibold ${insight.tone}`} title={insight.value}>{insight.value}</p><p className="mt-1 truncate text-[10px] text-[#64748B]" title={insight.detail}>{insight.detail}</p></article>)}
        </div>
      </section>
      <section aria-labelledby="billing-analytics-heading" className="space-y-2">
        <h2 id="billing-analytics-heading" className="border-l-2 border-[#1976D2] pl-2 text-xs font-semibold tracking-wide text-[#1976D2]">
          BILLING ANALYTICS
        </h2>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ChartCard
            title="Planned vs actual billing"
            description="Monthly planned billing cycles compared with invoiced amounts from actual billing records."
            filename="planned-vs-actual-billing.csv"
            rows={billingAnalyticsRows.map((row) => ({
              Month: row.month,
              Planned: row.Planned,
              "Actual billed": row["Actual billed"],
            }))}
            loading={loading}
            error={error}
            empty={billingAnalyticsRows.every((row) => row.Planned === 0 && row["Actual billed"] === 0)}
          >
            <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
              <BarChart data={billingAnalyticsRows} barGap={2} onClick={(state) => { if (state?.activeLabel) onMonth(String(state.activeLabel)); }} style={{ cursor: "pointer" }}>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
                <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Planned" fill="#93C5FD" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="Actual billed" fill="#1976D2" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard
            title="Credit note and billing achievement trend"
            description="Credit notes by record date alongside monthly actual billing achievement against planned cycles."
            filename="credit-notes-billing-achievement.csv"
            rows={billingAnalyticsRows.map((row) => ({
              Month: row.month,
              "Credit notes": row["Credit notes"],
              "Billing achievement %": row["Billing achievement"] ?? "N/A",
            }))}
            loading={loading}
            error={error}
            empty={billingAnalyticsRows.every((row) => row["Credit notes"] === 0 && row["Billing achievement"] == null)}
          >
            <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
              <ComposedChart data={billingAnalyticsRows} onClick={(state) => { if (state?.activeLabel) onMonth(String(state.activeLabel)); }} style={{ cursor: "pointer" }}>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis yAxisId="amount" tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
                <YAxis yAxisId="percent" orientation="right" tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} tick={axisTick} width={58} />
                <Tooltip formatter={(value, name) => name === "Billing achievement" ? formatPercent(Number(value)) : formatInr(Number(value))} contentStyle={tooltipStyle} />
                <Legend />
                <Bar yAxisId="amount" dataKey="Credit notes" fill="#DC4545" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Line yAxisId="percent" dataKey="Billing achievement" stroke="#1976D2" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard
            title="Billing status distribution"
            description="Billed amount by the current billing status selection. Select a segment to filter records."
            filename="billing-status-distribution.csv"
            rows={billingStatusRows.map((row) => ({ Status: row.name, "Billed amount": row.value, Invoices: row.invoices }))}
            loading={loading}
            error={error}
            empty={billingStatusRows.length === 0}
          >
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
                <PieChart>
                  <Pie data={billingStatusRows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {billingStatusRows.map((row) => (
                      <Cell
                        key={row.name}
                        fill={row.name.toLowerCase().includes("overdue") ? "#DC4545" : row.name.toLowerCase().includes("pending") ? "#E69A23" : row.name.toLowerCase().includes("paid") || row.name.toLowerCase().includes("complete") ? "#15966A" : "#1976D2"}
                        cursor="pointer"
                        onClick={() => onCrossFilter({ kind: "status", value: row.name })}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
                </PieChart>
              </ChartContainer>
              <ul className="space-y-1.5">
                {billingStatusRows.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                    <button type="button" onClick={() => onCrossFilter({ kind: "status", value: row.name })} className="truncate text-left text-[#64748B] hover:text-[#1976D2]">{row.name}</button>
                    <span className="shrink-0 font-mono text-[#17365D] tabular-nums">{formatInr(row.value, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ChartCard>
          <FyLabelProvider label="">
            <PoRenewalTable />
          </FyLabelProvider>
        </div>
      </section>

      <section aria-labelledby="collection-analytics-heading" className="space-y-2">
        <h2 id="collection-analytics-heading" className="border-l-2 border-[#15966A] pl-2 text-xs font-semibold tracking-wide text-[#15966A]">
          COLLECTION ANALYTICS
        </h2>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          className="xl:col-span-2"
          title="Billed vs collected by month"
          description="Collections are shown in the month received. Select a month to filter the review."
          filename="billed-vs-collected.csv"
          rows={invoiceLines.map((line) => ({
            Month: line.month,
            Customer: displayPartyName(line.customerName),
            Company: displayPartyName(line.companyName),
            "Invoice number": line.invoiceNumber,
            "PO number": line.poNumber,
            Scope: line.scope,
            "Service type": line.serviceType,
            "Billed amount without GST": line.billed,
            "Collected amount without GST": line.collected,
            Outstanding: line.outstanding,
            Status: line.status,
          }))}
          loading={loading}
          error={error}
          empty={monthRows.every(
            (row) =>
              row["Billed amount without GST"] === 0 &&
              row["Collected amount without GST"] === 0,
          )}
        >
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
          >
            <BarChart data={monthRows} barGap={2}>
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
              />
              <YAxis
                tickFormatter={(value) => formatInr(Number(value), true)}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={72}
              />
              <Tooltip
                formatter={(value) => formatInr(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar
                dataKey="Billed amount without GST"
                fill="var(--color-billing)"
                radius={[2, 2, 0, 0]}
                maxBarSize={22}
                cursor="pointer"
                isAnimationActive={false}
                onClick={(item) => onMonth(String(item.month))}
              />
              <Bar
                dataKey="Collected amount without GST"
                fill="var(--color-payment)"
                radius={[2, 2, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(item) => onMonth(String(item.month))}
              />
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard
          title="Collection status"
          description={
            partial > 0
              ? `${formatCount(partial)} partially collected invoices are already included in collected and outstanding.`
              : "Collected, pending, and overdue amounts for this selection."
          }
          filename="collection-status.csv"
          rows={slices.map((slice) => ({
            Status: slice.name,
            Amount: slice.value,
          }))}
          loading={loading}
          error={error}
          empty={slices.every((slice) => slice.value === 0)}
        >
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-52 w-full"
            >
              <PieChart>
                <Pie
                  data={slices.filter((slice) => slice.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={74}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices
                    .filter((slice) => slice.value > 0)
                    .map((slice) => (
                      <Cell
                        key={slice.name}
                        fill={sliceColor[slice.name] ?? "#98A2B3"}
                        cursor="pointer"
                        onClick={() => openCollectionSlice(slice.name)}
                      />
                    ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatInr(Number(value))}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ChartContainer>
            <ul className="space-y-1.5">
              {slices.map((slice) => (
                <li
                  key={slice.name}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-[#667085]">
                    <span
                      className="size-2 rounded-sm"
                      style={{
                        background: sliceColor[slice.name] ?? "#98A2B3",
                      }}
                    />
                    {slice.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 font-mono text-[#17365D] tabular-nums">
                    <HoverAmount value={slice.value} className="font-mono text-[#17365D] tabular-nums" />
                    <span className="text-[10px] text-[#64748B]">{formatPercent(collectionStatusTotal > 0 ? slice.value / collectionStatusTotal * 100 : 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <RankChart
          title="Revenue by company"
          description="Top companies by billed amount. Select a bar to focus that company."
          filename="revenue-by-company.csv"
          rows={companyRows}
          data={companies}
          dataKey="billed"
          color="#1976D2"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "company", value: name })}
        />
        <RankChart
          title="Outstanding by customer"
          description="Top 10 customers by total unpaid balance, including balances without a due date."
          filename="outstanding-by-customer.csv"
          rows={customerRows}
          data={customers}
          dataKey="due"
          color="#E69A23"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "customer", value: name })}
        />
        <RankChart
          title="Overdue amount by company"
          description="Companies with the highest unpaid balances past their due dates. Select a bar to focus that company."
          filename="overdue-by-company.csv"
          rows={overdueCompanyRows}
          data={overdueCompanies}
          dataKey="pastDue"
          color="#DC4545"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "company", value: name })}
        />
        <RankChart
          title="Outstanding by company"
          description="Total unpaid balance by company, including balances without a due date. Select a bar to focus that company."
          filename="outstanding-by-company.csv"
          rows={outstandingCompanyRows}
          data={outstandingCompanies}
          dataKey="due"
          color="#E69A23"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "company", value: name })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          title="Revenue and collection trend"
          description="Compare billed, collected, and remaining invoice balances by billing month. Select a month to filter the review."
          filename="revenue-collection-trend.csv"
          rows={monthRows}
          loading={loading}
          error={error}
          empty={monthRows.every(
            (row) =>
              row["Billed amount without GST"] === 0 &&
              row["Collected amount without GST"] === 0,
          )}
        >
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
          >
            <ComposedChart
              data={monthRows}
              onClick={(state) => {
                if (state?.activeLabel) onMonth(String(state.activeLabel));
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
              />
              <YAxis
                tickFormatter={(value) => formatInr(Number(value), true)}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={72}
              />
              <Tooltip
                formatter={(value) => formatInr(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Line
                dataKey="Billed amount without GST"
                stroke="var(--color-billing)"
                strokeWidth={2}
                dot={false}
                type="linear"
                isAnimationActive={false}
              />
              <Line
                dataKey="Collected amount without GST"
                stroke="var(--color-payment)"
                strokeWidth={2}
                dot={false}
                type="linear"
                isAnimationActive={false}
              />
              <Line
                dataKey="Outstanding amount without GST"
                stroke="var(--color-outstanding)"
                strokeWidth={2}
                dot={false}
                type="linear"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard
          title="MRR"
          description="Invoiced amount for the months, companies, customers, and billing statuses in the current filters."
          filename="mrr.csv"
          rows={mrrRows.map((row) => ({ Month: row.month, MRR: row.MRR }))}
          loading={loading}
          error={error}
          empty={mrrRows.every((row) => row.MRR === 0)}
        >
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-60 w-full"
          >
            <AreaChart
              data={mrrRows}
              onClick={(state) => {
                if (state?.activeLabel) onMonth(String(state.activeLabel));
              }}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id={mrrFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93C5FD" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#93C5FD" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(value) => formatInr(Number(value), true)}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={72}
              />
              <Tooltip
                formatter={(value) => formatInr(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Area
                dataKey="MRR"
                name="MRR"
                type="monotone"
                stroke="#1976D2"
                strokeWidth={2}
                fill={`url(#${mrrFillId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <AgingAnalyticsChart
          invoiceLines={invoiceLines}
          loading={loading}
          error={error}
          onOpenNotDue={() => onKpiClick("notYetDue")}
          onOpenOverdue={() => onKpiClick("overdueAmount")}
          onOpenUndated={() => onKpiClick("totalReceivables")}
        />
        <ChartCard
          title="Monthly collection efficiency"
          description="Monthly collection-to-billing ratio: receipts posted in a month divided by net billing dated that month. Receipt timing can differ from the period-wide collection efficiency KPI."
          filename="monthly-collection-efficiency.csv"
          rows={monthlyEfficiency.map((row) => ({
            Month: row.month,
            "Collection-to-billing ratio": row.efficiency ?? "N/A",
          }))}
          loading={loading}
          error={error}
          empty={monthlyEfficiency.every((row) => row.efficiency == null)}
        >
          <ChartContainer config={collectionEfficiencyConfig} className="aspect-auto h-60 w-full">
            <LineChart
              data={monthlyEfficiency}
              onClick={(state) => {
                if (state?.activeLabel) onMonth(String(state.activeLabel));
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis
                tickFormatter={(value) => formatPercent(Number(value))}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={58}
              />
              <Tooltip
                formatter={(value) => value == null ? "N/A" : formatPercent(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Line
                dataKey="efficiency"
                name="Monthly collection-to-billing ratio"
                stroke="var(--color-efficiency)"
                strokeWidth={2}
                type="monotone"
                connectNulls={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </ChartCard>
      </div>
      </section>
      <section aria-labelledby="management-insights-heading" className="space-y-2">
        <h2 id="management-insights-heading" className="border-l-2 border-[#17365D] pl-2 text-xs font-semibold tracking-wide text-[#17365D]">
          MANAGEMENT INSIGHTS
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <InsightCard
            label="Highest outstanding customer"
            value={customers[0] ? displayPartyName(customers[0].name) : "No outstanding balances"}
            detail={customers[0] ? formatInr(customers[0].due) : "No matching records in the current selection."}
            onClick={customers[0] ? () => onCrossFilter({ kind: "customer", value: customers[0].name }) : undefined}
          />
          <InsightCard
            label="Highest overdue company"
            value={overdueCompanies[0] ? displayPartyName(overdueCompanies[0].name) : "No overdue balance"}
            detail={overdueCompanies[0] ? formatInr(overdueCompanies[0].pastDue) : "No matching overdue records in the current selection."}
            onClick={overdueCompanies[0] ? () => onCrossFilter({ kind: "company", value: overdueCompanies[0].name }) : undefined}
            tone="danger"
          />
          <InsightCard
            label="Overdue exposure"
            value={formatInr(overdue ?? 0)}
            detail={`${formatCount(overdueInvoiceCount)} distinct overdue invoices`}
            onClick={() => onKpiClick("overdueAmount")}
            tone="danger"
          />
          <InsightCard
            label="Upcoming receivables"
            value={formatInr(notYetDue)}
            detail="Unpaid invoices not past their due date."
            onClick={() => onKpiClick("notYetDue")}
            tone="warning"
          />
          <InsightCard
            label="Billing achievement"
            value={billingOverview?.billingAchievement == null ? "Unavailable" : formatPercent(billingOverview.billingAchievement)}
            detail={deltas.billingAchievement.text}
            onClick={() => onKpiClick("billingAchievement")}
          />
          <InsightCard
            label="Collection performance vs previous period"
            value={deltas.collected.text}
            detail="Based on the current financial year comparison and dashboard filters."
            onClick={() => onKpiClick("totalCollected")}
          />
        </div>
      </section>

    </div>
  );
}

export function PartyView({
  purpose,
  title,
  records,
  partyKey,
  loading,
  error,
  onCrossFilter,
}: {
  purpose: "customer" | "company";
  title: string;
  records: RevenueRecord[];
  partyKey: "customerName" | "companyName";
  loading: boolean;
  error: string | null;
  onCrossFilter: (filter: CrossFilter) => void;
}) {
  const rows = groupByParty(records, partyKey);
  const kind = partyKey === "customerName" ? "customer" : "company";
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" }>({
    id: purpose === "customer" ? "due" : "billed",
    dir: "desc",
  });
  const sorted = [...rows].sort((left, right) =>
    compareParty(left, right, sort.id, sort.dir),
  );
  const ranked = topParties(rows, purpose === "customer" ? "due" : "billed", 8);
  const rankedChart = namedRows(ranked);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="shrink-0 text-sm text-[#667085]">
        {purpose === "customer"
          ? "Customer revenue, collected amount without GST, outstanding balances, and overdue exposure."
          : "Company billed amount, collected amount without GST, outstanding, and overdue amounts."}
      </p>
      <div className="grid shrink-0 grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <RankChart
          title={
            purpose === "customer"
              ? "Highest outstanding"
              : "Highest billed revenue"
          }
          filename={
            purpose === "customer"
              ? "customer-outstanding.csv"
              : "company-revenue.csv"
          }
          rows={ranked.map((row) => ({
            Name: displayPartyName(row.name),
            Amount: purpose === "customer" ? row.due : row.billed,
            "Collected amount without GST": row.collected,
          }))}
          data={ranked}
          dataKey={purpose === "customer" ? "due" : "billed"}
          color={purpose === "customer" ? "#E69A23" : "#1976D2"}
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind, value: name })}
        />
        <ChartCard
          title={
            purpose === "customer"
              ? "Collected against outstanding"
              : "Billed against collected"
          }
          filename={
            purpose === "customer"
              ? "customer-collection.csv"
              : "company-collection.csv"
          }
          rows={ranked.map((row) => ({
            Name: displayPartyName(row.name),
            "Billed amount without GST": row.billed,
            "Collected amount without GST": row.collected,
            Outstanding: row.due,
            Overdue: row.pastDue,
          }))}
          loading={loading}
          error={error}
          empty={ranked.length === 0}
        >
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
            <BarChart
              data={rankedChart}
              layout="vertical"
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid horizontal={false} stroke="#eef1f4" />
              <XAxis
                type="number"
                tickFormatter={(value) => formatInr(Number(value), true)}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={shorten}
              />
              <Tooltip
                formatter={(value) => formatInr(Number(value))}
                contentStyle={tooltipStyle}
              />
              <Legend />
              {purpose === "company" ? (
                <Bar
                  dataKey="billed"
                  name="Billed amount without GST"
                  fill="#1976D2"
                  maxBarSize={12}
                  isAnimationActive={false}
                />
              ) : null}
              <Bar
                dataKey="collected"
                name="Collected amount without GST"
                fill="#15966A"
                maxBarSize={12}
                isAnimationActive={false}
              />
              <Bar
                dataKey="due"
                name="Outstanding"
                fill="#E69A23"
                maxBarSize={12}
                isAnimationActive={false}
              />
              <Bar
                dataKey="pastDue"
                name="Overdue"
                fill="#DC4545"
                maxBarSize={12}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
      <article className="flex min-h-80 min-w-0 flex-1 flex-col rounded-xl border border-[#e3e8ef] bg-white p-3.5 shadow-sm sm:p-4">
        <h3 className="mb-2 shrink-0 text-sm font-semibold text-[#1c2430]">
          {title}
        </h3>
        <DataTable
          className="max-h-none min-h-0 flex-1"
          sort={sort}
          onSort={(id) =>
            setSort((current) =>
              current.id === id
                ? { id, dir: current.dir === "desc" ? "asc" : "desc" }
                : { id, dir: "desc" },
            )
          }
          columns={[
            { id: "name", label: "Name" },
            {
              id: "billed",
              label: "Billed amount without GST",
              align: "right",
            },
            {
              id: "collected",
              label: "Collected amount without GST",
              align: "right",
            },
            { id: "due", label: "Outstanding", align: "right" },
            { id: "pastDue", label: "Overdue", align: "right" },
            { id: "records", label: "Records", align: "right" },
            { id: "status", label: "Status" },
          ]}
          rows={sorted.map((row) => [
            displayPartyName(row.name),
            <Money key="billed" value={row.billed} />,
            <Money key="collected" value={row.collected} />,
            <Money key="due" value={row.due} />,
            <Money key="past" value={row.pastDue} />,
            row.records,
            <StatusBadge key="status" value={row.efficiency} />,
          ])}
        />
        <p className="mt-2 shrink-0 text-[11px] text-[#667085]">
          Overdue is the outstanding portion past its due date. Average days to
          pay stays hidden because payment dates are not on these rows.
        </p>
      </article>
    </div>
  );
}

export function AgingView({
  records,
  aging,
  hiddenReason,
}: {
  records: RevenueRecord[];
  aging: AgingSummary | null;
  hiddenReason: string | null;
}) {
  const outstanding = records.filter(
    (record) => toNumber(record.overdueAmount) > 0,
  );
  const bucketRows =
    aging?.buckets.map((bucket) => ({
      Bucket: bucket.label,
      Amount: bucket.amount,
      Invoices: bucket.count,
    })) ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#667085]">
        Receivables aging for outstanding invoices that have a due date.
      </p>
      {hiddenReason ? (
        <p className="rounded-md border border-[#f3e2b8] bg-[#fff8eb] px-3 py-2 text-sm text-[#8a5a00]">
          {hiddenReason}
        </p>
      ) : null}
      {!hiddenReason && aging && !aging.supported ? (
        <p className="rounded-md border border-[#f3e2b8] bg-[#fff8eb] px-3 py-2 text-sm text-[#8a5a00]">
          Aging buckets are unavailable. Outstanding invoices in this selection
          do not have payment due dates.
        </p>
      ) : null}
      {!hiddenReason && aging?.supported ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title="Overdue by age"
            description="Days past the due date. Invoices that are not yet due are excluded from these bars."
            filename="aging-buckets.csv"
            rows={bucketRows}
            empty={aging.buckets.every((bucket) => bucket.amount === 0)}
          >
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-60 w-full"
            >
              <BarChart data={aging.buckets}>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                />
                <YAxis
                  tickFormatter={(value) => formatInr(Number(value), true)}
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  width={72}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "amount" ? formatInr(Number(value)) : value
                  }
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="amount"
                  name="Overdue"
                  fill="#DC4545"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          </ChartCard>
          <article className="rounded-xl border border-[#e3e8ef] bg-white p-3.5 text-sm shadow-sm sm:p-4">
            <h3 className="font-semibold text-[#1c2430]">
              Outside the overdue buckets
            </h3>
            <dl className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#667085]">Not yet due</dt>
                <dd className="font-mono tabular-nums">
                  <HoverAmount value={aging.notYetDueAmount} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#667085]">No due date</dt>
                <dd className="font-mono tabular-nums">
                  <HoverAmount value={aging.missingDueDateAmount} />
                </dd>
              </div>
            </dl>
          </article>
        </div>
      ) : null}
      <article className="rounded-xl border border-[#e3e8ef] bg-white p-3.5 shadow-sm sm:p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#1c2430]">
          Outstanding records
        </h3>
        <DataTable
          columns={[
            { id: "customer", label: "Customer" },
            { id: "company", label: "Company" },
            { id: "po", label: "PO" },
            {
              id: "billed",
              label: "Billed amount without GST",
              align: "right",
            },
            {
              id: "collected",
              label: "Collected amount without GST",
              align: "right",
            },
            { id: "outstanding", label: "Outstanding", align: "right" },
            { id: "overdue", label: "Overdue", align: "right" },
            { id: "status", label: "Status" },
          ]}
          rows={outstanding.map((record) => [
            displayPartyName(record.customerName),
            displayPartyName(record.companyName),
            record.poNumber || "—",
            <Money key="billed" value={toNumber(record.amount)} />,
            <Money key="collected" value={toNumber(record.collectedAmount)} />,
            <Money key="due" value={toNumber(record.overdueAmount)} />,
            <Money key="past" value={toNumber(record.pastDueAmount)} />,
            record.status || "—",
          ])}
        />
      </article>
    </div>
  );
}

export function ForecastView({
  projected,
  billed,
  collected,
  monthly,
}: {
  projected: number;
  billed: number;
  collected: number;
  monthly: MonthPoint[];
}) {
  const series = monthly.map((point) => ({
    month: point.month,
    Projected: point.projected ?? point.billing,
    "Billed amount without GST": point.billing,
  }));

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-[#d5e4f2] bg-[#f4f9fd] px-3 py-2 text-sm text-[#1c2430]">
        Projected is the amount that should be billed for the month, including
        later months in the financial year. Billed amount without GST is the
        invoice amount minus credit notes dated in that month. Later months stay
        at zero until they are billed.
      </p>
      <ChartCard
        title="Projected vs billed"
        description="Projected is how much should be billed. Billed amount without GST is the invoice amount minus credit notes."
        filename="forecast.csv"
        rows={series}
        empty={series.every(
          (row) =>
            row.Projected === 0 && row["Billed amount without GST"] === 0,
        )}
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-72 w-full"
        >
          <BarChart data={series} barGap={2}>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <YAxis
              tickFormatter={(value) => formatInr(Number(value), true)}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={72}
            />
            <Tooltip
              formatter={(value) => formatInr(Number(value))}
              contentStyle={tooltipStyle}
            />
            <Legend />
            <Bar
              dataKey="Projected"
              fill="#9ECBF5"
              radius={[2, 2, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
            <Bar
              dataKey="Billed amount without GST"
              fill="#1976D2"
              radius={[2, 2, 0, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <SecondaryStat
          label="Total revenue projected without GST"
          value={projected}
          hint="Amount before GST for the selected financial year, including later months, minus credit notes dated in that financial year."
        />
        <SecondaryStat
          label="Billed amount without GST"
          value={billed}
          hint="Invoice amount before GST, minus credit notes dated in the selected period."
        />
        <SecondaryStat
          label="Collected amount without GST"
          value={collected}
          hint="Amount collected in the selected period. The period comparison uses this amount."
        />
      </div>
    </div>
  );
}

function AgingAnalyticsChart({
  invoiceLines,
  loading,
  error,
  onOpenNotDue,
  onOpenOverdue,
  onOpenUndated,
}: {
  invoiceLines: BillingInvoiceLine[];
  loading: boolean;
  error: string | null;
  onOpenNotDue: () => void;
  onOpenOverdue: () => void;
  onOpenUndated: () => void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const balances = new Map<string, { dueDate: string; outstanding: number }>();
  for (const line of invoiceLines) {
    const identity = line.invoiceIdentity || `${line.companyName}|${line.invoiceNumber}|${line.invoiceDate ?? ""}`;
    const current = balances.get(identity) ?? { dueDate: "", outstanding: 0 };
    if (line.dueDate) {
      const dueDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(line.dueDate));
      current.dueDate = !current.dueDate || dueDate < current.dueDate ? dueDate : current.dueDate;
    }
    current.outstanding += line.notYetDueAmount + line.overdueAmount + line.undatedOutstanding;
    balances.set(identity, current);
  }
  const amounts = new Map<string, { amount: number; invoices: number }>([
    ["Not Due", { amount: 0, invoices: 0 }],
    ["1–15 Days", { amount: 0, invoices: 0 }],
    ["16–30 Days", { amount: 0, invoices: 0 }],
    ["31–45 Days", { amount: 0, invoices: 0 }],
    ["Above 45 Days", { amount: 0, invoices: 0 }],
    ["No Due Date", { amount: 0, invoices: 0 }],
  ]);
  const todayValue = Date.parse(`${today}T00:00:00Z`);
  for (const invoice of balances.values()) {
    if (invoice.outstanding <= 0) continue;
    let label = "No Due Date";
    if (invoice.dueDate) {
      const dueValue = Date.parse(`${invoice.dueDate}T00:00:00Z`);
      const daysLate = Math.floor((todayValue - dueValue) / 86_400_000);
      label = daysLate <= 0 ? "Not Due" : daysLate <= 15 ? "1–15 Days" : daysLate <= 30 ? "16–30 Days" : daysLate <= 45 ? "31–45 Days" : "Above 45 Days";
    }
    const bucket = amounts.get(label)!;
    bucket.amount += invoice.outstanding;
    bucket.invoices += 1;
  }
  const agingRows = [...amounts].map(([label, values]) => ({ label, amount: values.amount, invoices: values.invoices }));
  const rows = agingRows.map((row) => ({ Bucket: row.label, "Outstanding amount without GST": row.amount, Invoices: row.invoices }));
  const empty = agingRows.every((bucket) => bucket.amount === 0);
  const openBucket = (label: string) => label === "Not Due" ? onOpenNotDue() : label === "No Due Date" ? onOpenUndated() : onOpenOverdue();

  return (
    <ChartCard
      title="Receivables aging analysis"
      description="Outstanding balances grouped by due date. Select a bar to open the matching receivables detail view."
      filename="receivables-aging.csv"
      rows={rows}
      loading={loading}
      error={error}
      empty={empty}
    >
      {empty ? (
        <p className="py-10 text-center text-sm text-[#64748B]">No outstanding balances for this selection.</p>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
          <BarChart data={agingRows}>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis
              tickFormatter={(value) => formatInr(Number(value), true)}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={72}
            />
            <Tooltip
              formatter={(value, name) => name === "amount" ? formatInr(Number(value)) : value}
              contentStyle={tooltipStyle}
            />
            <Bar
              dataKey="amount"
              name="Outstanding amount without GST"
              fill="var(--color-outstanding)"
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(item) => openBucket(String(item.label))}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

function InsightCard({
  label,
  value,
  detail,
  onClick,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  onClick?: () => void;
  tone?: "default" | "warning" | "danger";
}) {
  const valueColor = tone === "danger"
    ? "text-[#DC4545]"
    : tone === "warning"
      ? "text-[#B7791F]"
      : "text-[#17365D]";
  const classes = "min-h-24 min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.035)]";
  const content = (
    <>
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${valueColor}`} title={value}>{value}</p>
      <p className="mt-1 truncate text-[10px] leading-4 text-[#64748B]" title={detail}>{detail}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${classes} transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1976D2]`}>
      {content}
    </button>
  ) : <article className={classes}>{content}</article>;
}

function RankChart({
  title,
  description,
  filename,
  rows,
  data,
  dataKey,
  color,
  loading,
  error,
  onPick,
}: {
  title: string;
  description?: string;
  filename: string;
  rows: Array<Record<string, string | number>>;
  data: PartyRow[];
  dataKey: "billed" | "due" | "pastDue";
  color: string;
  loading: boolean;
  error: string | null;
  onPick: (name: string) => void;
}) {
  const chartData = namedRows(data);

  return (
    <ChartCard
      title={title}
      description={description}
      filename={filename}
      rows={rows}
      loading={loading}
      error={error}
      empty={data.length === 0}
    >
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 12 }}
        >
          <CartesianGrid horizontal={false} stroke="#eef1f4" />
          <XAxis
            type="number"
            tickFormatter={(value) => formatInr(Number(value), true)}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={shorten}
          />
          <Tooltip
            formatter={(value) => formatInr(Number(value))}
            contentStyle={tooltipStyle}
          />
          <Bar
            dataKey={dataKey}
            name={
              dataKey === "billed"
                ? "Billed amount without GST"
                : dataKey === "pastDue"
                  ? "Overdue amount without GST"
                  : "Outstanding without GST"
            }
            fill={color}
            radius={[0, 2, 2, 0]}
            maxBarSize={16}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(item) => onPick(String(item.rawName ?? item.name))}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function SecondaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e8ef] bg-white px-3.5 py-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[11px] font-medium text-[#667085]">{label}</p>
          <FyBadge />
        </div>
        <p className="truncate text-[11px] text-[#98a2b3]">{hint}</p>
      </div>
      <HoverAmount
        value={value}
        className="shrink-0 font-mono text-sm font-semibold text-[#1c2430] tabular-nums"
      />
    </article>
  );
}

function Money({ value }: { value: number }) {
  return <HoverAmount value={value} className="font-mono tabular-nums" />;
}

function shorten(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

function compareParty(
  left: PartyRow,
  right: PartyRow,
  id: string,
  dir: "asc" | "desc",
) {
  const sign = dir === "asc" ? 1 : -1;
  const key = id === "status" ? "efficiency" : id;
  const leftValue = left[key as keyof PartyRow];
  const rightValue = right[key as keyof PartyRow];
  if (typeof leftValue === "string" && typeof rightValue === "string") {
    return leftValue.localeCompare(rightValue) * sign;
  }
  return (Number(leftValue) - Number(rightValue)) * sign;
}
