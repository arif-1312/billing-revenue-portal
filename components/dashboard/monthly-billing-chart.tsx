"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import {
  getMonthlyBillingData,
  getRevenueDetailsByMonth,
  type RevenueMonthDetail,
} from "@/lib/actions/dashboard";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type SeriesKey = "billing" | "payment";

type ChartData = {
  billing: number;
  calendarYear: number;
  financialYear: number;
  month: string;
  monthIndex: number;
  payment: number;
};

type Filters = {
  company: string;
  customer: string;
  startDate?: Date;
  endDate?: Date;
  month: string;
  quarter: string;
  year: string;
};

type SelectedMonth = {
  calendarYear: number;
  financialYear: number;
  label: string;
  month: number;
  series: SeriesKey;
};

type Props = {
  filters: Filters;
};

type TooltipProps = {
  accentClass: string;
  active?: boolean;
  label: string;
  payload?: Array<{
    payload: ChartData;
  }>;
  series: SeriesKey;
};

type BarLabelProps = {
  height?: number;
  value?: number;
  width?: number;
  x?: number;
  y?: number;
};

type TrendCardProps = {
  activeSelection: SelectedMonth | null;
  data: ChartData[];
  emptyHint: string;
  emptyLabel: string;
  indicatorClassName: string;
  indicatorDotClassName: string;
  indicatorTextClassName: string;
  loading: boolean;
  onClearSelection: () => void;
  onMonthClick: (selection: SelectedMonth) => void;
  series: SeriesKey;
  title: string;
  tooltipAccentClass: string;
};

type SeriesMeta = {
  activeFill: string;
  cursor: string;
  detailDescription: string;
  detailTitle: string;
  emptyHint: string;
  emptyLabel: string;
  gradientEnd: string;
  gradientStart: string;
  hoverFill: string;
  indicatorClassName: string;
  indicatorDotClassName: string;
  indicatorTextClassName: string;
  title: string;
  tooltipAccentClass: string;
};

const months = [
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

const chartConfig = {
  billing: {
    label: "Billing Generated",
    color: "hsl(24 95% 53%)",
  },
  payment: {
    label: "Payment Received",
    color: "hsl(160 84% 39%)",
  },
} satisfies ChartConfig;

const seriesMeta: Record<SeriesKey, SeriesMeta> = {
  billing: {
    activeFill: "#C2410C",
    cursor: "rgba(249, 115, 22, 0.05)",
    detailDescription:
      "Billing-cycle level revenue generated for the selected month.",
    detailTitle: "Billing Generated Detail View",
    emptyHint: "Light bars indicate months with no billing",
    emptyLabel: "No billing data found for this selection.",
    gradientEnd: "#EA580C",
    gradientStart: "#FB923C",
    hoverFill: "#F97316",
    indicatorClassName:
      "border-orange-100 bg-orange-50 text-orange-700",
    indicatorDotClassName: "bg-orange-400",
    indicatorTextClassName: "text-orange-600",
    title: "Monthly Billing Generated",
    tooltipAccentClass: "text-orange-600",
  },
  payment: {
    activeFill: "#047857",
    cursor: "rgba(16, 185, 129, 0.05)",
    detailDescription:
      "Collected payment entries posted in the selected month.",
    detailTitle: "Payment Received Detail View",
    emptyHint:
      "Light bars indicate months with no collections",
    emptyLabel: "No payment data found for this selection.",
    gradientEnd: "#059669",
    gradientStart: "#34D399",
    hoverFill: "#10B981",
    indicatorClassName:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
    indicatorDotClassName: "bg-emerald-400",
    indicatorTextClassName: "text-emerald-600",
    title: "Monthly Payment Received",
    tooltipAccentClass: "text-emerald-600",
  },
};

const currentDate = new Date();
const currentFY =
  currentDate.getMonth() < 3
    ? currentDate.getFullYear() - 1
    : currentDate.getFullYear();

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFinancialYearLabel(year: number) {
  return `FY ${year}-${String(year + 1).slice(-2)}`;
}

function formatFinancialMonthLabel(
  month: string,
  financialYear: number,
) {
  return `${month} / ${formatFinancialYearLabel(
    financialYear,
  )}`;
}

function getCalendarYearFromMonthIndex(
  financialYear: number,
  monthIndex: number,
) {
  return monthIndex <= 8
    ? financialYear
    : financialYear + 1;
}

function SkeletonBars() {
  const widths = [
    70, 54, 85, 44, 92, 58, 76, 48, 82, 46, 68, 88,
  ];

  return (
    <div className="mt-2 space-y-3 px-1">
      {widths.map((width, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="h-3 w-8 shrink-0 animate-pulse rounded bg-slate-100" />
          <div
            className="h-7 animate-pulse rounded-xl bg-slate-100"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function StatCard({
  accent,
  icon: Icon,
  label,
  sublabel,
  value,
}: {
  accent?: string;
  icon?: React.ElementType;
  label: string;
  sublabel: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5 px-4 py-4 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        {Icon ? (
          <Icon className={cn("h-3.5 w-3.5", accent)} />
        ) : null}
        <p
          className={cn(
            "font-mono text-[15px] font-semibold tracking-tight tabular-nums",
            accent ?? "text-slate-950",
          )}
        >
          {value}
        </p>
      </div>
      <p className="truncate text-[11px] font-medium text-slate-400">
        {sublabel}
      </p>
    </div>
  );
}

function BarValueLabel({
  height,
  value,
  width,
  x,
  y,
}: BarLabelProps) {
  if (
    !value ||
    value === 0 ||
    !width ||
    width < 56 ||
    x === undefined ||
    y === undefined ||
    !height
  ) {
    return null;
  }

  return (
    <text
      x={x + width - 10}
      y={y + height / 2}
      fill="rgba(255,255,255,0.96)"
      textAnchor="end"
      dominantBaseline="middle"
      fontFamily="var(--font-geist-mono)"
      fontSize={11}
      fontWeight={600}
    >
      {formatCompactCurrency(value)}
    </text>
  );
}

function CustomTooltip({
  accentClass,
  active,
  label,
  payload,
  series,
}: TooltipProps) {
  if (!active || !payload?.length) return null;

  const datum = payload[0].payload;

  return (
    <div className="min-w-[200px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold tracking-tight text-slate-950">
        {formatFinancialMonthLabel(
          datum.month,
          datum.financialYear,
        )}
      </p>
      <div className="mt-2 flex items-center justify-between gap-6">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            accentClass,
          )}
        >
          {formatCurrency(datum[series])}
        </span>
      </div>
    </div>
  );
}

function TrendCard({
  activeSelection,
  data,
  emptyHint,
  emptyLabel,
  indicatorClassName,
  indicatorDotClassName,
  indicatorTextClassName,
  loading,
  onClearSelection,
  onMonthClick,
  series,
  title,
  tooltipAccentClass,
}: TrendCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<
    number | null
  >(null);

  const chartStats = useMemo(() => {
    const values = data
      .map((item) => item[series])
      .filter((value) => value > 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = values.length ? Math.max(...values) : 0;
    const average = values.length ? total / values.length : 0;
    const lastTwo = values.slice(-2);
    const trend =
      lastTwo.length === 2
        ? ((lastTwo[1] - lastTwo[0]) / (lastTwo[0] || 1)) * 100
        : null;
    const peakMonth =
      data.find((item) => item[series] === peak)?.month ?? "-";

    return { average, peak, peakMonth, total, trend, values };
  }, [data, series]);

  const TrendIcon =
    chartStats.trend === null
      ? Minus
      : chartStats.trend >= 0
        ? TrendingUp
        : TrendingDown;

  const trendTone =
    chartStats.trend === null
      ? "text-slate-400"
      : chartStats.trend >= 0
        ? "text-emerald-600"
        : "text-rose-600";

  const meta = seriesMeta[series];
  const financialYear = data[0]?.financialYear;
  const isEmpty = chartStats.values.length === 0;
  const activePoint =
    activeSelection?.series === series
      ? data.find(
        (item) =>
          item.monthIndex === activeSelection.month &&
          item.financialYear ===
          activeSelection.financialYear,
      ) ?? null
      : null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "rounded-2xl border p-3 shadow-sm",
              indicatorClassName,
            )}
          >
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              {title}
            </h3>
            <p className="text-sm text-slate-500">
              Click a bar to open the month-level
              revenue breakdown
            </p>
          </div>
        </div>

        {financialYear ? (
          <div
            className={cn(
              "rounded-2xl border px-3 py-2 text-sm font-medium",
              indicatorClassName,
            )}
          >
            {formatFinancialYearLabel(financialYear)}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 border-b border-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-slate-100 sm:border-b-0 sm:border-r">
          <StatCard
            label="Total"
            value={formatCompactCurrency(chartStats.total)}
            sublabel={formatCurrency(chartStats.total)}
          />
        </div>
        <div className="border-b border-slate-100 xl:border-b-0 sm:border-r">
          <StatCard
            label="Monthly Average"
            value={formatCompactCurrency(chartStats.average)}
            sublabel={`Across ${chartStats.values.length} active months`}
          />
        </div>
        <div className="border-b border-slate-100 sm:border-b-0 sm:border-r">
          <StatCard
            label="Peak Month"
            value={chartStats.peakMonth}
            sublabel={formatCompactCurrency(chartStats.peak)}
          />
        </div>
        <StatCard
          accent={trendTone}
          icon={TrendIcon}
          label="MoM Trend"
          value={
            chartStats.trend === null
              ? "-"
              : `${chartStats.trend >= 0 ? "+" : ""}${chartStats.trend.toFixed(1)}%`
          }
          sublabel="Last two active months"
        />
      </div>

      <div className="px-4 py-5 sm:px-5">
        {loading ? (
          <SkeletonBars />
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              {emptyLabel}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different year or adjust the
              dashboard filters.
            </p>
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="w-full"
              style={{ height: data.length * 40 + 24 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{
                    top: 4,
                    right: 18,
                    bottom: 4,
                    left: 6,
                  }}
                  barCategoryGap="26%"
                  onClick={(state) => {
                    if (!state?.activePayload?.length) return;

                    const payload =
                      state.activePayload[0]
                        .payload as ChartData;

                    onMonthClick({
                      calendarYear: payload.calendarYear,
                      financialYear: payload.financialYear,
                      label: formatFinancialMonthLabel(
                        payload.month,
                        payload.financialYear,
                      ),
                      month: payload.monthIndex,
                      series,
                    });
                  }}
                  onMouseMove={(state) => {
                    if (
                      state?.activeTooltipIndex !== undefined
                    ) {
                      setHoveredIndex(
                        state.activeTooltipIndex,
                      );
                    }
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <defs>
                    <linearGradient
                      id={`${series}Grad`}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="0"
                    >
                      <stop
                        offset="0%"
                        stopColor={meta.gradientStart}
                      />
                      <stop
                        offset="100%"
                        stopColor={meta.gradientEnd}
                      />
                    </linearGradient>
                  </defs>

                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="month"
                    type="category"
                    width={38}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval={0}
                    tick={{
                      fill: "#64748b",
                      fontFamily: "var(--font-geist-sans)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />

                  <ChartTooltip
                    cursor={{
                      fill: meta.cursor,
                      rx: 8,
                    }}
                    content={
                      <CustomTooltip
                        accentClass={tooltipAccentClass}
                        label={chartConfig[series].label}
                        series={series}
                      />
                    }
                  />

                  <Bar
                    dataKey={series}
                    maxBarSize={28}
                    radius={[0, 8, 8, 0]}
                    style={{ cursor: "pointer" }}
                  >
                    {data.map((entry, index) => {
                      const value = entry[series];
                      const isActive =
                        activeSelection?.series === series &&
                        activeSelection.month ===
                        entry.monthIndex &&
                        activeSelection.financialYear ===
                        entry.financialYear;
                      const isHovered =
                        hoveredIndex === index;
                      const isZero = value === 0;

                      let fill = `url(#${series}Grad)`;
                      let opacity = 1;

                      if (isZero) {
                        fill = "#E2E8F0";
                        opacity = 0.8;
                      } else if (isActive) {
                        fill = meta.activeFill;
                      } else if (isHovered) {
                        fill = meta.hoverFill;
                      }

                      return (
                        <Cell
                          key={`${series}-${entry.month}-${index}`}
                          fill={fill}
                          opacity={opacity}
                        />
                      );
                    })}

                    <LabelList
                      dataKey={series}
                      position="insideRight"
                      content={<BarValueLabel />}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {data.some((item) => item[series] === 0) ? (
              <p className="mt-3 text-right text-[11px] font-medium text-slate-400">
                {emptyHint}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="mx-4 mb-4 space-y-3 sm:mx-5">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              indicatorDotClassName,
            )}
          />
          <span className="text-slate-600">
            Showing{" "}
            <span
              className={cn(
                "font-semibold",
                indicatorTextClassName,
              )}
            >
              {chartConfig[series].label.toLowerCase()}
            </span>{" "}
            across the selected financial year.
          </span>
        </div>

        {activePoint ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
              indicatorClassName,
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                indicatorDotClassName,
              )}
            />
            <span className="text-slate-700">
              Drill-down loaded for{" "}
              <span
                className={cn(
                  "font-semibold",
                  indicatorTextClassName,
                )}
              >
                {formatFinancialMonthLabel(
                  activePoint.month,
                  activePoint.financialYear,
                )}
              </span>
            </span>
            <button
              onClick={onClearSelection}
              className="ml-auto text-sm font-semibold text-slate-400 transition-colors hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MonthlyBillingChartCard({
  filters,
}: Props) {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [details, setDetails] = useState<
    RevenueMonthDetail[]
  >([]);
  const [selectedMonth, setSelectedMonth] =
    useState<SelectedMonth | null>(null);

  const selectedYear =
    filters.year && filters.year !== "all"
      ? Number(filters.year)
      : currentFY;

  useEffect(() => {
    let active = true;

    async function loadData() {
      setChartLoading(true);

      try {
        const data = await getMonthlyBillingData(
          selectedYear,
          {
            company: filters.company,
            customer: filters.customer,
            endDate: filters.endDate,
            month: filters.month,
            quarter: filters.quarter,
            startDate: filters.startDate,
          },
        );

        if (!active) return;

        const safeData: ChartData[] = months.map(
          (month, index) => {
            const item = data.find(
              (entry: { month: string }) =>
                entry.month === month,
            );

            return {
              billing: Number(item?.billing ?? 0),
              calendarYear:
                getCalendarYearFromMonthIndex(
                  selectedYear,
                  index,
                ),
              financialYear: selectedYear,
              month,
              monthIndex: index,
              payment: Number(item?.payment ?? 0),
            };
          },
        );

        setChartData(
          safeData.sort(
            (left, right) =>
              left.monthIndex - right.monthIndex,
          ),
        );
      } catch (error) {
        if (active) {
          console.error("Chart load error:", error);
          setChartData([]);
        }
      } finally {
        if (active) {
          setChartLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [
    filters.company,
    filters.customer,
    filters.endDate,
    filters.month,
    filters.quarter,
    filters.startDate,
    selectedYear,
  ]);

  useEffect(() => {
    setSelectedMonth(null);
    setDetails([]);
  }, [
    filters.company,
    filters.customer,
    filters.endDate,
    filters.month,
    filters.quarter,
    filters.startDate,
    selectedYear,
  ]);

  useEffect(() => {
    if (!selectedMonth) return;

    let active = true;
    const currentSelection = selectedMonth;

    async function loadDetails() {
      setDetailLoading(true);

      try {
        const data = await getRevenueDetailsByMonth(
          {
            month: currentSelection.month,
            series: currentSelection.series,
            year: currentSelection.financialYear,
          },
          {
            company: filters.company,
            customer: filters.customer,
            endDate: filters.endDate,
            month: filters.month,
            quarter: filters.quarter,
            startDate: filters.startDate,
          },
        );

        if (!active) return;

        setDetails(data ?? []);
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetails();

    return () => {
      active = false;
    };
  }, [
    filters.company,
    filters.customer,
    filters.endDate,
    filters.month,
    filters.quarter,
    filters.startDate,
    selectedMonth,
  ]);

  const detailMeta = selectedMonth
    ? seriesMeta[selectedMonth.series]
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TrendCard
          activeSelection={selectedMonth}
          data={chartData}
          loading={chartLoading}
          onClearSelection={() => setSelectedMonth(null)}
          onMonthClick={setSelectedMonth}
          series="billing"
          {...seriesMeta.billing}
        />
        <TrendCard
          activeSelection={selectedMonth}
          data={chartData}
          loading={chartLoading}
          onClearSelection={() => setSelectedMonth(null)}
          onMonthClick={setSelectedMonth}
          series="payment"
          {...seriesMeta.payment}
        />
      </div>

      {selectedMonth && detailMeta ? (
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  detailMeta.indicatorDotClassName,
                )}
              />
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                  {detailMeta.detailTitle}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {detailMeta.detailDescription} Showing{" "}
                  {selectedMonth.label}.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedMonth(null)}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-x-auto revenue-scroll">
            <table className="min-w-[1420px] w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-100">
                  {[
                    "Month",
                    "Year",
                    "Customer",
                    "Company",
                    "PO Number",
                    "Scope of Work",
                    "Invoice Number",
                    "Bill Generated",
                    "Payment Received",
                    "Amount Pending",
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
                {detailLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-12 text-center text-sm font-medium text-slate-400"
                    >
                      Loading {chartConfig[selectedMonth.series].label.toLowerCase()} details...
                    </td>
                  </tr>
                ) : details.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-12 text-center text-sm font-medium text-slate-400"
                    >
                      No records found for {selectedMonth.label}.
                    </td>
                  </tr>
                ) : (
                  details.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {item.month}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-500 tabular-nums">
                        {item.year}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {item.customerName}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-slate-700">
                        {item.companyName}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-950">
                        {item.poNumber}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        <div className="max-w-[260px] whitespace-normal break-words">
                          {item.scope}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {item.invoiceNumber}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-700 tabular-nums">
                        {formatCurrency(item.billedAmount)}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-700 tabular-nums">
                        {formatCurrency(item.paymentReceived)}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-950 tabular-nums">
                        {formatCurrency(item.pendingAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
