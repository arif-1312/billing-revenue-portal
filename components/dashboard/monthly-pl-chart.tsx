"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getPLData } from "@/lib/actions/project";

type ChartData = {
  month: string;
  revenue: number;
  cost: number;
};

type MonthlyPLChartProps = {
  plData?: any;
};

function getFinancialYearRange(year: number) {
  return {
    startDate: new Date(year, 3, 1),
    endDate: new Date(year + 1, 2, 31),
  };
}

const compactNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const exactNumberFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatIndianNumber(num: number) {
  const absoluteValue = Math.abs(num);

  const formatScaledValue = (value: number, suffix: string) => {
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: value >= 10 || Number.isInteger(value) ? 0 : 1,
    }).format(value);

    return `${formatted}${suffix}`;
  };

  if (absoluteValue >= 1_00_00_000) {
    return formatScaledValue(num / 1_00_00_000, "Cr");
  }

  if (absoluteValue >= 1_00_000) {
    return formatScaledValue(num / 1_00_000, "L");
  }

  if (absoluteValue >= 1_000) {
    return formatScaledValue(num / 1_000, "K");
  }

  return compactNumberFormatter.format(num);
}

function formatExactCurrency(num: number) {
  return currencyFormatter.format(num);
}

function formatExactNumber(num: number) {
  return exactNumberFormatter.format(num);
}

function renderTooltipValue(value: number, label: string) {
  if (value === 0) {
    return null;
  }

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">
        {formatExactCurrency(value)}
      </span>
    </div>
  );
}

export function MonthlyPLChart({ plData }: MonthlyPLChartProps) {
  const startYear = 2024;

  const now = new Date();
  const currentFY = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();

  const [year, setYear] = useState(currentFY.toString());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [summary, setSummary] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
  });

  const chartConfig = {
    revenue: { label: "Revenue", color: "#1976D2" },
    cost: { label: "Cost", color: "#E69A23" },
  };

  useEffect(() => {
    async function loadData() {
      try {
        const yearNum = Number(year);
        const { startDate, endDate } = getFinancialYearRange(yearNum);

        const allMonths = [
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

        const data =
          plData ??
          (await getPLData(yearNum, {
            startDate,
            endDate,
          }));

        let totalRevenue = 0;
        let totalCost = 0;

        const safeData: ChartData[] = allMonths.map((month) => {
          const monthData = data?.monthly?.find((m: any) => m.month === month);
          const revenue = Number(monthData?.revenue ?? 0);
          const cost = Number(monthData?.cost ?? 0);

          totalRevenue += revenue;
          totalCost += cost;

          return { month, revenue, cost };
        });

        setChartData(safeData);
        setSummary({
          revenue: totalRevenue,
          cost: totalCost,
          profit: totalRevenue - totalCost,
        });
      } catch (err) {
        console.error("PL Chart load error:", err);
        setChartData([]);
        setSummary({ revenue: 0, cost: 0, profit: 0 });
      }
    }

    loadData();
  }, [year, plData]);

  return (
    <Card className="w-full">
      <CardContent className="min-w-0 w-full space-y-4">
        <div className="mb-4 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: currentFY - startYear + 1 }, (_, i) => {
                const y = (startYear + i).toString();
                return (
                  <SelectItem key={y} value={y}>
                    {`FY ${y}-${String(Number(y) + 1).slice(-2)}`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="font-semibold text-gray-500">Total Revenue</p>
              <p className="font-semibold text-[#1976D2]">{formatExactCurrency(summary.revenue)}</p>
            </div>

            <div>
              <p className="font-semibold text-gray-500">Total Cost</p>
              <p className="font-semibold text-[#E69A23]">{formatExactCurrency(summary.cost)}</p>
            </div>

            <div>
              <p className="font-semibold text-gray-500">Total Profit</p>
              <p className="font-semibold text-[#15966A]">{formatExactCurrency(summary.profit)}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>{chartConfig.revenue.label}</CardTitle>
            </CardHeader>

            <CardContent className="h-[450px] w-full">
              <ChartContainer
                className="h-full w-full"
                config={{ label: { color: "var(--foreground)" } } as ChartConfig}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 20, right: 130, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) =>
                        Number(value) === 0 ? "" : formatIndianNumber(Number(value))
                      }
                    />
                    <YAxis type="category" dataKey="month" width={60} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) =>
                            renderTooltipValue(
                              Number(value),
                              chartConfig[name as keyof typeof chartConfig]?.label?.toString() ??
                                String(name)
                            )
                          }
                        />
                      }
                    />

                    <Bar dataKey="revenue" fill={chartConfig.revenue.color} barSize={24}>
                      <LabelList
                        dataKey="revenue"
                        position="right"
                        fontSize={11}
                        fill="#1f2937"
                        formatter={(value: number) =>
                          value === 0 ? "" : formatExactNumber(value)
                        }
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>{chartConfig.cost.label}</CardTitle>
            </CardHeader>

            <CardContent className="h-[450px] w-full">
              <ChartContainer
                className="h-full w-full"
                config={{ label: { color: "var(--foreground)" } } as ChartConfig}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 20, right: 130, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) =>
                        Number(value) === 0 ? "" : formatIndianNumber(Number(value))
                      }
                    />
                    <YAxis type="category" dataKey="month" width={60} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) =>
                            renderTooltipValue(
                              Number(value),
                              chartConfig[name as keyof typeof chartConfig]?.label?.toString() ??
                                String(name)
                            )
                          }
                        />
                      }
                    />

                    <Bar dataKey="cost" fill={chartConfig.cost.color} barSize={24}>
                      <LabelList
                        dataKey="cost"
                        position="right"
                        fontSize={11}
                        fill="#1f2937"
                        formatter={(value: number) =>
                          value === 0 ? "" : formatExactNumber(value)
                        }
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
