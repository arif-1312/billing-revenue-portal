import type { ReactNode } from "react";

import { fetchPLPageData } from "@/lib/actions/project";
import Link from "next/link";
import moment from "moment";
import { ArrowLeft, BriefcaseBusiness, IndianRupee, TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatStoredDate } from "@/lib/date-utils";
import { canAccess } from "@/lib/rbac";

type BillingCycleView = {
  id?: string | number;
  month?: number | string | null;
  year?: number | string | null;
  billableAmount?: number | string | null;
  billedAmount?: number | string | null;
  resourceUsed?: number | string | null;
  fms?: number | string | null;
  spare?: number | string | null;
  otherCost?: number | string | null;
};

type ProjectView = {
  projectName?: string | null;
  status?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  poValue?: number | string | null;
  totalRevenue?: number | string | null;
  totalCost?: number | string | null;
  resourceCount?: number | string | null;
  projectedProfit?: number | string | null;
  orderType?: string | null;
  company?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

const rupee = "\u20B9";

const safeNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));

const surfaceClassName =
  "rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_18px_42px_-34px_rgba(39,39,42,0.28)]";

const StatusBadge = ({ value }: { value?: string | null }) => {
  const normalized = value?.toLowerCase();

  const tone =
    normalized === "live" || normalized === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "completed"
        ? "border-teal-200 bg-teal-50 text-teal-700"
        : "border-zinc-200 bg-zinc-100 text-zinc-700";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {value || "-"}
    </span>
  );
};

const Detail = ({ label, value }: { label: string; value?: ReactNode }) => {
  return (
    <div className="grid grid-cols-[minmax(120px,0.6fr)_1fr] gap-4 border-b border-zinc-100 py-3 text-sm last:border-none">
      <span className="font-medium text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-900">{value || "-"}</span>
    </div>
  );
};

const Panel = ({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) => {
  return (
    <section className={surfaceClassName}>
      {title ? (
        <div className="mb-4 flex items-center gap-3 border-b border-zinc-100 pb-3">
          <span className="h-5 w-1 rounded-full bg-teal-500" />
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
      ) : null}
      {children}
    </section>
  );
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PLViewPage({ params }: Props) {
  const { id } = await params;

  const route = "/admin/pl";
  const canView = await canAccess(route, "view");
  if (!canView) redirect("/404");

  const data = await fetchPLPageData(id);

  if (!data.success || !data.project) {
    return <p className="p-6 font-semibold text-red-600">Project not found.</p>;
  }

  const project = data.project as ProjectView;
  const billingCycles = (data.billingCycles ?? []) as BillingCycleView[];

  const totalPOValue = safeNumber(project.poValue);
  const totalBilledValue = safeNumber(project.totalRevenue);
  const totalCostValue = safeNumber(project.totalCost);
  const totalResourceCount = safeNumber(project.resourceCount);
  const totalFMSValue = billingCycles.reduce((sum, cycle) => sum + safeNumber(cycle.fms), 0);
  const totalSpareValue = billingCycles.reduce((sum, cycle) => sum + safeNumber(cycle.spare), 0);
  const totalMiscCostValue = billingCycles.reduce(
    (sum, cycle) => sum + safeNumber(cycle.otherCost),
    0,
  );
  const totalProjectedProfit = safeNumber(project.projectedProfit);
  const totalGM =
    totalBilledValue === 0
      ? 0
      : Math.round(((totalBilledValue - totalCostValue) / totalBilledValue) * 10000) / 100;

  const summaryCards = [
    {
      label: "Total PO Value",
      value: `${rupee}${formatCurrency(totalPOValue)}`,
      icon: BriefcaseBusiness,
      accent: "border-teal-200 bg-teal-50 text-teal-700",
      bar: "bg-teal-500",
    },
    {
      label: "Total Billed",
      value: `${rupee}${formatCurrency(totalBilledValue)}`,
      icon: IndianRupee,
      accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
      bar: "bg-emerald-500",
    },
    {
      label: "Total Cost",
      value: `${rupee}${formatCurrency(totalCostValue)}`,
      icon: TrendingUp,
      accent: "border-rose-200 bg-rose-50 text-rose-700",
      bar: "bg-rose-500",
    },
    {
      label: "Total GM",
      value: `${totalGM.toFixed(2)}%`,
      icon: TrendingUp,
      accent: "border-amber-200 bg-amber-50 text-amber-700",
      bar: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc_55%,#fff7ed)] shadow-[0_20px_56px_-42px_rgba(39,39,42,0.45)]">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 via-amber-400 to-rose-500" />
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Project Record
            </p>
            <h1 className="text-2xl font-semibold text-zinc-950 md:text-3xl">
              Project Profit and Loss Details
            </h1>
            <p className="text-sm text-zinc-500">
              {project.projectName || "Project"} - {project.company?.name || "Company not set"}
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-10 rounded-lg border-zinc-300 bg-white text-zinc-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
          >
            <Link href="/admin/pl">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className={`overflow-hidden rounded-xl border ${item.accent.split(" ")[0]} bg-white shadow-[0_16px_38px_-32px_rgba(39,39,42,0.34)]`}
            >
              <div className={`h-1 ${item.bar}`} />
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">{item.value}</p>
                </div>
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.accent}`}>
                  <Icon className="size-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Agreed Resource Count", totalResourceCount],
          ["Total FMS Value", `${rupee}${formatCurrency(totalFMSValue)}`],
          ["Total Spare Value", `${rupee}${formatCurrency(totalSpareValue)}`],
          ["Miscellaneous Cost", `${rupee}${formatCurrency(totalMiscCostValue)}`],
          ["Projected Profit", `${totalProjectedProfit}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className={surfaceClassName}>
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Project Details">
          <Detail label="Project Name" value={project.projectName} />
          <Detail label="Status" value={<StatusBadge value={project.status} />} />
          <Detail label="Start Date" value={formatStoredDate(project.startDate)} />
          <Detail label="End Date" value={formatStoredDate(project.endDate)} />
          <Detail label="PO Value" value={`${rupee}${formatCurrency(project.poValue)}`} />
          <Detail label="Resource Count" value={totalResourceCount} />
          <Detail label="Order Type" value={project.orderType} />
        </Panel>

        <Panel title="Company Details">
          <Detail label="Company Name" value={project.company?.name} />
          <Detail label="Email" value={project.company?.email} />
          <Detail label="Phone" value={project.company?.phone} />
        </Panel>
      </div>

      <Panel title="Billing Cycles">
        {billingCycles.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <th className="p-3 text-left font-semibold">#</th>
                    <th className="p-3 text-left font-semibold">Month</th>
                    <th className="p-3 text-right font-semibold">Billable Amount</th>
                    <th className="p-3 text-right font-semibold">Billed Amount</th>
                    <th className="p-3 text-right font-semibold">Resource Used</th>
                    <th className="p-3 text-right font-semibold">FMS</th>
                    <th className="p-3 text-right font-semibold">Spare</th>
                    <th className="p-3 text-right font-semibold">Other Cost</th>
                    <th className="p-3 text-right font-semibold">Total Cost</th>
                    <th className="p-3 text-right font-semibold">Profit</th>
                    <th className="p-3 text-right font-semibold">GM%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {billingCycles.map((cycle, index) => {
                    const totalCost =
                      safeNumber(cycle.fms) +
                      safeNumber(cycle.spare) +
                      safeNumber(cycle.otherCost);
                    const profitAmount = safeNumber(cycle.billedAmount) - totalCost;
                    const profitPercent =
                      safeNumber(cycle.billedAmount) === 0
                        ? 0
                        : Number(
                            (
                              (profitAmount / safeNumber(cycle.billedAmount)) *
                              100
                            ).toFixed(2),
                          );
                    const meetsTarget = profitPercent >= totalProjectedProfit;

                    return (
                      <tr
                        key={cycle.id ?? index}
                        className={meetsTarget ? "hover:bg-emerald-50/40" : "hover:bg-rose-50/40"}
                      >
                        <td className="p-3 text-zinc-500">{index + 1}</td>
                        <td className="p-3 font-medium text-zinc-900">
                          {moment()
                            .month(Number(cycle.month || 0))
                            .format("MMMM")}{" "}
                          {cycle.year || "-"}
                        </td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(cycle.billableAmount)}
                        </td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(cycle.billedAmount)}
                        </td>
                        <td className="p-3 text-right text-zinc-700">
                          {safeNumber(cycle.resourceUsed)}
                        </td>
                        <td className="p-3 text-right text-zinc-700">
                          {rupee}
                          {formatCurrency(cycle.fms)}
                        </td>
                        <td className="p-3 text-right text-zinc-700">
                          {rupee}
                          {formatCurrency(cycle.spare)}
                        </td>
                        <td className="p-3 text-right text-zinc-700">
                          {rupee}
                          {formatCurrency(cycle.otherCost)}
                        </td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(totalCost)}
                        </td>
                        <td className={`p-3 text-right font-medium ${meetsTarget ? "text-emerald-700" : "text-rose-700"}`}>
                          {rupee}
                          {formatCurrency(profitAmount)}
                        </td>
                        <td className={`p-3 text-right font-medium ${meetsTarget ? "text-emerald-700" : "text-rose-700"}`}>
                          {profitPercent}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            No billing cycles found.
          </div>
        )}
      </Panel>
    </div>
  );
}
