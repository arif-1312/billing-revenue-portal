import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import { ColumnDef } from "@tanstack/react-table"
import { EditIcon, Trash } from "lucide-react"
import type { getRoles } from "@/lib/actions/role"
type RoleRow = Awaited<ReturnType<typeof getRoles>>[number]
type ColumnOptions = { canEdit: boolean; canDelete: boolean; onDelete: (id: string) => void | Promise<void>; onEdit: (row: RoleRow) => void }

export const getUsersColumns = ({
    canEdit,
    canDelete,
    onEdit,
    onDelete,
}: ColumnOptions): ColumnDef<RoleRow>[] => {
    const columns: ColumnDef<RoleRow>[] = [
        {
            accessorKey: "name",
            header: "Name",
        },
        {
            accessorKey: "remark",
            header: "Remark",
            cell: ({ row }) => row.original.remark ?? "-",
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

    // ✅ Add Action column only if user has permission
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
                                title="Delete Role?"
                                description="Are you sure you want to delete this role? This action cannot be undone."
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
