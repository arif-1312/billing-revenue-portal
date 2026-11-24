"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import RoleForm from "@/components/role/role-form"
import type { Module } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteRole, getRoles } from "@/lib/actions/role";

type RoleRow = Awaited<ReturnType<typeof getRoles>>[number];
type DataTableProps = { data: RoleRow[]; modules: Module[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function RoleDataTable({
    data,
    modules,
    canCreate,
    canEdit,
    canDelete,
    title,
    actions
}: DataTableProps) {
    const [tableData, setTableData] = React.useState<RoleRow[]>(data);
    const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
    const [selectedRole, setSelectedRole] = React.useState<RoleRow | undefined>();
    const router = useRouter();

    const closeForm = () => {
        setFormMode(null);
        setSelectedRole(undefined);
    };

    const openCreateForm = () => {
        setSelectedRole(undefined);
        setFormMode("create");
    };

    const openEditForm = (role: RoleRow) => {
        setSelectedRole(role);
        setFormMode("edit");
    };

    const handleFormSuccess = async () => {
        closeForm();
        setTableData(await getRoles());
        router.refresh();
    };

    const deleteHandler = async (id: string) => {
        const res = await deleteRole(id);

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
                actions={canCreate ? <Button onClick={openCreateForm}>Add Role</Button> : actions}
            />
            <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
                <DialogContent scrollBody className="max-h-[90vh] sm:max-w-5xl" onInteractOutside={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{formMode === "edit" ? "Edit Role" : "Add Role"}</DialogTitle>
                        <DialogDescription>
                            {formMode === "edit" ? "Update the role and its permissions below." : "Enter the role details and permissions."}
                        </DialogDescription>
                    </DialogHeader>
                    {formMode && (
                        <RoleForm
                            key={`${formMode}-${selectedRole?.id ?? "new"}`}
                            data={selectedRole}
                            update={formMode === "edit"}
                            modules={modules}
                            onSuccess={handleFormSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
