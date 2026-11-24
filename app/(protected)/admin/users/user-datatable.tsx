"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import UserForm from "@/components/user/user-form"
import type { User } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteUser, getUsers } from "@/lib/actions/users";
type UserRow = Awaited<ReturnType<typeof getUsers>>[number];
type DataTableProps = { data: UserRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function UserDataTable({
    data,
    canCreate,
    canEdit,
    canDelete,
    title,
    actions
}: DataTableProps) {
    const [tableData, setTableData] = React.useState<UserRow[]>(data);
    const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
    const [selectedUser, setSelectedUser] = React.useState<User | undefined>();
    const router = useRouter();

    const closeForm = () => {
        setFormMode(null);
        setSelectedUser(undefined);
    };

    const openCreateForm = () => {
        setSelectedUser(undefined);
        setFormMode("create");
    };

    const openEditForm = (user: User) => {
        setSelectedUser(user);
        setFormMode("edit");
    };

    const handleFormSuccess = async () => {
        closeForm();
        setTableData(await getUsers());
        router.refresh();
    };

    const deleteHandler = async (id: string) => {
        const res = await deleteUser(id);

        if (!res?.success) {
            toast.error("Error", { description: res?.message });
            return;
        }

        toast.success("Success", { description: res?.message });

        setTableData((prev) =>
            prev.filter((r) => r.id !== id)
        );
    };

    const columns = getUsersColumns({
        canEdit,
        canDelete,
        onEdit: openEditForm,
        onDelete: deleteHandler,
    });

    return (
        <>
            <DataTable
                data={tableData}
                columns={columns}
                title={title}
                actions={canCreate ? <Button onClick={openCreateForm}>Add User</Button> : actions}
            />
            <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
                <DialogContent scrollBody className="max-h-[90vh] sm:max-w-4xl" onInteractOutside={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{formMode === "edit" ? "Edit User" : "Add User"}</DialogTitle>
                        <DialogDescription>
                            {formMode === "edit" ? "Update the user details below." : "Enter the details to add a user."}
                        </DialogDescription>
                    </DialogHeader>
                    {formMode && (
                        <UserForm
                            key={`${formMode}-${selectedUser?.id ?? "new"}`}
                            data={selectedUser}
                            update={formMode === "edit"}
                            onSuccess={handleFormSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
