"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { periodMode } from "@/lib/dashboard-presets";
import { getFiscalYear } from "@/lib/fiscal-year";
import type { BillingInvoiceLine, RevenueDashboardSummary, RevenuePeriodComparison } from "@/lib/actions/dashboard";
import {
  applyRecordFilters,
  collectionSlices,
  filterTokens,
  formatInr,
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
  onChange,
  onPreset,
  onReset,
  summary,
  comparison,
  records,
  lines,
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
  onChange: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  onPreset: (preset: "month" | "quarter" | "fy" | "last-fy") => void;
  onReset: () => void;
  summary: RevenueDashboardSummary | null;
  comparison: RevenuePeriodComparison | null;
  records: RevenueRecord[];
  lines: BillingInvoiceLine[];
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
  const requested = params.get("view");
  const view: DashboardView = isDashboardView(requested) ? requested : "overview";
  const [status, setStatus] = useState("all");
  const [crossFilter, setCrossFilter] = useState<CrossFilter | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCrossFilter(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const billed = usingRows ? totals.billed : summary?.totalRevenueTillNow ?? 0;
  const collected = usingRows ? totals.collected : summary?.collectedAmountTillNow ?? 0;
  const outstanding = usingRows ? totals.due : summary?.pendingCollectionTillNow ?? 0;
  const undated = usingRows ? totals.undated : summary?.aging.missingDueDateAmount ?? 0;
  const supported = usingRows
    ? !(outstanding > 0 && totals.pastDue === 0 && totals.undated >= outstanding - 0.5)
    : Boolean(summary?.aging.supported || outstanding === 0);
  const overdue = !supported && outstanding > 0
    ? null
    : usingRows
      ? totals.pastDue
      : summary?.overdueAmountTillNow ?? 0;
  const partial = usingRows
    ? filtered.filter((record) => toNumber(record.collectedAmount) > 0 && toNumber(record.overdueAmount) > 0).length
    : summary?.partialInvoiceCount ?? 0;
  const slices = overdue == null
    ? [
        { name: "Collected", value: collected },
        { name: "Outstanding", value: outstanding },
      ]
    : collectionSlices(collected, outstanding, overdue) ?? [
        { name: "Collected", value: collected },
        { name: "Outstanding", value: outstanding },
      ];
  const previous = !usingRows ? comparison : null;
  const overdueComparable = Boolean(
    previous &&
      overdue != null &&
      ((summary?.aging.supported && previous.summary.aging.supported) ||
        (outstanding === 0 && previous.summary.pendingCollectionTillNow === 0)),
  );
  const comparisonLabel = previous?.label ?? null;
  const deltas = {
    billed: moneyDelta(billed, previous ? previous.summary.totalRevenueTillNow : null, comparisonLabel, "higher-is-better"),
    collected: moneyDelta(collected, previous ? previous.summary.collectedAmountTillNow : null, comparisonLabel, "higher-is-better"),
    outstanding: moneyDelta(outstanding, previous ? previous.summary.pendingCollectionTillNow : null, comparisonLabel, "lower-is-better"),
    overdue: overdueComparable && previous
      ? moneyDelta(overdue ?? 0, previous.summary.overdueAmountTillNow, comparisonLabel, "lower-is-better")
      : { text: "Comparison unavailable", tone: "neutral" as const },
    records: { text: "Comparison unavailable", tone: "neutral" as const },
  };
  const overdueNote = overdue == null
    ? "Due dates are missing, so overdue cannot be calculated."
    : undated > 0
      ? `Excludes ${formatInr(undated, true)} outstanding with no due date.`
      : null;
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
      <div className="-mx-4 -mt-4 min-w-0 space-y-3 bg-[#f3f5f8] px-4 py-4 md:-mt-6 md:py-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-[#1c2430]">Management Dashboard</h1>
              <span className="rounded-md border border-[#d5e4f2] bg-[#e8f3fb] px-2 py-0.5 text-xs font-semibold text-[#1F6FB5]">
                {fyLabel}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="no-print min-w-0 space-y-2 rounded-md border border-[#e4e8ee] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
          <p className="rounded-md border border-[#f3c7c9] bg-[#fdf2f2] px-3 py-2 text-sm text-[#C5363C]">{error}</p>
        ) : null}
        <FyLabelProvider label={fyLabel}>
        <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
          {!summary ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-md bg-white motion-reduce:animate-none" />
              ))}
            </div>
          ) : null}
          {summary && view === "overview" ? (
            <OverviewView
              billed={billed}
              collected={collected}
              outstanding={outstanding}
              overdue={overdue}
              records={filtered.length}
              partial={partial}
              projected={summary.totalRevenueProjected}
              dueForBilling={summary.dueForBillingTillNow}
              overdueNote={overdueNote}
              deltas={deltas}
              slices={slices}
              monthly={monthly}
              recordRows={filtered}
              invoiceLines={visibleLines}
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
              billed={billed}
              collected={collected}
              monthly={monthly}
            />
          ) : null}
        </div>
        </FyLabelProvider>
      </div>
    </TooltipProvider>
  );
}
