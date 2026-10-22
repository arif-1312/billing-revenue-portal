"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ManagementReport } from "@/components/revenue-management/management-report";
import { getRevenueDashboard } from "@/lib/actions/dashboard";
import {
  applyFilterChange,
  effectivePeriodFilters,
  filtersFromSearchParams,
  formatFilterDate,
  presetPatch,
  writeFilterParams,
  type DashboardPreset,
} from "@/lib/dashboard-presets";
import { FIRST_FISCAL_YEAR } from "@/lib/fiscal-year";
import { filterTokens, type DashboardFilters } from "@/lib/revenue-metrics";

type CompanyOption = { id: string; name: string };
type CustomerOption = { id: string; name: string };

function defaultFilters(defaultYear: number): DashboardFilters {
  return {
    company: "all",
    customer: "all",
    startDate: undefined,
    endDate: undefined,
    month: "all",
    quarter: "all",
    year: String(defaultYear),
  };
}

export function RevenueDashboard({
  companies,
  customers,
  defaultYear,
}: {
  companies: CompanyOption[];
  customers: CustomerOption[];
  defaultYear: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = filtersFromSearchParams(params, defaultYear);
  const years = Array.from(
    { length: defaultYear - FIRST_FISCAL_YEAR + 1 },
    (_, index) => defaultYear - index,
  );

  const commit = (next: DashboardFilters) => {
    const query = new URLSearchParams(params.toString());
    writeFilterParams(query, next, defaultYear);
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const effective = effectivePeriodFilters(filters);
  const selectedYears = filterTokens(effective.year).map(Number).filter((value) => Number.isInteger(value));
  const payload = {
    company: effective.company,
    customer: effective.customer,
    month: effective.month,
    quarter: effective.quarter,
    year: effective.year,
    startDate: effective.startDate ? formatFilterDate(effective.startDate) : undefined,
    endDate: effective.endDate ? formatFilterDate(effective.endDate) : undefined,
    monthlyYear: selectedYears.length > 0 ? Math.max(...selectedYears) : defaultYear,
  };
  const report = useQuery({
    queryKey: ["revenue-dashboard", payload],
    queryFn: () => getRevenueDashboard(payload),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  return (
    <ManagementReport
      companies={companies}
      customers={customers}
      years={years}
      filters={filters}
      onChange={(key, value) => commit(applyFilterChange(filters, key, value))}
      onPreset={(preset: DashboardPreset) =>
        commit({ ...filters, ...presetPatch(preset, new Date()) })
      }
      onReset={() => commit(defaultFilters(defaultYear))}
      summary={report.data?.summary ?? null}
      comparison={report.data?.comparison ?? null}
      records={report.data?.records ?? []}
      lines={report.data?.lines ?? []}
      monthly={report.data?.monthly ?? []}
      loading={report.isPending}
      isFetching={report.isFetching}
      error={report.error instanceof Error ? report.error.message : report.error ? "The report could not be loaded." : null}
      lastUpdated={report.dataUpdatedAt ? new Date(report.dataUpdatedAt) : null}
      onRefresh={() => {
        void report.refetch();
      }}
    />
  );
}
