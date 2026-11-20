"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { periodMode } from "@/lib/dashboard-presets";
import { getFiscalYear } from "@/lib/fiscal-year";
import type { BillingInvoiceLine, BillingOverviewMetrics, CreditNoteDashboardSummary, DashboardKpiDetailRecord, RevenueDashboardSummary, RevenuePeriodComparison } from "@/lib/actions/dashboard";
import {
  applyRecordFilters,
  efficiencyOf,
  filterTokens,
  formatPercent,
  percentDelta,
  toggleFilterToken,
  sumRecords,
  toNumber,
  trendTone,
  type CrossFilter,
  type DashboardFilters,
  type MonthPoint,
  type RevenueRecord,
  type TrendPolarity,
  type TrendTone,
} from "@/lib/revenue-metrics";

import { DashboardTabs, isDashboardView, type DashboardView } from "./dashboard-tabs";
import { FyLabelProvider } from "./fy-badge";
import { FilterChips } from "./filter-chips";
import { KpiDetailsDialog } from "./kpi-details-dialog";
import type { KpiDetailKey } from "./kpi-card";
import { AgingView, ForecastView, OverviewView, PartyView } from "./report-views";
import { SlicerBar } from "./slicer-bar";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const quarterMonthIndexes: Record<string, number[]> = {
  "1": [0, 1, 2],
  "2": [3, 4, 5],
  "3": [6, 7, 8],
  "4": [9, 10, 11],
};

function focusMonthLabels(month: string, quarter: string) {
  const selectedMonths = filterTokens(month).map(Number).filter((value) => value >= 0 && value <= 11);
  const quarterMonths = filterTokens(quarter).flatMap((value) => quarterMonthIndexes[value] ?? []);
  let indexes = selectedMonths.length > 0 ? selectedMonths : months.map((_, index) => index);
  if (quarterMonths.length > 0) indexes = indexes.filter((index) => quarterMonths.includes(index));
  return indexes.map((index) => months[index]).filter((label) => label);
}

function dateInKolkata(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function financialYearLabel(year: string) {
  const years = filterTokens(year);
  if (years.length === 0) return "All years";
  if (years.length > 1) return `${years.length} financial years`;
  const start = Number(years[0]);
  if (!Number.isInteger(start)) return "Financial year";
  return `FY ${start}–${String(start + 1).slice(-2)}`;
}

function moneyDelta(
  current: number,
  previous: number | null,
  label: string | null,
  polarity: TrendPolarity,
): { text: string; tone: TrendTone } {
  if (previous == null || !label) return { text: "Comparison unavailable", tone: "neutral" };
  const delta = percentDelta(current, previous);
  if (delta == null) return { text: "Prior period was zero", tone: "neutral" };
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "–";
  return {
    text: `${arrow} ${formatPercent(Math.abs(delta))} vs ${label}`,
    tone: trendTone(delta, polarity),
  };
}

export function ManagementReport({
  companies,
  customers,
  years,
  filters,
  status,
  onStatus: setStatus,
  crossFilter,
  onCrossFilter: setCrossFilter,
  onChange,
  onPreset,
  onReset,
  summary,
  billingOverview,
  creditNotes,
  comparison,
  records,
  lines,
  creditNoteRecords,
  monthly,
  loading,
  isFetching,
  error,
  lastUpdated,
  onRefresh,
}: {
  companies: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  years: number[];
  filters: DashboardFilters;
  status: string;
  onStatus: (status: string) => void;
  crossFilter: CrossFilter | null;
  onCrossFilter: (filter: CrossFilter | null) => void;
  onChange: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  onPreset: (preset: "month" | "quarter" | "fy" | "last-fy") => void;
  onReset: () => void;
  summary: RevenueDashboardSummary | null;
  billingOverview: BillingOverviewMetrics | null;
  creditNotes: CreditNoteDashboardSummary | null;
  comparison: RevenuePeriodComparison | null;
  records: RevenueRecord[];
  lines: BillingInvoiceLine[];
  creditNoteRecords: DashboardKpiDetailRecord[];
  monthly: MonthPoint[];
  loading: boolean;
  isFetching: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selectedKpi, setSelectedKpi] = useState<KpiDetailKey | null>(null);
  const requested = params.get("view");
  const view: DashboardView = isDashboardView(requested) ? requested : "overview";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCrossFilter(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCrossFilter]);

  const setView = (next: DashboardView) => {
    const query = new URLSearchParams(params.toString());
    query.set("view", next);
    if (!query.get("tab")) query.set("tab", "revenue");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const filtered = applyRecordFilters(records, status, crossFilter);
  const selectedStatuses = filterTokens(status);
  const visibleLines = lines.filter((line) => {
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(line.status)) return false;
    if (!crossFilter || crossFilter.kind === "month") return true;
    if (crossFilter.kind === "customer") return line.customerName === crossFilter.value;
    if (crossFilter.kind === "company") return line.companyName === crossFilter.value;
    return line.status === crossFilter.value;
  });
  const totals = sumRecords(filtered);
  const usingRows = selectedStatuses.length > 0 || (crossFilter != null && crossFilter.kind !== "month");
  const billedGross = totals.billed;
    const creditNoteAmount = creditNotes?.amount ?? 0;
  const netBilled = billedGross - creditNoteAmount;
  const collected = usingRows ? totals.collected : summary?.collectedAmountTillNow ?? 0;
  const notYetDue = totals.due;
  const outstanding = notYetDue + totals.pastDue + totals.undated;
  const overdue = totals.pastDue;
  const collectionEfficiency = efficiencyOf(collected, netBilled);
  const today = dateInKolkata(new Date().toISOString());
  const overdueInvoices = new Map<string, { dueDate: string; outstanding: number }>();
  for (const line of visibleLines) {
    if (!line.invoiceNumber || line.invoiceNumber === "-" || !line.invoiceDate || !line.dueDate) continue;
    const identity = line.invoiceIdentity || `${line.companyName}|${line.invoiceNumber}|${line.invoiceDate}`;
    const current = overdueInvoices.get(identity) ?? { dueDate: dateInKolkata(line.dueDate), outstanding: 0 };
    current.dueDate = current.dueDate && dateInKolkata(line.dueDate)
      ? (current.dueDate < dateInKolkata(line.dueDate) ? current.dueDate : dateInKolkata(line.dueDate))
      : current.dueDate || dateInKolkata(line.dueDate);
    current.outstanding += line.notYetDueAmount + line.overdueAmount + line.undatedOutstanding;
    overdueInvoices.set(identity, current);
  }
  const overdueInvoiceCount = [...overdueInvoices.values()].filter((invoice) =>
    invoice.dueDate <= today && invoice.outstanding > 0,
  ).length;
  const kpiValues: Record<KpiDetailKey, number> = {
    plannedBilling: billingOverview?.plannedBilling ?? 0,
    billedAmount: billedGross,
    netBilledAmount: netBilled,
    creditNoteAmount,
    billingDone: billingOverview?.billingDoneWithGst ?? 0,
    billingAchievement: billingOverview?.billingAchievement ?? 0,
    totalCollected: collected,
    totalReceivables: outstanding,
    notYetDue,
    overdueAmount: overdue ?? 0,
    collectionEfficiency,
    overdueInvoiceCount,
    pendingCollection: Math.max(outstanding - (overdue ?? 0), 0),
  };
  const kpiUnavailable = selectedKpi === "plannedBilling"
    ? billingOverview?.plannedBilling == null
    : selectedKpi === "netBilledAmount"
      ? !creditNotes || Boolean(error)
      : selectedKpi === "creditNoteAmount"
        ? !creditNotes || Boolean(error)
        : selectedKpi === "billingDone"
          ? billingOverview?.billingDoneWithGst == null
          : selectedKpi === "billingAchievement"
            ? billingOverview?.billingAchievement == null
            : selectedKpi === "overdueAmount"
              ? overdue == null
              : selectedKpi === "collectionEfficiency"
                ? netBilled <= 0 || !creditNotes || Boolean(error)
                : false;
  const partial = usingRows
    ? filtered.filter((record) => toNumber(record.collectedAmount) > 0 && (toNumber(record.overdueAmount) > 0 || toNumber(record.pastDueAmount) > 0)).length
    : summary?.partialInvoiceCount ?? 0;
  const slices = overdue == null
    ? [
        { name: "Collected", value: collected },
        { name: "Pending", value: outstanding },
      ]
    : [
        { name: "Collected", value: Math.max(collected, 0) },
        { name: "Pending", value: Math.max(outstanding - overdue, 0) },
        { name: "Overdue", value: Math.max(overdue, 0) },
      ];
  const collectionStatusTotal = slices.reduce((total, slice) => total + slice.value, 0);
  const previous = comparison;
  const comparisonLabel = previous?.label ?? null;
  const comparisonRecords = previous
    ? applyRecordFilters(previous.records, status, crossFilter)
    : [];
  const comparisonTotals = sumRecords(comparisonRecords);
  const comparisonBilled = comparisonTotals.billed;
  const comparisonNetBilled = previous?.creditNotes
    ? comparisonBilled - previous.creditNotes.amount
    : null;
  const comparisonCollected = usingRows
    ? comparisonTotals.collected
    : previous?.summary.collectedAmountTillNow ?? 0;
  const comparisonOutstanding =
    comparisonTotals.due + comparisonTotals.pastDue + comparisonTotals.undated;
  const comparisonEfficiency = comparisonNetBilled == null
    ? null
    : efficiencyOf(comparisonCollected, comparisonNetBilled);
  const deltas = {
    planned: moneyDelta(
      billingOverview?.plannedBilling ?? 0,
      previous?.billingOverview?.plannedBilling ?? null,
      comparisonLabel,
      "higher-is-better",
    ),
    billed: moneyDelta(billedGross, previous ? comparisonBilled : null, comparisonLabel, "higher-is-better"),
    billingDone: moneyDelta(
      billingOverview?.billingDoneWithGst ?? 0,
      previous?.billingOverview?.billingDoneWithGst ?? null,
      comparisonLabel,
      "higher-is-better",
    ),
    billingAchievement: moneyDelta(
      billingOverview?.billingAchievement ?? 0,
      previous?.billingOverview?.billingAchievement ?? null,
      comparisonLabel,
      "higher-is-better",
    ),
    creditNotes: moneyDelta(
      creditNotes?.amount ?? 0,
      previous?.creditNotes?.amount ?? null,
      comparisonLabel,
      "lower-is-better",
    ),
    netBilled: moneyDelta(netBilled, comparisonNetBilled, comparisonLabel, "higher-is-better"),
    collected: moneyDelta(collected, previous ? comparisonCollected : null, comparisonLabel, "higher-is-better"),
    outstanding: moneyDelta(
      outstanding,
      previous ? comparisonOutstanding : null,
      comparisonLabel,
      "lower-is-better",
    ),
    notYetDue: moneyDelta(notYetDue, previous ? comparisonTotals.due : null, comparisonLabel, "lower-is-better"),
    overdue: previous
      ? moneyDelta(overdue ?? 0, comparisonTotals.pastDue, comparisonLabel, "lower-is-better")
      : { text: "Comparison unavailable", tone: "neutral" as const },
    efficiency: moneyDelta(collectionEfficiency, comparisonEfficiency, comparisonLabel, "higher-is-better"),
  };
  const statuses = [...new Set(records.map((record) => record.status || "Unknown"))].sort();
  const fyLabel = financialYearLabel(filters.year);
  const currentYear = String(getFiscalYear(new Date()));

  const selectMonth = (month: string) => {
    const index = months.indexOf(month);
    if (index < 0) return;
    onChange("month", toggleFilterToken(filters.month, String(index)));
  };

  const selectedYears = filterTokens(filters.year);
  const chips = [
    ...(selectedYears.length === 0
      ? [{ id: "year", label: "All years", onRemove: () => onChange("year", currentYear) }]
      : selectedYears
          .filter((year) => selectedYears.length > 1 || year !== currentYear)
          .map((year) => ({
            id: `year-${year}`,
            label: `FY ${year}–${String(Number(year) + 1).slice(-2)}`,
            onRemove: () => {
              const next = toggleFilterToken(filters.year, year);
              onChange("year", next === "all" ? currentYear : next);
            },
          }))),
    ...filterTokens(filters.quarter).map((quarter) => ({
      id: `quarter-${quarter}`,
      label: `Q${quarter}`,
      onRemove: () => onChange("quarter", toggleFilterToken(filters.quarter, quarter)),
    })),
    ...filterTokens(filters.month).map((month) => ({
      id: `month-${month}`,
      label: months[Number(month)] ?? "Month",
      onRemove: () => onChange("month", toggleFilterToken(filters.month, month)),
    })),
    ...filterTokens(filters.company).map((companyId) => ({
      id: `company-${companyId}`,
      label: companies.find((company) => company.id === companyId)?.name ?? "Company",
      onRemove: () => onChange("company", toggleFilterToken(filters.company, companyId)),
    })),
    ...filterTokens(filters.customer).map((customerId) => ({
      id: `customer-${customerId}`,
      label: customers.find((customer) => customer.id === customerId)?.name ?? "Customer",
      onRemove: () => onChange("customer", toggleFilterToken(filters.customer, customerId)),
    })),
    filters.startDate
      ? { id: "from", label: `From ${format(filters.startDate, "dd MMM yyyy")}`, onRemove: () => onChange("startDate", undefined) }
      : null,
    filters.endDate
      ? { id: "to", label: `To ${format(filters.endDate, "dd MMM yyyy")}`, onRemove: () => onChange("endDate", undefined) }
      : null,
    ...selectedStatuses.map((item) => ({
      id: `status-${item}`,
      label: item,
      onRemove: () => setStatus(toggleFilterToken(status, item)),
    })),
    crossFilter
      ? {
          id: "cross",
          label: `${crossFilter.kind}: ${crossFilter.value === "-" ? "Unassigned" : crossFilter.value}`,
          onRemove: () => setCrossFilter(null),
        }
      : null,
  ].filter((chip) => chip !== null);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="-mx-3 -mt-3 flex min-h-[calc(100svh-var(--header-height)-1rem)] min-w-0 flex-1 flex-col gap-4 bg-[#f5f7fb] px-3 py-4 sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mt-6 lg:py-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-[#17365D]">Management Dashboard</h1>
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1F6FB5]">
                {fyLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Financial performance, billing progress, and collections at a glance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <p className="text-[11px] text-[#667085]">
              {lastUpdated ? `Last refreshed ${format(lastUpdated, "dd MMM yyyy, hh:mm a")}` : "Not refreshed yet"}
              {isFetching && summary ? " · Updating" : ""}
            </p>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Refresh report" onClick={onRefresh} disabled={isFetching}>
              <RefreshCw className={isFetching ? "animate-spin" : ""} />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft />
              Back
            </Button>
          </div>
        </header>

        <div className="no-print min-w-0 space-y-3 rounded-xl border border-[#e3e8ef] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.035),0_12px_28px_-24px_rgba(16,24,40,0.18)] sm:p-4">
          <DashboardTabs value={view} onChange={setView} />
          <SlicerBar
            filters={filters}
            companies={companies}
            customers={customers}
            years={years}
            statuses={statuses}
            status={status}
            onStatus={setStatus}
            onChange={onChange}
            onPreset={onPreset}
            periodMode={periodMode(filters)}
          />
          <FilterChips
            chips={chips}
            count={filtered.length}
            onReset={() => {
              setStatus("all");
              setCrossFilter(null);
              onReset();
            }}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-md border border-[#f3c7c9] bg-[#fdf2f2] px-3 py-2 text-sm text-[#C5363C]">{error}</p>
        ) : null}
        {(filterTokens(filters.company).length > 0 || selectedStatuses.length > 0 || crossFilter?.kind === "company" || crossFilter?.kind === "status") && summary ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Credit notes have no company or purchase order status. These filters match notes through customers with matching purchase orders, so credit note and net billed amounts are estimates for this selection.
          </p>
        ) : null}
        {view === "overview" && comparisonLabel?.endsWith(" YTD") ? (
          <p className="text-xs text-[#667085]">
            Financial year to date through today; comparisons use the same date in the previous financial year.
          </p>
        ) : null}
        <FyLabelProvider label={fyLabel}>
        <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {!summary && loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md bg-white motion-reduce:animate-none" />
              ))}
            </div>
          ) : null}
          {summary && view === "overview" ? (
            <OverviewView
      billed={billedGross}
      netBilled={netBilled}
              collected={collected}
              outstanding={outstanding}
      notYetDue={notYetDue}
              overdue={overdue}
      collectionEfficiency={collectionEfficiency}
              overdueInvoiceCount={overdueInvoiceCount}
      collectionEfficiencyAvailable={netBilled > 0 && Boolean(creditNotes) && !error}
      netBilledAvailable={Boolean(creditNotes) && !error}
              creditNotes={creditNotes}
              creditNoteRecords={creditNoteRecords}
              creditNotesError={Boolean(error)}
              partial={partial}
              projected={summary.totalRevenueProjected}
              dueForBilling={summary.dueForBillingTillNow}
              billingOverview={billingOverview}
              deltas={deltas}
              slices={slices}
              collectionStatusTotal={collectionStatusTotal}
              monthly={monthly}
              recordRows={filtered}
              invoiceLines={visibleLines}
              onKpiClick={setSelectedKpi}
              loading={loading}
              error={error}
              focusMonths={focusMonthLabels(filters.month, filters.quarter)}
              onMonth={selectMonth}
              onCrossFilter={setCrossFilter}
            />
          ) : null}
          {summary && view === "customers" ? (
            <PartyView
              purpose="customer"
              title="Customer billing and exposure"
              records={filtered}
              partyKey="customerName"
              loading={loading}
              error={error}
              onCrossFilter={setCrossFilter}
            />
          ) : null}
          {summary && view === "companies" ? (
            <PartyView
              purpose="company"
              title="Company billing position"
              records={filtered}
              partyKey="companyName"
              loading={loading}
              error={error}
              onCrossFilter={setCrossFilter}
            />
          ) : null}
          {summary && view === "aging" ? (
            <AgingView
              records={filtered}
              aging={usingRows ? null : summary.aging}
              hiddenReason={usingRows ? "Aging buckets follow the period, company, customer, and date filters. Clear the billing status or chart selection to see them." : null}
            />
          ) : null}
          {summary && view === "forecast" ? (
            <ForecastView
              projected={summary.totalRevenueProjected}
              billed={summary.totalRevenueTillNow}
              collected={collected}
              monthly={monthly}
            />
          ) : null}
        </div>
        </FyLabelProvider>
        <KpiDetailsDialog
          metric={selectedKpi}
          onOpenChange={(open) => { if (!open) setSelectedKpi(null); }}
          invoiceLines={visibleLines}
          plannedRecords={billingOverview?.plannedRecords ?? []}
          creditNoteRecords={creditNoteRecords}
          collectionUsesFilteredRows={usingRows}
          currentValue={selectedKpi ? kpiValues[selectedKpi] : 0}
          unavailable={kpiUnavailable}
        />
      </div>
    </TooltipProvider>
  );
}
