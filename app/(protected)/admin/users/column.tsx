import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import { ColumnDef } from "@tanstack/react-table"
import { EditIcon, Trash } from "lucide-react"
import type { getUsers } from "@/lib/actions/users"
type UserRow = Awaited<ReturnType<typeof getUsers>>[number]
type ColumnOptions = { canEdit: boolean; canDelete: boolean; onDelete: (id: string) => void | Promise<void>; onEdit: (row: UserRow) => void }

export const getUsersColumns = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: ColumnOptions): ColumnDef<UserRow>[] => {
  const baseColumns: ColumnDef<UserRow>[] = [
    { accessorKey: "username", header: "Username" },
    { accessorKey: "firstName", header: "First Name" },
    { accessorKey: "lastName", header: "Last Name" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) =>
        row.original.roleId && row.original?.role.name,
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

  if (canEdit || canDelete) {
    baseColumns.push({
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
                aria-label={`Edit ${row.original.username}`}
                onClick={() => onEdit(row.original)}
              >
                <EditIcon size={16} />
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete User?"
                description="Are you sure you want to delete this user? This action cannot be undone."
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

  return baseColumns;
};
