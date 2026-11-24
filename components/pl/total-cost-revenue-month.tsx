"use client";

import { useEffect, useMemo, useState } from "react";
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
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { getMonthlyRevenueCost } from "@/lib/actions/project";
import {
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DataPoint = {
  month: string;
  value: number;
  monthNumber: number;
  year: number;
};

type SelectedMonth = {
  month: number;
  year: number;
};

type Props = {
  activeSelection?: SelectedMonth | null;
  onMonthClick?: (data: SelectedMonth) => void;
  filters: Record<string, unknown>;
  onClear?: () => void;
};

type MonthlyCostResponse = {
  cost: Array<{
    month: string;
    value: number;
  }>;
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload: DataPoint;
  }>;
};

type BarLabelProps = {
  height?: number;
  value?: number;
  width?: number;
  x?: number;
  y?: number;
};

const chartConfig = {
  value: {
    label: "Cost",
    color: "#DC4545",
  },
} satisfies ChartConfig;

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

function SkeletonBars() {
  const widths = [62, 48, 78, 42, 86, 56, 73, 47, 80, 44, 66, 84];

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
        {Icon ? <Icon className={cn("h-3.5 w-3.5", accent)} /> : null}
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

function BarValueLabel({ height, value, width, x, y }: BarLabelProps) {
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
      fontSize={11}
      fontFamily="var(--font-geist-mono)"
      fontWeight={600}
    >
      {formatCompactCurrency(value)}
    </text>
  );
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const datum = payload[0].payload;

  return (
    <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <p className="text-sm font-semibold tracking-tight text-slate-950">
        {datum.month} {datum.year}
      </p>
      <div className="mt-2 flex items-center justify-between gap-6">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          Cost
        </span>
        <span className="font-mono text-sm font-semibold text-[#DC4545]">
          {formatCurrency(datum.value)}
        </span>
      </div>
    </div>
  );
}

export function TotalCostChart({
  activeSelection = null,
  onMonthClick,
  onClear,
  filters,
}: Props) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const selectedYear =
    typeof filters.year === "string" && filters.year !== "all"
      ? Number(filters.year)
      : new Date().getMonth() < 3
        ? new Date().getFullYear() - 1
        : new Date().getFullYear();

  useEffect(() => {
    let active = true;

    async function loadCost() {
      setLoading(true);

      try {
        const response = (await getMonthlyRevenueCost(
          selectedYear,
          filters,
        )) as MonthlyCostResponse;

        if (!active) return;

        setData(
          (response.cost ?? []).map((entry, index) => ({
            month: entry.month,
            value: Number(entry.value || 0),
            monthNumber: index + 1,
            year: selectedYear,
          })),
        );
      } catch (error) {
        if (active) {
          console.error("Error fetching cost:", error);
          setData([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCost();

    return () => {
      active = false;
    };
  }, [filters, selectedYear]);

  const selectedIndex = activeSelection
    ? data.findIndex(
      (entry) =>
        entry.monthNumber === activeSelection.month &&
        entry.year === activeSelection.year,
    )
    : -1;
  const activeIndex = selectedIndex >= 0 ? selectedIndex : null;

  const chartStats = useMemo(() => {
    const values = data.map((item) => item.value).filter((value) => value > 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = values.length ? Math.max(...values) : 0;
    const average = values.length ? total / values.length : 0;
    const lastTwo = values.slice(-2);
    const trend =
      lastTwo.length === 2
        ? ((lastTwo[1] - lastTwo[0]) / (lastTwo[0] || 1)) * 100
        : null;
    const peakMonth = data.find((item) => item.value === peak)?.month ?? "-";

    return { average, peak, peakMonth, total, trend, values };
  }, [data]);

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
        ? "text-[#DC4545]"
        : "text-[#15966A]";

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-[#DC4545]/20 bg-[#DC4545]/5 p-3 text-[#DC4545] shadow-sm">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              Monthly Operating Cost
            </h3>

          </div>
        </div>

        <div className="rounded-2xl border border-[#DC4545]/20 bg-[#DC4545]/5 px-3 py-2 text-sm font-medium text-[#B42323]">
          FY {selectedYear}-{String(selectedYear + 1).slice(-2)}
        </div>
      </div>

      <div className="grid grid-cols-1 border-b border-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-slate-100 sm:border-b-0 sm:border-r">
          <StatCard
            label="Total Cost"
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
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              No cost data for FY {selectedYear}-{String(selectedYear + 1).slice(-2)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Try a different year or adjust the dashboard filters.
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
                  margin={{ top: 4, right: 18, bottom: 4, left: 6 }}
                  barCategoryGap="26%"
                  onClick={(state) => {
                    if (!state?.activePayload?.length) return;

                    const payload = state.activePayload[0].payload as DataPoint;
                    onMonthClick?.({
                      month: payload.monthNumber,
                      year: payload.year,
                    });
                  }}
                  onMouseMove={(state) => {
                    if (state?.activeTooltipIndex !== undefined) {
                      setHoveredIndex(state.activeTooltipIndex);
                    }
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#F29A9A" />
                      <stop offset="100%" stopColor="#DC4545" />
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
                    cursor={{ fill: "rgba(220, 69, 69, 0.05)", rx: 8 }}
                    content={<CustomTooltip />}
                  />

                  <Bar
                    dataKey="value"
                    radius={[0, 8, 8, 0]}
                    maxBarSize={28}
                    style={{ cursor: "pointer" }}
                  >
                    {data.map((entry, index) => {
                      const isActive = activeIndex === index;
                      const isHovered = hoveredIndex === index;
                      const isEmpty = entry.value === 0;

                      let fill = "url(#costGrad)";
                      let opacity = 1;

                      if (isEmpty) {
                        fill = "#E2E8F0";
                        opacity = 0.8;
                      } else if (isActive) {
                        fill = "#B42323";
                      } else if (isHovered) {
                        fill = "#E56B6B";
                      }

                      return (
                        <Cell
                          key={`cost-cell-${entry.month}-${index}`}
                          fill={fill}
                          opacity={opacity}
                        />
                      );
                    })}

                    <LabelList
                      dataKey="value"
                      position="insideRight"
                      content={<BarValueLabel />}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {!loading && data.some((item) => item.value === 0) ? (
              <p className="mt-3 text-right text-[11px] font-medium text-slate-400">
                Light bars indicate months with no cost recorded
              </p>
            ) : null}
          </>
        )}
      </div>

      {activeIndex !== null && data[activeIndex] ? (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl border border-[#DC4545]/20 bg-[#DC4545]/5 px-4 py-3 text-sm sm:mx-5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#DC4545]" />
          <span className="text-slate-600">
            Drill-down loaded for{" "}
            <span className="font-semibold text-[#B42323]">
              {data[activeIndex].month} {data[activeIndex].year}
            </span>
          </span>
          <button
            onClick={() => {
              onClear?.(); // 👈 call parent clear
            }}
            className="ml-auto text-sm font-semibold text-slate-400 transition-colors hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
