"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import ModuleForm from "@/components/user/module-form"
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
import { deleteModule, getModules } from "@/lib/actions/module-action";
type ModuleRow = Awaited<ReturnType<typeof getModules>>[number];
type DataTableProps = { data: ModuleRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function ModuleDataTable({
    data,
    canCreate,
    canEdit,
    canDelete,
    title,
    actions
}: DataTableProps) {
    const [tableData, setTableData] = React.useState<ModuleRow[]>(data);
    const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
    const [selectedModule, setSelectedModule] = React.useState<Module | undefined>();
    const router = useRouter();

    const closeForm = () => {
        setFormMode(null);
        setSelectedModule(undefined);
    };

    const openCreateForm = () => {
        setSelectedModule(undefined);
        setFormMode("create");
    };

    const openEditForm = (module: Module) => {
        setSelectedModule(module);
        setFormMode("edit");
    };

    const handleFormSuccess = async () => {
        closeForm();
        setTableData(await getModules());
        router.refresh();
    };

    const deleteHandler = async (id: string) => {
        const res = await deleteModule(id);

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
                actions={canCreate ? <Button onClick={openCreateForm}>Add Module</Button> : actions}
            />
            <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
                <DialogContent scrollBody className="max-h-[90vh] sm:max-w-3xl" onInteractOutside={(event) => event.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{formMode === "edit" ? "Edit Module" : "Add Module"}</DialogTitle>
                        <DialogDescription>
                            {formMode === "edit" ? "Update the module details below." : "Enter the details to add a module."}
                        </DialogDescription>
                    </DialogHeader>
                    {formMode && (
                        <ModuleForm
                            key={`${formMode}-${selectedModule?.id ?? "new"}`}
                            data={selectedModule}
                            update={formMode === "edit"}
                            onSuccess={handleFormSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
