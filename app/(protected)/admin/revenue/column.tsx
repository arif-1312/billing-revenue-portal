import { ColumnDef } from "@tanstack/react-table";
import { EditIcon, Eye, Trash } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dailog";
import { billedInvoiceAmount } from "@/lib/invoice-balances";

type BillingCycleRow = {
  invoiceAmount?: number | null;
  collectedAmount?: number | null;
  invoiceDate?: string | Date | null;
  billingSubmittedDate?: string | Date | null;
  paymentDueDate?: string | Date | null;
};

type RevenueRow = {
  id: string;
  company?: { name?: string | null } | null;
  customer?: { companyName?: string | null } | null;
  vendor?:
    | {
        companyName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
      }
    | null;
  customerPONumber?: string | null;
  scope?: string | null;
  poOwner?: string | null;
  poAmount?: number | null;
  billingCycles?: BillingCycleRow[] | null;
  billingPlan?: { name?: string | null } | null;
  ServiceType?: { name?: string | null } | null;
  status?: string | null;
};

function getRevenueTotals(
  cycles: BillingCycleRow[] | null | undefined,
) {
  return (cycles || []).reduce(
    (sum, cycle) => {
      const billedAmount = billedInvoiceAmount(cycle);
      const collectedAmount = Math.min(
        Number(cycle.collectedAmount || 0),
        billedAmount,
      );

      return {
        billed: sum.billed + billedAmount,
        collected: sum.collected + collectedAmount,
      };
    },
    { billed: 0, collected: 0 },
  );
}

function formatCurrency(value: number) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}): ColumnDef<RevenueRow>[] => {
  const columns: ColumnDef<RevenueRow>[] = [
    {
      id: "company",
      accessorFn: (row) =>
        [row.company?.name, row.customer?.companyName]
          .filter(Boolean)
          .join(" "),
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Company
        </span>
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-900">
            {row.original.company?.name || "-"}
          </p>
          <p className="text-xs text-slate-500">
            {row.original.customer?.companyName ||
              "No mapped customer"}
          </p>
        </div>
      ),
    },
    {
      id: "vendor",
      accessorFn: (row) =>
        [
          row.vendor?.companyName,
          row.vendor?.firstName,
          row.vendor?.lastName,
        ]
          .filter(Boolean)
          .join(" "),
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Vendor
        </span>
      ),
      cell: ({ row }) => {
        const vendor = row.original.vendor;
        const vendorName =
          vendor?.companyName ||
          [vendor?.firstName, vendor?.lastName].filter(Boolean).join(" ") ||
          "-";
        const contactName =
          [vendor?.firstName, vendor?.lastName].filter(Boolean).join(" ") || "-";

        return (
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">
              {vendorName}
            </p>
            <p className="text-xs text-slate-500">
              Contact: {contactName}
            </p>
          </div>
        );
      },
    },
    {
      id: "customerPONumber",
      accessorFn: (row) =>
        [row.customerPONumber, row.poOwner].filter(Boolean).join(" "),
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          PO Number
        </span>
      ),
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">
            {row.original.customerPONumber || "-"}
          </p>
          <p className="text-xs text-slate-500">
            Owner: {row.original.poOwner || "Unassigned"}
          </p>
        </div>
      ),
    },
    {
      accessorFn: (row) => row.scope ?? "",
      id: "scope",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Scope Of Work
        </span>
      ),
      cell: ({ row }) => (
        <div className="max-w-[220px]">
          <p className="line-clamp-2 text-sm font-medium text-slate-900">
            {row.original.scope || "-"}
          </p>
        </div>
      ),
    },
    {
      id: "billed",
      accessorFn: (row) => {
        const totals = getRevenueTotals(row.billingCycles);

        return [
          formatCurrency(totals.billed),
          formatCurrency(totals.collected),
          totals.billed.toString(),
          totals.collected.toString(),
        ].join(" ");
      },
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Billed
        </span>
      ),
      cell: ({ row }) => {
        const totals = getRevenueTotals(row.original.billingCycles);

        return (
          <div className="space-y-1">
            <p className="font-semibold text-emerald-600">
              {formatCurrency(totals.billed)}
            </p>
            <p className="text-xs text-slate-500">
              Collected amount without GST {formatCurrency(totals.collected)}
            </p>
          </div>
        );
      },
    },
    {
      id: "collectionHealth",
      accessorFn: (row) => {
        const totals = getRevenueTotals(row.billingCycles);
        const pending = Math.max(totals.billed - totals.collected, 0);
        const ratio =
          totals.billed > 0
            ? Math.round((totals.collected / totals.billed) * 10000) / 100
            : 0;

        return [
          `${ratio}% realized`,
          `${ratio} realized`,
          formatCurrency(pending),
          pending.toString(),
        ].join(" ");
      },
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Collection Health
        </span>
      ),
      cell: ({ row }) => {
        const totals = getRevenueTotals(row.original.billingCycles);
        const pending = Math.max(
          totals.billed - totals.collected,
          0,
        );
        const ratio =
          totals.billed > 0
            ? Math.round((totals.collected / totals.billed) * 10000) / 100
            : 0;

        return (
          <div className="min-w-[160px] space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>{ratio.toFixed(2)}% realized</span>
              <span>{formatCurrency(pending)} pending</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${
                  ratio >= 85
                    ? "bg-emerald-500"
                    : ratio >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(ratio, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      id: "billingPlan",
      accessorFn: (row) => row.billingPlan?.name ?? "",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Billing Plan
        </span>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50"
        >
          {row.original.billingPlan?.name || "-"}
        </Badge>
      ),
    },
    {
      id: "serviceType",
      accessorFn: (row) => row.ServiceType?.name ?? "",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Service Type
        </span>
      ),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
        >
          {row.original.ServiceType?.name || "-"}
        </Badge>
      ),
    },
    {
      accessorFn: (row) => row.status ?? "",
      id: "status",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Status
        </span>
      ),
      cell: ({ row }) => {
        const status = row.original.status;

        if (status === "LIVE") {
          return (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
              LIVE
            </Badge>
          );
        }

        if (status === "COMPLETED") {
          return (
            <Badge className="bg-teal-500 text-white hover:bg-teal-600">
              COMPLETED
            </Badge>
          );
        }

        return (
          <Badge variant="destructive" className="text-white">
            {status}
          </Badge>
        );
      },
    },
  ];

  columns.push({
    id: "actions",
    enableGlobalFilter: false,
    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wider text-white">
        Action
      </span>
    ),
    cell: ({ row }) => {
      const id = row.original.id as string;

      return (
        <div className="flex gap-2">
          <Button
            size="icon"
            asChild
            className="cursor-pointer rounded-xl bg-blue-500 shadow-sm hover:bg-blue-600"
          >
            <Link href={`/admin/revenue/view/${id}`}>
              <Eye size={16} />
            </Link>
          </Button>

          {canEdit && (
            <Button
              asChild
              size="icon"
              className="cursor-pointer rounded-xl bg-orange-500 shadow-sm hover:bg-orange-600"
            >
              <Link href={`/admin/revenue/edit/${id}`}>
                <EditIcon size={16} />
              </Link>
            </Button>
          )}

          {canDelete && (
            <DeleteDialog
              onConfirm={() => onDelete(id)}
              title="Delete Revenue Record?"
              description="Are you sure you want to delete this revenue record? This action cannot be undone."
              confirmText="OK"
            >
              <Button
                size="icon"
                variant="destructive"
                className="cursor-pointer rounded-xl shadow-sm"
              >
                <Trash size={16} />
              </Button>
            </DeleteDialog>
          )}
        </div>
      );
    },
  });

  return columns;
};
