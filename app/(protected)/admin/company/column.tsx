"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import { EditIcon, Trash } from "lucide-react"
import type { getCompanys } from "@/lib/actions/company"
type CompanyRow = Awaited<ReturnType<typeof getCompanys>>[number]
type ColumnOptions = { canEdit: boolean; canDelete: boolean; onDelete: (id: string) => void | Promise<void>; onEdit: (row: CompanyRow) => void }
export const getUsersColumns = ({
  canEdit,
  canDelete,
  onDelete,
  onEdit,
}: ColumnOptions): ColumnDef<CompanyRow>[] => {
  const columns: ColumnDef<CompanyRow>[] = [
    {
      accessorKey: "companyCode",
      header: "Company Code",
    },
    {
      accessorKey: "name",
      header: "Company Name",
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
                onClick={() => onEdit(row.original)}
                aria-label={`Edit ${row.original.name}`}
              >
                <EditIcon size={16} />
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete Company?"
                description="Are you sure you want to delete this company? This action cannot be undone."
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
