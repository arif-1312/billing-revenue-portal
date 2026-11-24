"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarIcon,
  ChevronDown,
  IndianRupee,
  Layers3,
  Minus,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import moment from "moment";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  filterProjectData,
  getBillingDetailsByMonth,
  getCostDetailsByMonth,
} from "@/lib/actions/project";
import { TotalBilledChart } from "./total-billed-revenue-month";
import { TotalCostChart } from "./total-cost-revenue-month";

const ALL_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_FULL = [
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

const now = new Date();
const currentFY =
  now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();

const years = Array.from(
  { length: currentFY - 2009 },
  (_, index) => currentFY - index,
);

type Filters = {
  company: string;
  project: string;
  startDate?: Date;
  endDate?: Date;
  month: string;
  year: string;
};

type Company = {
  id: string;
  name: string;
};

type ProjectOption = {
  id: string;
  projectName: string;
};

type ProjectMonthlyPL = {
  billableAmount?: number | string | null;
  billedAmount?: number | string | null;
  fms?: number | string | null;
  spare?: number | string | null;
  otherCost?: string | null;
};

type ProjectRow = {
  company: { name: string };
  projectName: string;
  poValue: number | string;
  projectedProfit?: number | string | null;
  monthlyPLs: ProjectMonthlyPL[];
};

type BillingDetail = {
  month: number;
  year: number;
  companyName: string;
  projectName: string;
  billed: number | string;
};

type CostDetail = {
  month: number;
  year: number;
  companyName: string;
  projectName: string;
  billedAmount: number | string;
  fms: number | string;
  spare: number | string;
  other?: unknown;
  totalCost?: number;
  profitPercentage?: number;
};

type SelectedMonth = {
  month: number;
  year: number;
};

type DashboardTotals = {
  totalPOValue: number;
  totalBilledValue: number;
  totalBillableAmount: number;
  totalCostValue: number;
  totalFMSValue: number;
  totalSpareValue: number;
  totalMiscCostValue: number;
  totalResourceCount: number;
  totalProfit: number;
  totalProjectedProfit: number;
};

type DashboardResponse = {
  totalPOValue: number | string;
  totalBilledValue: number | string;
  totalBillableAmount: number | string;
  totalCostValue: number | string;
  totalFMSValue: number | string;
  totalSpareValue: number | string;
  totalMiscCostValue?: number | string;
  totalOtherCostValue?: number | string;
  totalResourceCount: number | string;
  totalProfit: number | string;
  totalProjectedProfit: number | string;
  data: ProjectRow[];
};

type PLDashboardProps = {
  companies: Company[];
  projects: ProjectOption[];
};

function formatFinancialYearLabel(year: string) {
  if (!year || year === "all") return "All Years";

  const numericYear = Number(year);
  if (Number.isNaN(numericYear)) return year;

  return `FY ${numericYear}-${String(numericYear + 1).slice(-2)}`;
}

function getFilterSummary(filters: Filters) {
  const parts = [formatFinancialYearLabel(filters.year)];

  if (filters.month !== "all") {
    parts.push(MONTH_FULL[Number(filters.month)]);
  }

  if (filters.company !== "all") {
    parts.push("Company filter");
  }

  if (filters.project !== "all") {
    parts.push("Project filter");
  }

  return parts.join(" · ");
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatCurrency(value: number | string | null | undefined) {
  return formatNumber(value);
}

function getMonthDisplay(month: string) {
  if (month === "all") return "All Months";
  return MONTH_FULL[Number(month)] ?? "Unknown";
}

function getOtherCostTotal(value: unknown) {
  if (typeof value !== "string") return 0;

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return 0;

    return parsed.reduce((sum, entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        "value" in entry
      ) {
        return sum + Number(entry.value || 0);
      }

      return sum;
    }, 0);
  } catch {
    return 0;
  }
}

function TopBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-40 h-px bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-400" />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {children}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function StatusBadge({ value, target }: { value: number; target: number }) {
  const diff = value - target;

  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        <Minus className="h-3 w-3" />
        On target
      </span>
    );
  }

  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
        <ArrowUpRight className="h-3 w-3" />
        {value.toFixed(1)}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
      <ArrowDownRight className="h-3 w-3" />
      {value.toFixed(1)}%
    </span>
  );
}

function MetricCard({
  description,
  label,
  value,
  icon: Icon,
  tone,
  suffix,
  monthLabel,
  yearLabel,
}: {
  description: string;
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: string;
  suffix?: string;
  monthLabel: string;
  yearLabel: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={cn(
          "absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
          tone,
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2 item-start">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xm font-bold tracking-tight text-slate-700">
              {label}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-full border border-blue-900 bg-blue-900 px-2.5 py-1 text-[11px] font-bold text-white">
              {monthLabel}
            </span>

            <span className="text-xs font-bold text-slate-500">/</span>

            <span className="rounded-full border border-blue-900 bg-blue-900 px-2.5 py-1 text-[11px] font-bold text-white">
              {yearLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="font-mono text-lg font-semibold tracking-tight text-slate-950 tabular-nums sm:text-xl">
              {value}
            </p>
            {suffix ? (
              <span className="text-xs font-semibold text-slate-400">
                {suffix}
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-slate-400">{description}</p>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-3 shadow-sm shrink-0",
            tone.replace("bg-", "border-").replace("500", "200"),
            tone.replace("bg-", "bg-").replace("500", "50"),
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              tone.replace("bg-", "text-").replace("500", "600"),
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function PLDashboardComponent({
  companies,
  projects,
}: PLDashboardProps) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filteredValues, setFilteredValues] = useState<ProjectRow[]>([]);
  const [billingDetails, setBillingDetails] = useState<BillingDetail[]>([]);
  const [costDetails, setCostDetails] = useState<CostDetail[]>([]);
  const [drilldown, setDrilldown] = useState<{
    filterKey: string;
    activeTable: "billing" | "cost" | null;
    selectedMonth: SelectedMonth | null;
  }>({ filterKey: "", activeTable: null, selectedMonth: null });
  const [totalValues, setTotalValues] = useState<DashboardTotals>({
    totalPOValue: 0,
    totalBilledValue: 0,
    totalBillableAmount: 0,
    totalCostValue: 0,
    totalFMSValue: 0,
    totalSpareValue: 0,
    totalMiscCostValue: 0,
    totalResourceCount: 0,
    totalProfit: 0,
    totalProjectedProfit: 0,
  });
  const [filters, setFilters] = useState<Filters>({
    company: "all",
    project: "all",
    startDate: undefined,
    endDate: undefined,
    month: "all",
    year: currentFY.toString(),
  });
  const filterKey = JSON.stringify(filters);
  const activeTable = drilldown.filterKey === filterKey ? drilldown.activeTable : null;
  const selectedMonth = drilldown.filterKey === filterKey ? drilldown.selectedMonth : null;
  const setActiveTable = (value: "billing" | "cost" | null) => {
    setDrilldown((current) => ({
      filterKey,
      activeTable: value,
      selectedMonth: current.filterKey === filterKey ? current.selectedMonth : null,
    }));
  };
  const setSelectedMonth = (value: SelectedMonth | null) => {
    setDrilldown((current) => ({
      filterKey,
      activeTable: current.filterKey === filterKey ? current.activeTable : null,
      selectedMonth: value,
    }));
  };

  const updateFilter = (key: keyof Filters, value: Filters[keyof Filters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      company: "all",
      project: "all",
      startDate: undefined,
      endDate: undefined,
      month: "all",
      year: currentFY.toString(),
    });
    setActiveTable(null);
    setSelectedMonth(null);
  };
  const clearDrillDown = () => {
    setActiveTable(null);
    setSelectedMonth(null);
  };

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      setLoading(true);

      try {
        const result = (await filterProjectData(filters)) as DashboardResponse;

        if (!active) return;

        setFilteredValues(result.data ?? []);
        setTotalValues({
          totalPOValue: Number(result.totalPOValue || 0),
          totalBilledValue: Number(result.totalBilledValue || 0),
          totalBillableAmount: Number(result.totalBillableAmount || 0),
          totalCostValue: Number(result.totalCostValue || 0),
          totalFMSValue: Number(result.totalFMSValue || 0),
          totalSpareValue: Number(result.totalSpareValue || 0),
          totalMiscCostValue: Number(result.totalMiscCostValue || 0),
          totalResourceCount: Number(result.totalResourceCount || 0),
          totalProfit: Number(result.totalProfit || 0),
          totalProjectedProfit: Number(result.totalProjectedProfit || 0),
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    if (!selectedMonth) return;

    let active = true;
    const currentSelectedMonth = selectedMonth;

    async function loadDetails() {
      const { month, year } = currentSelectedMonth;

      const billing = (await getBillingDetailsByMonth(
        {
          month,
          year,
          project: filters.project,
          company: filters.company,
        },
        filters,
      )) as BillingDetail[];

      const cost = (await getCostDetailsByMonth(
        {
          month,
          year,
          project: filters.project,
          company: filters.company,
        },
        filters,
      )) as CostDetail[];

      if (!active) return;

      setBillingDetails(billing ?? []);
      setCostDetails(
        (cost ?? []).map((item) => {
          const other = getOtherCostTotal(item.other);
          const totalCost =
            Number(item.fms || 0) + Number(item.spare || 0) + other;
          const billedAmount = Number(item.billedAmount || 0);
          const profitPercentage =
            billedAmount > 0
              ? ((billedAmount - totalCost) / billedAmount) * 100
              : 0;

          return {
            ...item,
            other,
            totalCost,
            profitPercentage,
          };
        }),
      );
    }

    void loadDetails();

    return () => {
      active = false;
    };
  }, [filters, selectedMonth]);

  if (!hydrated) return null;

  const activeFilterCount = [
    filters.company !== "all",
    filters.project !== "all",
    filters.month !== "all",
    filters.year !== currentFY.toString(),
    Boolean(filters.startDate),
    Boolean(filters.endDate),
  ].filter(Boolean).length;
  const metricMonthLabel = getMonthDisplay(filters.month);
  const metricYearLabel = formatFinancialYearLabel(filters.year);

  const metrics = [
    {
      label: "Total Purchased Order Value",
      description: "Combined PO value across the current selection",
      value: formatCurrency(totalValues.totalPOValue),
      icon: IndianRupee,
      tone: "bg-violet-500",
    },
    {
      label: "Total Billable Amount",
      description: "Total amount planned for billing",
      value: formatCurrency(totalValues.totalBillableAmount),
      icon: Layers3,
      tone: "bg-sky-500",
    },
    {
      label: "Total Billed Revenue",
      description: "Revenue already billed for the selected view",
      value: formatCurrency(totalValues.totalBilledValue),
      icon: TrendingUp,
      tone: "bg-emerald-500",
    },
    {
      label: "Total Operating Cost",
      description: "All tracked delivery and support costs",
      value: formatCurrency(totalValues.totalCostValue),
      icon: TrendingDown,
      tone: "bg-rose-500",
    },
    {
      label: "Total Resource Count",
      description: "Resources contributing across active projects",
      value: formatNumber(totalValues.totalResourceCount),
      icon: Users,
      tone: "bg-amber-500",
    },
    {
      label: "Total FMS Cost",
      description: "Field maintenance service cost total",
      value: formatCurrency(totalValues.totalFMSValue),
      icon: Wrench,
      tone: "bg-blue-500",
    },
    {
      label: "Total Spare Cost",
      description: "Spare parts cost across all records",
      value: formatCurrency(totalValues.totalSpareValue),
      icon: BarChart3,
      tone: "bg-indigo-500",
    },
    {
      label: "Total Miscellaneous Cost",
      description: "Additional costs outside main categories",
      value: formatCurrency(totalValues.totalMiscCostValue),
      icon: BarChart3,
      tone: "bg-orange-500",
    },
    {
      label: "Current Gross Margin",
      description: "Current GM percentage from billed vs cost",
      value: formatNumber(totalValues.totalProfit),
      icon: TrendingUp,
      tone: "bg-teal-500",
      suffix: "%",
    },
  ];

  return (
    <>
      <style>{`
        .pl-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .pl-scroll::-webkit-scrollbar-track { background: transparent; }
        .pl-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
      `}</style>

      <TopBar />

      <div className="min-h-screen space-y-6 bg-[linear-gradient(180deg,#f8fafc_0%,#f4f7fb_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_55%,_#eef5ff)] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">
                  Financial Intelligence
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Profit &amp; Loss Dashboard
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                  Review billed revenue, operating cost, gross margin, and
                  project-level profitability with a cleaner reporting layout
                  and stronger visual hierarchy.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-end">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  {getFilterSummary(filters)}
                </div>
                <p className="text-xs font-medium tracking-wide text-slate-400">
                  Last refreshed {format(new Date(), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setFiltersOpen((value) => !value)}
            className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-slate-50 sm:px-7"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-500">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Filters</p>
                <p className="text-xs text-slate-500">
                  Refine by company, project, date, month, and year
                </p>
              </div>

              {activeFilterCount > 0 ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </div>

            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform duration-200",
                filtersOpen && "rotate-180",
              )}
            />
          </button>

          {filtersOpen ? (
            <div className="border-t border-slate-100 px-6 py-6 sm:px-7">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7 2xl:items-end">
                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Company
                  </Label>
                  <Select
                    value={filters.company}
                    onValueChange={(value) => updateFilter("company", value)}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-slate-200 bg-slate-50 text-sm">
                      <SelectValue placeholder="All Companies" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">All Companies</SelectItem>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Project
                  </Label>
                  <Select
                    value={filters.project}
                    onValueChange={(value) => updateFilter("project", value)}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-slate-200 bg-slate-50 text-sm">
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    From Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full min-w-0 justify-start overflow-hidden rounded-2xl border-slate-200 bg-slate-50 text-left text-sm font-normal text-slate-700"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        {filters.startDate
                          ? format(filters.startDate, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      avoidCollisions={false}
                      className="w-auto rounded-2xl p-0"
                      side="bottom"
                      sideOffset={8}
                    >
                      <Calendar
                        mode="single"
                        selected={filters.startDate}
                        onSelect={(date) => updateFilter("startDate", date)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    To Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 w-full min-w-0 justify-start overflow-hidden rounded-2xl border-slate-200 bg-slate-50 text-left text-sm font-normal text-slate-700"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
                        {filters.endDate
                          ? format(filters.endDate, "PPP")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      avoidCollisions={false}
                      className="w-auto rounded-2xl p-0"
                      side="bottom"
                      sideOffset={8}
                    >
                      <Calendar
                        mode="single"
                        selected={filters.endDate}
                        onSelect={(date) => updateFilter("endDate", date)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Month
                  </Label>
                  <Select
                    value={filters.month}
                    onValueChange={(value) => updateFilter("month", value)}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-slate-200 bg-slate-50 text-sm">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">All Months</SelectItem>
                      <SelectGroup>
                        {ALL_MONTHS.map((month, index) => (
                          <SelectItem key={month} value={index.toString()}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Year
                  </Label>
                  <Select
                    value={filters.year}
                    onValueChange={(value) => updateFilter("year", value)}
                  >
                    <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-slate-200 bg-slate-50 text-sm">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectGroup>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {formatFinancialYearLabel(year.toString())}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0 md:col-span-2 xl:col-span-3 2xl:col-span-1">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="h-10 w-full rounded-2xl border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                  >
                    <X className="mr-2 h-4 w-4 shrink-0" />
                    Reset Filters
                  </Button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-full border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-bold text-white">
                  Viewing {filteredValues.length} projects
                </div>

                <div className="rounded-full border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-bold text-white">
                  Period: {getMonthDisplay(filters.month)}
                </div>

                <div className="rounded-full border border-blue-900 bg-blue-900 px-4 py-2 text-sm font-bold text-white">
                  Year: {formatFinancialYearLabel(filters.year)}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionLabel>Key metrics</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                description={metric.description}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
                tone={metric.tone}
                suffix={metric.suffix}
                monthLabel={metricMonthLabel}
                yearLabel={metricYearLabel}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Project breakdown</SectionLabel>
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  Profit &amp; Loss Project View
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Green rows are meeting projected GM targets, while red rows
                  need attention.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs font-medium">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  On target
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Below target
                </span>
              </div>
            </div>

            <div className="overflow-x-auto pl-scroll">
              <table className="min-w-[1180px] w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100">
                    {[
                      "Period",
                      "Company",
                      "Project",
                      "PO Value",
                      "Billable",
                      "Billed Revenue",
                      "FMS Cost",
                      "Spare Cost",
                      "Other Cost",
                      "Total Cost",
                      "GM %",
                      "Projected %",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredValues.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-5 py-14 text-center text-sm font-medium text-slate-400"
                      >
                        {loading
                          ? "Loading dashboard data..."
                          : "No data found for the selected filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredValues.map((project, index) => {
                      let totalBilledValue = 0;
                      let totalCostValue = 0;
                      let totalFmsValue = 0;
                      let totalSpareValue = 0;
                      let totalOtherCost = 0;
                      let totalBillableValue = 0;

                      for (const cycle of project.monthlyPLs) {
                        totalBillableValue += Number(cycle.billableAmount || 0);

                        if (
                          Number(cycle.billedAmount || 0) !== 0 &&
                          (Number(cycle.fms || 0) !== 0 ||
                            Number(cycle.spare || 0) !== 0)
                        ) {
                          totalBilledValue += Number(cycle.billedAmount || 0);
                          totalFmsValue += Number(cycle.fms || 0);
                          totalSpareValue += Number(cycle.spare || 0);
                          totalCostValue +=
                            Number(cycle.spare || 0) + Number(cycle.fms || 0);

                          const otherCost = getOtherCostTotal(cycle.otherCost);
                          totalOtherCost += otherCost;
                          totalCostValue += otherCost;
                        }
                      }

                      const profitNum =
                        totalBilledValue > 0
                          ? ((totalBilledValue - totalCostValue) /
                              totalBilledValue) *
                            100
                          : 0;
                      const projectedValue = Number(
                        project.projectedProfit || 0,
                      );
                      const onTarget = profitNum >= projectedValue;
                      const period =
                        filters.month === "all"
                          ? formatFinancialYearLabel(filters.year)
                          : `${moment().month(filters.month).format("MMM")} · ${formatFinancialYearLabel(filters.year)}`;

                      return (
                        <tr
                          key={`${project.projectName}-${index}`}
                          className={cn(
                            "border-b border-slate-100 transition-colors",
                            onTarget
                              ? "bg-emerald-50/50 hover:bg-emerald-50"
                              : "bg-rose-50/40 hover:bg-rose-50",
                          )}
                        >
                          <td className="px-5 py-4 font-mono text-xs font-medium text-slate-500 tabular-nums">
                            {period}
                          </td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            {project.company.name}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                            {project.projectName}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-700 tabular-nums">
                            {formatCurrency(project.poValue)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-700 tabular-nums">
                            {formatCurrency(totalBillableValue)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-950 tabular-nums">
                            {formatCurrency(totalBilledValue)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(totalFmsValue)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(totalSpareValue)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(totalOtherCost)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-950 tabular-nums">
                            {formatCurrency(totalCostValue)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge
                              value={profitNum}
                              target={projectedValue}
                            />
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-500 tabular-nums">
                            {projectedValue}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Monthly trends</SectionLabel>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Total Billed Revenue
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Click a bar to drill into that month
                  </p>
                </div>
                <span className="h-3 w-3 rounded-full bg-indigo-400 shadow-sm shadow-indigo-200" />
              </div>
              <div className="p-5">
                <TotalBilledChart
                  activeSelection={
                    activeTable === "billing" ? selectedMonth : null
                  }
                  filters={filters}
                  onMonthClick={(data: SelectedMonth) => {
                    setSelectedMonth(data);
                    setActiveTable("billing");
                  }}
                  onClear={clearDrillDown}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Total Operating Cost
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Click a bar to drill into that month
                  </p>
                </div>
                <span className="h-3 w-3 rounded-full bg-rose-400 shadow-sm shadow-rose-200" />
              </div>
              <div className="p-5">
                <TotalCostChart
                  activeSelection={
                    activeTable === "cost" ? selectedMonth : null
                  }
                  filters={filters}
                  onMonthClick={(data: SelectedMonth) => {
                    setSelectedMonth(data);
                    setActiveTable("cost");
                  }}
                  onClear={clearDrillDown}
                />
              </div>
            </div>
          </div>
        </section>

        {activeTable === "billing" ? (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Billing Amount Detail View
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Project-level billing breakdown for the selected month
                  </p>
                </div>
              </div>
              <button
                onClick={clearDrillDown}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto pl-scroll">
              <table className="min-w-[720px] w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100">
                    {[
                      "Month",
                      "Year",
                      "Company",
                      "Project",
                      "Billing Amount",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billingDetails.length > 0 ? (
                    billingDetails.map((item, index) => (
                      <tr
                        key={`${item.projectName}-${index}`}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {moment()
                            .month(item.month - 1)
                            .format("MMMM")}
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-slate-500 tabular-nums">
                          {item.year}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-slate-700">
                          {item.companyName}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                          {item.projectName}
                        </td>
                        <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-950 tabular-nums">
                          {formatCurrency(item.billed)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-12 text-center text-sm font-medium text-slate-400"
                      >
                        No billing records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTable === "cost" ? (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                    Total Cost Detail View
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Cost breakdown with GM percentage for the selected month
                  </p>
                </div>
              </div>
              <button
                onClick={clearDrillDown}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto pl-scroll">
              <table className="min-w-[980px] w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100">
                    {[
                      "Month",
                      "Year",
                      "Company",
                      "Project",
                      "Billed",
                      "FMS",
                      "Spare",
                      "Other",
                      "Total Cost",
                      "GM %",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costDetails.length > 0 ? (
                    costDetails.map((item, index) => {
                      const gm = Number(item.profitPercentage || 0);

                      return (
                        <tr
                          key={`${item.projectName}-${index}`}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                        >
                          <td className="px-5 py-4 text-sm text-slate-700">
                            {moment()
                              .month(item.month - 1)
                              .format("MMMM")}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-500 tabular-nums">
                            {item.year}
                          </td>
                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            {item.companyName}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                            {item.projectName}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-700 tabular-nums">
                            {formatCurrency(item.billedAmount)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(item.fms)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(item.spare)}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm text-slate-600 tabular-nums">
                            {formatCurrency(Number(item.other ?? 0))}
                          </td>
                          <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-950 tabular-nums">
                            {formatCurrency(item.totalCost ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                gm >= 20
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700",
                              )}
                            >
                              {gm >= 20 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" />
                              )}
                              {gm.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-12 text-center text-sm font-medium text-slate-400"
                      >
                        No cost records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
