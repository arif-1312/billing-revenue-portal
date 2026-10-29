import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dailog";
import type { CreditNoteRecord } from "@/lib/actions/credit-note";
import { ColumnDef } from "@tanstack/react-table";
import { EditIcon, Trash } from "lucide-react";
import Link from "next/link";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "-";
  return `${day}/${month}/${year}`;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export const getCreditNoteColumns = ({
  canEdit,
  canDelete,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}): ColumnDef<CreditNoteRecord>[] => {
  const columns: ColumnDef<CreditNoteRecord>[] = [
    {
      accessorKey: "particulars",
      header: "Particulars",
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "vchType",
      header: "Vch Type",
    },
    {
      accessorKey: "vchNo",
      header: "Vch No.",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => formatAmount(row.original.amount),
    },
  ];

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const id = row.original.id;

        return (
          <div className="flex gap-2">
            {canEdit && (
              <Button asChild size="icon" className="bg-orange-500 hover:bg-orange-600">
                <Link href={`/admin/credit-note/edit/${id}`}>
                  <EditIcon size={16} />
                </Link>
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete Credit Note?"
                description="Are you sure you want to delete this credit note? This action cannot be undone."
              >
                <Button size="icon" variant="destructive">
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
