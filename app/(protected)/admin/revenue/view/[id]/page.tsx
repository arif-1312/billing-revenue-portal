import type { ReactNode } from "react";

import { getPurchaseOrderById } from "@/lib/actions/purschase-order";
import Link from "next/link";
import moment from "moment";
import { ArrowLeft, Clock3, IndianRupee, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatStoredDate } from "@/lib/date-utils";
import { canAccess } from "@/lib/rbac";

interface Props {
  params: Promise<{ id: string }>;
}

type BillingCycleView = {
  id: string;
  invoiceAmount?: number | null;
  collectedAmount?: number | null;
  invoiceDate?: Date | string | null;
  paymentReceivedDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  invoiceNumber?: string | null;
  paymentReceived?: string | null;
  payments?: Array<{
    receivedDate?: Date | string | null;
    amount?: number | null;
  }> | null;
};

const rupee = "\u20B9";

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const surfaceClassName =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

const metricTone = {
  teal: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
    bar: "bg-blue-600",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  rose: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    bar: "bg-amber-500",
  },
};

const StatusBadge = ({ value }: { value?: string | null }) => {
  const normalized = value?.toLowerCase();

  const tone =
    normalized === "yes" || normalized === "received" || normalized === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "partial" || normalized === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
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
    <div className="grid grid-cols-[minmax(110px,0.55fr)_1fr] gap-4 border-b border-zinc-100 py-3 text-sm last:border-none">
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

export default async function PurchaseOrderViewPage({ params }: Props) {
  const { id } = await params;
  const res = await getPurchaseOrderById(id);

  if (!res.success || !res.data) {
    return <p className="p-6 font-semibold text-red-600">Purchase Order not found.</p>;
  }

  const route = "/admin/revenue";
  const canView = await canAccess(route, "view");
  if (!canView) {
    redirect("/404");
  }

  const po = res.data;
  const billingCycles = (po.billingCycles ?? []) as unknown as BillingCycleView[];

  const totalCollected = billingCycles.reduce(
    (sum, cycle) => sum + Number(cycle.collectedAmount || 0),
    0,
  );
  const totalRevenue = Number(po.poAmount || 0);
  const pending = totalRevenue - totalCollected;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 bg-blue-600" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Revenue Record
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Revenue Details
            </h1>
            <p className="text-sm text-slate-500">
              PO {po.customerPONumber || "-"} - {po.customer?.companyName || "Company not set"}
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-9 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Link href="/admin/revenue">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: "Total Revenue",
            value: totalRevenue,
            icon: ReceiptText,
            tone: metricTone.teal,
          },
          {
            label: "Collected amount without GST",
            value: totalCollected,
            icon: IndianRupee,
            tone: metricTone.emerald,
          },
          {
            label: "Pending",
            value: pending,
            icon: Clock3,
            tone: metricTone.rose,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className={`overflow-hidden rounded-xl border ${item.tone.border} bg-white shadow-sm`}
            >
              <div className={`h-1 ${item.tone.bar}`} />
              <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    {rupee}
                    {formatCurrency(item.value)}
                  </p>
                </div>
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${item.tone.bg} ${item.tone.text}`}
                >
                  <Icon className="size-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Basic Details">
          <Detail label="PO Number" value={po.customerPONumber} />
          <Detail label="Status" value={<StatusBadge value={po.status} />} />
          <Detail label="Owner" value={po.poOwner} />
          <Detail label="Payment Terms" value={po.paymentTerms} />
          <Detail label="Remark" value={po.remark} />
          <Detail label="Start Date" value={formatStoredDate(po.startFrom)} />
          <Detail label="End Date" value={formatStoredDate(po.endDate)} />
        </Panel>

        <Panel title="Relations">
          <Detail label="Service Type" value={po.ServiceType?.name} />
          <Detail label="Billing Plan" value={po.billingPlan?.name} />
          <Detail
            label="Duration"
            value={`${po.contractDuration?.totalNumberOfMonths || "-"} months`}
          />
          <Detail label="Contract" value={po.contract?.name} />
          <Detail
            label="Vendor"
            value={
              po.vendor?.companyName ||
              [po.vendor?.firstName, po.vendor?.lastName].filter(Boolean).join(" ") ||
              "-"
            }
          />
        </Panel>
      </div>

      <Panel title="Company">
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <Detail label="Company" value={po.customer?.companyName} />
          <Detail
            label="Name"
            value={
              po.customer
                ? `${po.customer.firstName} ${po.customer.lastName}`
                : "-"
            }
          />
          <Detail label="Email" value={po.customer?.email} />
          <Detail label="Phone" value={po.customer?.phone} />
        </div>
      </Panel>

      <Panel title="Billing Cycles">
        {billingCycles.length ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                    <th className="p-3 text-left font-semibold">#</th>
                    <th className="p-3 text-left font-semibold">Month</th>
                    <th className="p-3 text-left font-semibold">Invoice</th>
                    <th className="p-3 text-right font-semibold">Invoice Amount</th>
                    <th className="p-3 text-right font-semibold">Collected amount without GST</th>
                    <th className="p-3 text-right font-semibold">Pending</th>
                    <th className="p-3 text-left font-semibold">Invoice Date</th>
                    <th className="p-3 text-left font-semibold">Payment Received Date</th>
                    <th className="p-3 text-left font-semibold">Due Date</th>
                    <th className="p-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {billingCycles.map((bc, index) => {
                    const invoiceAmount = Number(bc.invoiceAmount || 0);
                    const pendingAmount =
                      invoiceAmount - Number(bc.collectedAmount || 0);

                    return (
                      <tr key={bc.id} className="transition-colors hover:bg-blue-50/40">
                        <td className="p-3 text-zinc-500">{index + 1}</td>
                        <td className="p-3 font-medium text-zinc-900">
                          {bc.invoiceDate
                            ? moment(bc.invoiceDate).format("MMMM YYYY")
                            : "-"}
                        </td>
                        <td className="p-3 text-zinc-700">{bc.invoiceNumber || "-"}</td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(invoiceAmount)}
                        </td>
                        <td className="p-3 text-right font-medium text-emerald-700">
                          {rupee}
                          {formatCurrency(bc.collectedAmount)}
                        </td>
                        <td className="p-3 text-right font-medium text-rose-700">
                          {rupee}
                          {formatCurrency(pendingAmount)}
                        </td>
                        <td className="p-3 text-zinc-700">
                          {formatStoredDate(bc.invoiceDate)}
                        </td>
                        <td className="p-3 text-zinc-700">
                          {bc.payments && bc.payments.length > 0
                            ? bc.payments.map((payment) => (
                                <span key={`${payment.receivedDate}-${payment.amount}`} className="block">
                                  {formatStoredDate(payment.receivedDate)}
                                  {typeof payment.amount === "number"
                                    ? ` · ${rupee}${formatCurrency(payment.amount)}`
                                    : ""}
                                </span>
                              ))
                            : formatStoredDate(bc.paymentReceivedDate)}
                        </td>
                        <td className="p-3 text-zinc-700">
                          {formatStoredDate(bc.paymentDueDate)}
                        </td>
                        <td className="p-3">
                          <StatusBadge value={bc.paymentReceived} />
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
