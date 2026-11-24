"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import { EditIcon, Trash } from "lucide-react"
import type { Customer } from "@prisma/client"

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: { canEdit: boolean; canDelete: boolean; onEdit: (customer: Customer) => void; onDelete: (id: string) => void | Promise<void> }): ColumnDef<Customer>[] => {
  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: "customerCode",
      header: "Customer Code",
    },
    {
      accessorKey: "firstName",
      header: "Customer Name",
      cell: ({ row }) => {
        const customer = row.original;

        return (
          <div>
            {customer.firstName} {customer.lastName ?? ""}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "city",
      header: "City",
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
                aria-label={`Edit ${row.original.customerCode}`}
                onClick={() => onEdit(row.original)}
              >
                <EditIcon size={16} />
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete Customer?"
                description="Are you sure you want to delete this customer? This action cannot be undone."
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
