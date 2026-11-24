import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dailog";
import { ColumnDef } from "@tanstack/react-table";
import { EditIcon, Eye, Trash } from "lucide-react";
import Link from "next/link";

export type ProjectRow = {
  id: string;

  company: {
    name?: string | null;
  };

  projectName?: string | null;

  poValue?: unknown;

  totalRevenue?: unknown;

  totalCost?: unknown;

  projectedProfit?: unknown;

  status?: string | null;
};

type ProjectColumnsProps = {
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onDelete: (id: string) => void;
};

function formatCurrency(
  value: unknown,
) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onDelete,
}: ProjectColumnsProps): ColumnDef<ProjectRow>[] => {
  const columns: ColumnDef<ProjectRow>[] = [
    {
      accessorKey: "companyId",

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
        </div>
      ),
    },

    {
      accessorKey: "projectName",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Project Name
        </span>
      ),

      cell: ({ row }) => (
        <p className="font-medium text-indigo-600">
          {row.original.projectName || "-"}
        </p>
      ),
    },

    {
      accessorKey: "poValue",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          PO Value
        </span>
      ),

      cell: ({ row }) => (
        <p className="font-semibold text-emerald-600">
          {formatCurrency(row.original.poValue)}
        </p>
      ),
    },

    {
      accessorKey: "totalRevenue",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Revenue
        </span>
      ),

      cell: ({ row }) => (
        <p className="font-semibold text-green-600">
          {formatCurrency(row.original.totalRevenue)}
        </p>
      ),
    },

    {
      accessorKey: "totalCost",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Cost
        </span>
      ),

      cell: ({ row }) => (
        <p className="font-semibold text-rose-600">
          {formatCurrency(row.original.totalCost)}
        </p>
      ),
    },

    {
      accessorKey: "currentGM",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          GM %
        </span>
      ),

      cell: ({ row }) => {
        const revenue =
          Number(row.original.totalRevenue) || 0;

        const cost =
          Number(row.original.totalCost) || 0;

        const gm =
          revenue === 0
            ? 0
            : Number(
                (
                  ((revenue - cost) / revenue) *
                  100
                ).toFixed(2),
              );

        return (
          <Badge
            className={
              gm >= 20
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-rose-100 text-rose-700 hover:bg-rose-100"
            }
          >
            {gm} %
          </Badge>
        );
      },
    },

    {
      accessorKey: "projectedProfit",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Projected Profit %
        </span>
      ),

      cell: ({ row }) => (
        <p className="font-semibold text-blue-600">
          {Number(row.original.projectedProfit) || 0} %
        </p>
      ),
    },

    {
      accessorKey: "status",

      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Status
        </span>
      ),

      cell: ({ row }) => {
        const status = row.original.status;

        return status === "ACTIVE" ? (
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
            ACTIVE
          </Badge>
        ) : (
          <Badge variant="destructive">
            INACTIVE
          </Badge>
        );
      },
    },
  ];

  columns.push({
    id: "actions",

    header: () => (
      <span className="text-xs font-semibold uppercase tracking-wider text-white">
        Action
      </span>
    ),

    cell: ({ row }) => {
      const id = row.original.id;

      return (
        <div className="flex gap-2">
          {/* View */}
          <Button
            size="icon"
            asChild
            className="cursor-pointer rounded-xl bg-blue-500 shadow-sm hover:bg-blue-600"
          >
            <Link href={`/admin/pl/view/${id}`}>
              <Eye size={16} />
            </Link>
          </Button>

          {/* Edit */}
          {canEdit && (
            <Button
              asChild
              size="icon"
              className="cursor-pointer rounded-xl bg-orange-500 shadow-sm hover:bg-orange-600"
            >
              <Link href={`/admin/pl/edit/${id}`}>
                <EditIcon size={16} />
              </Link>
            </Button>
          )}

          {/* Delete */}
          {canDelete && (
            <DeleteDialog
              onConfirm={() => onDelete(id)}
              title="Delete Project?"
              description="Are you sure you want to delete this project?"
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
