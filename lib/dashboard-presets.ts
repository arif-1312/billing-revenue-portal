import {
  FIRST_FISCAL_YEAR,
  fiscalMonthIndex,
  fiscalQuarter,
  getFiscalYear,
  quarterContainsMonth,
} from "@/lib/fiscal-year";
import { filterTokens, type DashboardFilters } from "@/lib/revenue-metrics";

export type DashboardPreset = "month" | "quarter" | "fy" | "last-fy";
export type PeriodMode = "dates" | "month" | "quarter" | "year";

export function periodMode(filters: DashboardFilters): PeriodMode {
  if (filters.startDate || filters.endDate) return "dates";
  if (filters.month !== "all") return "month";
  if (filters.quarter !== "all") return "quarter";
  return "year";
}

export function effectivePeriodFilters(filters: DashboardFilters): DashboardFilters {
  if (filters.startDate || filters.endDate) {
    return { ...filters, month: "all", quarter: "all" };
  }

  return filters;
}

export function presetPatch(preset: DashboardPreset, today: Date): Partial<DashboardFilters> {
  const financialYear = getFiscalYear(today);

  if (preset === "last-fy") {
    return {
      year: String(financialYear - 1),
      month: "all",
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    };
  }

  if (preset === "fy") {
    return {
      year: String(financialYear),
      month: "all",
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    };
  }

  if (preset === "month") {
    return {
      year: String(financialYear),
      month: String(fiscalMonthIndex(today)),
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    };
  }

  return {
    year: String(financialYear),
    quarter: fiscalQuarter(today),
    month: "all",
    startDate: undefined,
    endDate: undefined,
  };
}

export function formatFilterDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseFilterDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function filtersFromSearchParams(params: URLSearchParams, defaultYear: number): DashboardFilters {
  return {
    company: params.get("company") || "all",
    customer: params.get("customer") || "all",
    startDate: parseFilterDate(params.get("from")),
    endDate: parseFilterDate(params.get("to")),
    month: params.get("month") || "all",
    quarter: params.get("quarter") || "all",
    year: params.get("year") || String(defaultYear),
  };
}

export function writeFilterParams(
  query: URLSearchParams,
  filters: DashboardFilters,
  defaultYear: number,
) {
  const set = (key: string, value: string | null) => {
    if (!value) query.delete(key);
    else query.set(key, value);
  };

  set("year", filters.year === String(defaultYear) ? null : filters.year);
  set("month", filters.month === "all" ? null : filters.month);
  set("quarter", filters.quarter === "all" ? null : filters.quarter);
  set("company", filters.company === "all" ? null : filters.company);
  set("customer", filters.customer === "all" ? null : filters.customer);
  set("from", filters.startDate ? formatFilterDate(filters.startDate) : null);
  set("to", filters.endDate ? formatFilterDate(filters.endDate) : null);
}

export type PreviousPeriod = {
  year: string;
  month: string;
  quarter: string;
  startDate?: Date;
  endDate?: Date;
  label: string;
};

function shiftDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function fiscalYearOf(date: Date) {
  return date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
}

export function previousPeriod(filters: DashboardFilters): PreviousPeriod | null {
  const mode = periodMode(filters);

  if (mode === "dates") {
    if (!filters.startDate || !filters.endDate) return null;

    const startUtc = Date.UTC(
      filters.startDate.getFullYear(),
      filters.startDate.getMonth(),
      filters.startDate.getDate(),
    );
    const endUtc = Date.UTC(
      filters.endDate.getFullYear(),
      filters.endDate.getMonth(),
      filters.endDate.getDate(),
    );
    const span = Math.round((endUtc - startUtc) / 86_400_000);
    if (span < 0) return null;

    const endDate = shiftDays(filters.startDate, -1);
    const startDate = shiftDays(endDate, -span);
    const startYear = fiscalYearOf(startDate);
    const endYear = fiscalYearOf(endDate);
    if (startYear !== endYear || startYear < FIRST_FISCAL_YEAR) return null;

    return {
      year: String(startYear),
      month: "all",
      quarter: "all",
      startDate,
      endDate,
      label: "prior period",
    };
  }

  const years = filterTokens(filters.year);
  if (years.length !== 1) return null;
  const year = Number(years[0]);
  if (!Number.isInteger(year)) return null;

  if (mode === "month") {
    const months = filterTokens(filters.month);
    if (months.length !== 1) return null;
    const month = Number(months[0]);
    if (!Number.isInteger(month) || month < 0 || month > 11) return null;
    if (month === 0) {
      if (year - 1 < FIRST_FISCAL_YEAR) return null;
      return { year: String(year - 1), month: "11", quarter: "all", label: "prior month" };
    }
    return { year: String(year), month: String(month - 1), quarter: "all", label: "prior month" };
  }

  if (mode === "quarter") {
    const quarters = filterTokens(filters.quarter);
    if (quarters.length !== 1) return null;
    const quarter = Number(quarters[0]);
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
    if (quarter === 1) {
      if (year - 1 < FIRST_FISCAL_YEAR) return null;
      return { year: String(year - 1), month: "all", quarter: "4", label: "prior quarter" };
    }
    return { year: String(year), month: "all", quarter: String(quarter - 1), label: "prior quarter" };
  }

  if (year - 1 < FIRST_FISCAL_YEAR) return null;
  return { year: String(year - 1), month: "all", quarter: "all", label: "prior FY" };
}

export function matchingPreset(filters: DashboardFilters, today: Date): DashboardPreset | null {
  const presets: DashboardPreset[] = ["month", "quarter", "fy", "last-fy"];

  return (
    presets.find((preset) => {
      const patch = presetPatch(preset, today);
      return (
        filters.year === patch.year &&
        filters.month === patch.month &&
        filters.quarter === patch.quarter &&
        !filters.startDate &&
        !filters.endDate
      );
    }) ?? null
  );
}

export function applyFilterChange<K extends keyof DashboardFilters>(
  filters: DashboardFilters,
  key: K,
  value: DashboardFilters[K],
): DashboardFilters {
  const next: DashboardFilters = { ...filters, [key]: value };

  if (key === "month" || key === "quarter") {
    next.startDate = undefined;
    next.endDate = undefined;
  }

  if ((key === "startDate" || key === "endDate") && value) {
    next.month = "all";
    next.quarter = "all";
  }

  if (key === "quarter" && !quarterContainsMonth(String(value), next.month)) {
    next.month = "all";
  }

  if (key === "month" && !quarterContainsMonth(next.quarter, String(value))) {
    next.quarter = "all";
  }

  return next;
}
