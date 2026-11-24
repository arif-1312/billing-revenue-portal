"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dailog";
import { EditIcon, Trash } from "lucide-react";
import type { ContractType } from "@/types";

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (contractType: ContractType) => void;
  onDelete: (id: string) => void;
}): ColumnDef<ContractType>[] => {
  const columns: ColumnDef<ContractType>[] = [
    {
      accessorKey: "name",
      header: () => (
        <div className="font-semibold text-xs uppercase tracking-wider text-white dark:text-slate-4000">
          Name
        </div>
      ),
      cell: ({ row }) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "remark",
      header: () => (
        <div className="font-semibold text-xs uppercase tracking-wider text-white dark:text-slate-4000">
          Remark
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-gray-600 dark:text-gray-300">
          {row.original.remark ?? "-"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <div className="font-semibold text-xs uppercase tracking-wider text-white dark:text-slate-4000">
          Created Date
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-gray-600 dark:text-gray-300">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString("en-GB")
            : "-"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: () => (
        <div className="font-semibold text-xs uppercase tracking-wider text-white dark:text-slate-4000">
          Status
        </div>
      ),
      cell: ({ row }) => {
        const status = row.original.status;

        return status === "ACTIVE" ? (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-full">
            ACTIVE
          </Badge>
        ) : (
          <Badge className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full">
            INACTIVE
          </Badge>
        );
      },
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: () => (
        <div className="font-semibold text-xs uppercase tracking-wider text-white dark:text-slate-4000">
          Action
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
          {canEdit && (
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg bg-amber-500 shadow-sm hover:bg-amber-600"
              aria-label={`Edit ${row.original.name}`}
              onClick={() => onEdit(row.original)}
            >
              <EditIcon size={16} />
            </Button>
          )}
          {canDelete && (
            <DeleteDialog
              onConfirm={() => onDelete(row.original.id ?? "")}
              title="Delete Contract Type?"
              description={`Are you sure you want to delete ${row.original.name}? This action cannot be undone.`}
              preventOutsideDismiss
            >
              <Button
                size="icon"
                variant="destructive"
                aria-label={`Delete ${row.original.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Trash size={16} />
              </Button>
            </DeleteDialog>
          )}
        </div>
      ),
    });
  }

  return columns;
};
