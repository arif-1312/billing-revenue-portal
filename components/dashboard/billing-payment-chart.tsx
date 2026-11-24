"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, CartesianGrid, XAxis } from "recharts"

import { getMonthlyBillingData } from "@/lib/actions/dashboard"
type MonthlyBillingPoint = Awaited<ReturnType<typeof getMonthlyBillingData>>[number];
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const chartConfig = {
  billing: {
    label: "Billing",
    color: "var(--financial-billing)",
  },
  payment: {
    label: "Payment",
    color: "var(--financial-collected)",
  },
}

export function BillingPaymentChart() {
  const [year, setYear] = useState("2025")
  const [chartData, setChartData] = useState<MonthlyBillingPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const data = await getMonthlyBillingData(Number(year))
        setChartData(data)
      } catch (error) {
        console.error("Failed to fetch billing data:", error)
        setChartData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [year])

  return (
    <div className="space-y-4">

      {/* Year Filter */}
      <div className="flex justify-end">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="2024">FY 2024-25</SelectItem>
            <SelectItem value="2025">FY 2025-26</SelectItem>
            <SelectItem value="2026">FY 2026-27</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-[320px] w-full" aria-busy={loading}>
        <LineChart data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />

          <ChartTooltip content={<ChartTooltipContent />} />

          <Line
            type="monotone"
            dataKey="billing"
            stroke="var(--financial-billing)"
            strokeWidth={3}
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="payment"
            stroke="var(--financial-collected)"
            strokeWidth={3}
            dot={false}
          />

        </LineChart>
      </ChartContainer>

    </div>
  )
}
