"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { EditIcon, Trash } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import type { BillingPlan } from "@prisma/client"

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: { canEdit: boolean; canDelete: boolean; onEdit: (billingPlan: BillingPlan) => void; onDelete: (id: string) => void | Promise<void> }): ColumnDef<BillingPlan>[] => {
  const columns: ColumnDef<BillingPlan>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "totalBillingCycles",
      header: "Total Billing Cycles",
      cell: ({ row }) => row.original.totalBillingCycles ?? "-",
    },
    {
      accessorKey: "billingCycleType",
      header: "Billing Cycle Type",
      cell: ({ row }) => row.original.billingCycleType ?? "-",
    },
    {
      accessorKey: "remark",
      header: "Remark",
      cell: ({ row }) => (
        <div className="max-w-[240px] whitespace-normal break-words">
          {row.original.remark ?? "-"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created Date",
      cell: ({ row }) =>
        row.original.createdAt
          ? new Date(row.original.createdAt).toLocaleDateString("en-GB")
          : "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;

        return status === "ACTIVE" ? (
          <Badge className="bg-green-500">ACTIVE</Badge>
        ) : (
          <Badge variant="destructive">INACTIVE</Badge>
        );
      },
    },
  ];

  // ✅ Add Action column only if permission exists
  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const id = row.original.id as string;

        return (
          <div className="flex gap-2">
            {canEdit && (
              <Button
                size="icon"
                className="bg-orange-500 hover:bg-orange-600"
                aria-label={`Edit ${row.original.name}`}
                onClick={() => onEdit(row.original)}
              >
                <EditIcon size={16} />
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete Billing Plan?"
                description="Are you sure you want to delete this billing plan? This action cannot be undone."
                preventOutsideDismiss
              >
                <Button
                  size="icon"
                  variant="destructive"
                >
                  <Trash size={16} />
                </Button>
              </DeleteDialog>
            )}
          </div>
        );
      },
    });
  }

  return columns;
};
