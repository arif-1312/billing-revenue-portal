"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteCompany, getCompanys } from "@/lib/actions/company";
import CompanyForm from "@/components/company/company-form"
import type { Company } from "@/types"
type CompanyRow = Awaited<ReturnType<typeof getCompanys>>[number];
type DataTableProps = { data: CompanyRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export default function CompanyDataTable({
    data,
    canCreate,
    canEdit,
    canDelete,
    title,
}: DataTableProps) {
    const [tableData, setTableData] = React.useState<CompanyRow[]>(data);
    const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null)
    const [selectedCompany, setSelectedCompany] = React.useState<Company | undefined>()
    const router = useRouter()

    const closeForm = () => {
        setFormMode(null)
        setSelectedCompany(undefined)
    }

    const openCreateForm = () => {
        setSelectedCompany(undefined)
        setFormMode("create")
    }

    const openEditForm = (company: CompanyRow) => {
        setSelectedCompany(Object.fromEntries(
            Object.entries(company).map(([key, value]) => [key, value ?? undefined]),
        ) as Company)
        setFormMode("edit")
    }

    const handleFormSuccess = async () => {
        closeForm()
        setTableData(await getCompanys())
        router.refresh()
    }

    const deleteHandler = async (id: string) => {
        const res = await deleteCompany(id);

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
        onDelete: deleteHandler,
        onEdit: openEditForm,
    });

    return (
        <>
            <DataTable
                data={tableData}
                columns={columns}
                title={title}
                actions={canCreate ? (
                    <Button className="bg-blue-500 hover:bg-blue-600" onClick={openCreateForm}>
                        Add Company
                    </Button>
                ) : undefined}
            />

            <Dialog
                open={formMode !== null}
                onOpenChange={(open) => {
                    if (!open) closeForm()
                }}
            >
                <DialogContent
                    scrollBody
                    className="max-h-[90vh] sm:max-w-5xl"
                    onInteractOutside={(event) => event.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>{formMode === "edit" ? "Edit Company" : "Add Company"}</DialogTitle>
                        <DialogDescription>
                            {formMode === "edit"
                                ? "Update the company details below."
                                : "Enter the details to add a company."}
                        </DialogDescription>
                    </DialogHeader>
                    {formMode && (
                        <CompanyForm
                            key={`${formMode}-${selectedCompany?.id ?? "new"}`}
                            data={selectedCompany}
                            update={formMode === "edit"}
                            onSuccess={handleFormSuccess}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
