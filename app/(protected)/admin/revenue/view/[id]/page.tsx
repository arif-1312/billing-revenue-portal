import type { ReactNode } from "react";

import { getPurchaseOrderById } from "@/lib/actions/purschase-order";
import Link from "next/link";
import moment from "moment";
import { ArrowLeft, Clock3, IndianRupee, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatStoredDate } from "@/lib/date-utils";
import { billedInvoiceAmount } from "@/lib/invoice-balances";
import { canAccess } from "@/lib/rbac";

interface Props {
  params: Promise<{ id: string }>;
}

type BillingCycleView = {
  id: string;
  invoiceAmount?: number | null;
  creditNote?: number | null;
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
  "rounded-xl border border-zinc-200/90 bg-white p-5 shadow-[0_18px_42px_-34px_rgba(39,39,42,0.28)]";

const metricTone = {
  teal: {
    border: "border-teal-200",
    bg: "bg-teal-50",
    text: "text-teal-700",
    bar: "bg-teal-500",
  },
  emerald: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-700",
    bar: "bg-rose-500",
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
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-[linear-gradient(135deg,#ffffff,#f8fafc_55%,#fff7ed)] shadow-[0_20px_56px_-42px_rgba(39,39,42,0.45)]">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 via-amber-400 to-rose-500" />
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Revenue Record
            </p>
            <h1 className="text-2xl font-semibold text-zinc-950 md:text-3xl">
              Revenue Details
            </h1>
            <p className="text-sm text-zinc-500">
              PO {po.customerPONumber || "-"} - {po.customer?.companyName || "Company not set"}
            </p>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-10 rounded-lg border-zinc-300 bg-white text-zinc-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
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
              className={`overflow-hidden rounded-xl border ${item.tone.border} bg-white shadow-[0_16px_38px_-32px_rgba(39,39,42,0.34)]`}
            >
              <div className={`h-1 ${item.tone.bar}`} />
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-950">
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
                    <th className="p-3 text-right font-semibold">Credit Note</th>
                    <th className="p-3 text-right font-semibold">Final Amount</th>
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
                    const finalInvoiceAmount = billedInvoiceAmount(bc);
                    const pendingAmount =
                      finalInvoiceAmount - Number(bc.collectedAmount || 0);

                    return (
                      <tr key={bc.id} className="transition-colors hover:bg-teal-50/45">
                        <td className="p-3 text-zinc-500">{index + 1}</td>
                        <td className="p-3 font-medium text-zinc-900">
                          {bc.invoiceDate
                            ? moment(bc.invoiceDate).format("MMMM YYYY")
                            : "-"}
                        </td>
                        <td className="p-3 text-zinc-700">{bc.invoiceNumber || "-"}</td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(Number(bc.invoiceAmount || 0))}
                        </td>
                        <td className="p-3 text-right font-medium text-zinc-700">
                          {rupee}
                          {formatCurrency(Number(bc.creditNote || 0))}
                        </td>
                        <td className="p-3 text-right font-medium text-zinc-900">
                          {rupee}
                          {formatCurrency(finalInvoiceAmount)}
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
