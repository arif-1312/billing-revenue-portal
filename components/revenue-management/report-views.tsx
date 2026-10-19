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
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { AgingSummary } from "@/lib/revenue-metrics";
import {
  amountWithGst,
  formatCount,
  formatInr,
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
import { FyBadge } from "./fy-badge";
import { DataTable } from "./data-table";
import { KpiCard } from "./kpi-card";
import { StatusBadge } from "./status-badge";

const chartConfig = {
  billing: { label: "Billed amount without GST", color: "#1F6FB5" },
  mrr: { label: "MRR", color: "#8E97C9" },
  payment: { label: "Collected amount without GST", color: "#0E8A6A" },
  overdue: { label: "Overdue", color: "#C5363C" },
  pending: { label: "Pending", color: "#C47E09" },
} satisfies ChartConfig;

const sliceColor: Record<string, string> = {
  Collected: "#0E8A6A",
  Pending: "#C47E09",
  Outstanding: "#C47E09",
  Overdue: "#C5363C",
};

function displayPartyName(name?: string | null) {
  const value = name?.trim();
  if (!value || value === "-") return "Unassigned";
  return value;
}

function namedRows(rows: PartyRow[]) {
  return rows.map((row) => ({
    ...row,
    rawName: row.name,
    name: displayPartyName(row.name),
  }));
}

const axisTick = { fill: "#667085", fontSize: 11 };
const tooltipStyle = {
  border: "1px solid #e4e8ee",
  borderRadius: 6,
  fontSize: 12,
  boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
};

type Delta = { text: string; tone: TrendTone };

export function OverviewView({
  billed,
  collected,
  outstanding,
  overdue,
  records,
  partial,
  projected,
  dueForBilling,
  overdueNote,
  deltas,
  slices,
  monthly,
  recordRows,
  invoiceLines,
  loading,
  error,
  focusMonths,
  onMonth,
  onCrossFilter,
}: {
  billed: number;
  collected: number;
  outstanding: number;
  overdue: number | null;
  records: number;
  partial: number;
  projected: number;
  dueForBilling: number;
  overdueNote: string | null;
  deltas: Record<"billed" | "collected" | "outstanding" | "overdue" | "records", Delta>;
  slices: Array<{ name: string; value: number }>;
  monthly: MonthPoint[];
  recordRows: RevenueRecord[];
  invoiceLines: Array<{
    month: string;
    customerName: string;
    companyName: string;
    invoiceNumber: string;
    poNumber: string;
    scope: string;
    serviceType: string;
    billed: number;
    collected: number;
    outstanding: number;
    status: string;
  }>;
  loading: boolean;
  error: string | null;
  focusMonths: string[];
  onMonth: (month: string) => void;
  onCrossFilter: (filter: CrossFilter) => void;
}) {
  const mrrFillId = `mrr-fill-${useId().replace(/:/g, "")}`;
  const billedByMonth = new Map<string, number>();
  for (const line of invoiceLines) {
    billedByMonth.set(line.month, (billedByMonth.get(line.month) ?? 0) + line.billed);
  }
  const mrrMonths = focusMonths.length > 0 ? monthly.filter((point) => focusMonths.includes(point.month)) : monthly;
  const mrrRows = mrrMonths.map((point) => ({
    month: point.month,
    MRR: billedByMonth.get(point.month) ?? 0,
  }));
  const monthRows = monthly.map((point) => ({
    month: point.month,
    "Billed amount without GST": point.billing,
    "Collected amount without GST": point.payment,
  }));
  const companies = topParties(groupByParty(recordRows, "companyName"), "billed", 8);
  const customers = topParties(groupByParty(recordRows, "customerName"), "due", 8);
  const companyRows = companies.map((row) => ({
    Company: displayPartyName(row.name),
    "Billed amount without GST": row.billed,
    "Collected amount without GST": row.collected,
  }));
  const customerRows = customers.map((row) => ({
    Customer: displayPartyName(row.name),
    Outstanding: row.due,
    Overdue: row.pastDue,
    "Collected amount without GST": row.collected,
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Billed amount without GST"
          value={billed}
          support="Invoice amount before 18% GST"
          hint="Billed invoice amount before GST for the selected period."
          accent="#1F6FB5"
          deltaText={deltas.billed.text}
          deltaTone={deltas.billed.tone}
        />
        <KpiCard
          label="Collected amount without GST"
          value={collected}
          support="Used for the period comparison"
          hint="Amount collected before GST. The change versus the previous period is calculated from this amount."
          accent="#0E8A6A"
          deltaText={deltas.collected.text}
          deltaTone={deltas.collected.tone}
        />
        <KpiCard
          label="Collected amount with GST"
          value={amountWithGst(collected)}
          support="Collected amount plus 18% GST"
          hint="Collected amount with 18% GST added. Shown on this card only. The period comparison uses collected amount without GST."
          accent="#6D28D9"
          deltaText={deltas.collected.text}
          deltaTone={deltas.collected.tone}
        />
        <KpiCard
          label="Outstanding"
          value={outstanding}
          support="Uncollected on billed invoices"
          hint="The portal's pending collection total. An invoice cannot reduce this below zero when collected amount exceeds billed amount."
          accent="#C47E09"
          deltaText={deltas.outstanding.text}
          deltaTone={deltas.outstanding.tone}
        />
        <KpiCard
          label="Overdue"
          value={overdue ?? 0}
          unavailable={overdue == null}
          support={overdueNote ?? "Outstanding past the due date"}
          hint="Outstanding on invoices whose due date is before today. Invoices without a due date are excluded."
          accent="#C5363C"
          deltaText={deltas.overdue.text}
          deltaTone={deltas.overdue.tone}
        />
        <KpiCard
          label="Billing records"
          value={records}
          mode="number"
          support="Rows matching these filters"
          hint="Grouped billing rows in the current selection. This is not compared with the prior period."
          accent="#667085"
          deltaText={deltas.records.text}
          deltaTone={deltas.records.tone}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SecondaryStat
          label="Total revenue projected"
          value={projected}
          hint="All invoiced amounts in the selected financial year. Month, quarter, and date filters do not reduce this total."
        />
        <SecondaryStat
          label="Due for billing till now"
          value={dueForBilling}
          hint="Cycles that do not yet have an invoice number."
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
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
          empty={monthRows.every((row) => row["Billed amount without GST"] === 0 && row["Collected amount without GST"] === 0)}
        >
          <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
            <BarChart data={monthRows} barGap={2}>
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
              <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Billed amount without GST" fill="var(--color-billing)" radius={[2, 2, 0, 0]} maxBarSize={22} cursor="pointer" isAnimationActive={false} onClick={(item) => onMonth(String(item.month))} />
              <Bar dataKey="Collected amount without GST" fill="var(--color-payment)" radius={[2, 2, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard
          title="Collection status"
          description={partial > 0 ? `${formatCount(partial)} partially collected invoices are already included in collected and outstanding.` : "Collected, pending, and overdue amounts for this selection."}
          filename="collection-status.csv"
          rows={slices.map((slice) => ({ Status: slice.name, Amount: slice.value }))}
          loading={loading}
          error={error}
          empty={slices.every((slice) => slice.value === 0)}
        >
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
              <PieChart>
                <Pie data={slices.filter((slice) => slice.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {slices.filter((slice) => slice.value > 0).map((slice) => (
                    <Cell key={slice.name} fill={sliceColor[slice.name] ?? "#98A2B3"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
              </PieChart>
            </ChartContainer>
            <ul className="space-y-1.5">
              {slices.map((slice) => (
                <li key={slice.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-[#667085]">
                    <span className="size-2 rounded-sm" style={{ background: sliceColor[slice.name] ?? "#98A2B3" }} />
                    {slice.name}
                  </span>
                  <span className="font-mono text-[#1c2430] tabular-nums" title={formatInr(slice.value)}>{formatInr(slice.value, true)}</span>
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
          color="#1F6FB5"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "company", value: name })}
        />
        <RankChart
          title="Outstanding by customer"
          description="Customers with the highest outstanding balances."
          filename="outstanding-by-customer.csv"
          rows={customerRows}
          data={customers}
          dataKey="due"
          color="#C47E09"
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind: "customer", value: name })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          title="Revenue and collection trend"
          description="Use the lines to see whether billing and collections are rising or falling. A gap is a timing difference, not a second outstanding balance."
          filename="revenue-collection-trend.csv"
          rows={monthRows}
          loading={loading}
          error={error}
          empty={monthRows.every((row) => row["Billed amount without GST"] === 0 && row["Collected amount without GST"] === 0)}
        >
          <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
            <ComposedChart data={monthRows}>
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
              <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
              <Legend />
              <Line dataKey="Billed amount without GST" stroke="var(--color-billing)" strokeWidth={2} dot={false} type="linear" isAnimationActive={false} />
              <Line dataKey="Collected amount without GST" stroke="var(--color-payment)" strokeWidth={2} dot={false} type="linear" isAnimationActive={false} />
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
          <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
            <AreaChart data={mrrRows}>
              <defs>
                <linearGradient id={mrrFillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C5CAE8" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#C5CAE8" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eef1f4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} minTickGap={16} />
              <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
              <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
              <Area dataKey="MRR" name="MRR" type="monotone" stroke="#8E97C9" strokeWidth={2} fill={`url(#${mrrFillId})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
      </div>
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
  const sorted = [...rows].sort((left, right) => compareParty(left, right, sort.id, sort.dir));
  const ranked = topParties(rows, purpose === "customer" ? "due" : "billed", 8);
  const rankedChart = namedRows(ranked);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#667085]">
        {purpose === "customer"
          ? "Customer revenue, collected amount without GST, outstanding balances, and overdue exposure."
          : "Company billed amount, collected amount without GST, outstanding, and overdue amounts."}
      </p>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <RankChart
          title={purpose === "customer" ? "Highest outstanding" : "Highest billed revenue"}
          filename={purpose === "customer" ? "customer-outstanding.csv" : "company-revenue.csv"}
          rows={ranked.map((row) => ({
            Name: displayPartyName(row.name),
            Amount: purpose === "customer" ? row.due : row.billed,
            "Collected amount without GST": row.collected,
          }))}
          data={ranked}
          dataKey={purpose === "customer" ? "due" : "billed"}
          color={purpose === "customer" ? "#C47E09" : "#1F6FB5"}
          loading={loading}
          error={error}
          onPick={(name) => onCrossFilter({ kind, value: name })}
        />
        <ChartCard
          title={purpose === "customer" ? "Collected against outstanding" : "Billed against collected"}
          filename={purpose === "customer" ? "customer-collection.csv" : "company-collection.csv"}
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
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <BarChart data={rankedChart} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} stroke="#eef1f4" />
              <XAxis type="number" tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} />
              <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={shorten} />
              <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
              <Legend />
              {purpose === "company" ? <Bar dataKey="billed" name="Billed amount without GST" fill="#1F6FB5" maxBarSize={12} isAnimationActive={false} /> : null}
              <Bar dataKey="collected" name="Collected amount without GST" fill="#0E8A6A" maxBarSize={12} isAnimationActive={false} />
              <Bar dataKey="due" name="Outstanding" fill="#C47E09" maxBarSize={12} isAnimationActive={false} />
              <Bar dataKey="pastDue" name="Overdue" fill="#C5363C" maxBarSize={12} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
      <article className="rounded-md border border-[#e4e8ee] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h3 className="mb-2 text-sm font-semibold text-[#1c2430]">{title}</h3>
        <DataTable
          sort={sort}
          onSort={(id) =>
            setSort((current) =>
              current.id === id ? { id, dir: current.dir === "desc" ? "asc" : "desc" } : { id, dir: "desc" },
            )
          }
          columns={[
            { id: "name", label: "Name" },
            { id: "billed", label: "Billed amount without GST", align: "right" },
            { id: "collected", label: "Collected amount without GST", align: "right" },
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
        <p className="mt-2 text-[11px] text-[#667085]">Overdue is the outstanding portion past its due date. Average days to pay stays hidden because payment dates are not on these rows.</p>
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
  const outstanding = records.filter((record) => toNumber(record.overdueAmount) > 0);
  const bucketRows = aging?.buckets.map((bucket) => ({
    Bucket: bucket.label,
    Amount: bucket.amount,
    Invoices: bucket.count,
  })) ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#667085]">Receivables aging for outstanding invoices that have a due date.</p>
      {hiddenReason ? (
        <p className="rounded-md border border-[#f3e2b8] bg-[#fff8eb] px-3 py-2 text-sm text-[#8a5a00]">{hiddenReason}</p>
      ) : null}
      {!hiddenReason && aging && !aging.supported ? (
        <p className="rounded-md border border-[#f3e2b8] bg-[#fff8eb] px-3 py-2 text-sm text-[#8a5a00]">
          Aging buckets are unavailable. Outstanding invoices in this selection do not have payment due dates.
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
            <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
              <BarChart data={aging.buckets}>
                <CartesianGrid vertical={false} stroke="#eef1f4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
                <Tooltip formatter={(value, name) => (name === "amount" ? formatInr(Number(value)) : value)} contentStyle={tooltipStyle} />
                <Bar dataKey="amount" name="Overdue" fill="#C5363C" radius={[2, 2, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
          <article className="rounded-md border border-[#e4e8ee] bg-white p-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="font-semibold text-[#1c2430]">Outside the overdue buckets</h3>
            <dl className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#667085]">Not yet due</dt>
                <dd className="font-mono tabular-nums" title={formatInr(aging.notYetDueAmount)}>{formatInr(aging.notYetDueAmount, true)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#667085]">No due date</dt>
                <dd className="font-mono tabular-nums" title={formatInr(aging.missingDueDateAmount)}>{formatInr(aging.missingDueDateAmount, true)}</dd>
              </div>
            </dl>
          </article>
        </div>
      ) : null}
      <article className="rounded-md border border-[#e4e8ee] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h3 className="mb-2 text-sm font-semibold text-[#1c2430]">Outstanding records</h3>
        <DataTable
          columns={[
            { id: "customer", label: "Customer" },
            { id: "company", label: "Company" },
            { id: "po", label: "PO" },
            { id: "billed", label: "Billed amount without GST", align: "right" },
            { id: "collected", label: "Collected amount without GST", align: "right" },
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
    "Collected amount without GST": point.payment,
  }));

  return (
    <div className="space-y-3">
      <p className="rounded-md border border-[#d5e4f2] bg-[#f4f9fd] px-3 py-2 text-sm text-[#1c2430]">
        Projected is the invoiced amount for the month, including later months in the financial year. Collected amount without GST is the amount received, shown in the month it was received.
      </p>
      <ChartCard
        title="Projected vs actual"
        description="Projected is invoiced. Collected amount without GST is the amount received."
        filename="forecast.csv"
        rows={series}
        empty={series.every((row) => row.Projected === 0 && row["Collected amount without GST"] === 0)}
      >
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={series} barGap={2}>
            <CartesianGrid vertical={false} stroke="#eef1f4" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} width={72} />
            <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey="Projected" fill="#1F6FB5" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="Collected amount without GST" fill="#0E8A6A" radius={[2, 2, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <SecondaryStat label="Total revenue projected" value={projected} hint="All invoiced amounts in the selected financial year." />
        <SecondaryStat label="Billed amount without GST" value={billed} hint="Invoice amount before GST in the selected period." />
        <SecondaryStat label="Collected amount without GST" value={collected} hint="Amount collected in the selected period. The period comparison uses this amount." />
      </div>
    </div>
  );
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
  dataKey: "billed" | "due";
  color: string;
  loading: boolean;
  error: string | null;
  onPick: (name: string) => void;
}) {
  const chartData = namedRows(data);

  return (
    <ChartCard title={title} description={description} filename={filename} rows={rows} loading={loading} error={error} empty={data.length === 0}>
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid horizontal={false} stroke="#eef1f4" />
          <XAxis type="number" tickFormatter={(value) => formatInr(Number(value), true)} tickLine={false} axisLine={false} tick={axisTick} />
          <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} tick={axisTick} tickFormatter={shorten} />
          <Tooltip formatter={(value) => formatInr(Number(value))} contentStyle={tooltipStyle} />
          <Bar dataKey={dataKey} name={dataKey === "billed" ? "Billed amount without GST" : "Outstanding"} fill={color} radius={[0, 2, 2, 0]} maxBarSize={16} cursor="pointer" isAnimationActive={false} onClick={(item) => onPick(String(item.rawName ?? item.name))} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function SecondaryStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-md border border-[#e4e8ee] bg-white px-3 py-2" title={hint}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <p className="text-[11px] font-medium text-[#667085]">{label}</p>
          <FyBadge />
        </div>
        <p className="truncate text-[11px] text-[#98a2b3]">{hint}</p>
      </div>
      <p className="shrink-0 font-mono text-sm font-semibold text-[#1c2430] tabular-nums" title={formatInr(value)}>
        {formatInr(value, true)}
      </p>
    </article>
  );
}

function Money({ value }: { value: number }) {
  return (
    <span className="font-mono tabular-nums" title={formatInr(value)}>
      {formatInr(value, true)}
    </span>
  );
}

function shorten(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

function compareParty(left: PartyRow, right: PartyRow, id: string, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1;
  const key = id === "status" ? "efficiency" : id;
  const leftValue = left[key as keyof PartyRow];
  const rightValue = right[key as keyof PartyRow];
  if (typeof leftValue === "string" && typeof rightValue === "string") {
    return leftValue.localeCompare(rightValue) * sign;
  }
  return (Number(leftValue) - Number(rightValue)) * sign;
}
