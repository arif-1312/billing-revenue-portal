"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteContractType, getContractTypes } from "@/lib/actions/contract-type";
type ContractTypeRow = Awaited<ReturnType<typeof getContractTypes>>[number];
type DataTableProps = { data: ContractTypeRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };
import ContractTypeForm from "@/components/contract-type/contract-type-form";
import type { ContractType } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ContractTypeDataTable({
  data,
  canCreate,
  canEdit,
  canDelete,
  title,
  actions,
}: DataTableProps) {
  const [tableData, setTableData] = React.useState<ContractTypeRow[]>(data);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [selectedContractType, setSelectedContractType] = React.useState<ContractType | undefined>();
  const router = useRouter();

  const closeForm = () => {
    setFormMode(null);
    setSelectedContractType(undefined);
  };

  const openCreateForm = () => {
    setSelectedContractType(undefined);
    setFormMode("create");
  };

  const openEditForm = (contractType: ContractType) => {
    setSelectedContractType(contractType);
    setFormMode("edit");
  };

  const handleFormSuccess = async () => {
    closeForm();
    const refreshedContractTypes = await getContractTypes();
    setTableData(refreshedContractTypes);
    router.refresh();
  };

  const deleteHandler = async (id: string) => {
    const res = await deleteContractType(id);

    if (!res?.success) {
      toast.error("Error", { description: res?.message });
      return;
    }

    toast.success("Success", { description: res?.message });

    setTableData((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
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
      actions={canCreate ? (
        <Button className="bg-blue-500 hover:bg-blue-600" onClick={openCreateForm}>
          Add Contract Type
        </Button>
      ) : actions}
    />

    <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent
        scrollBody
        className="max-h-[90vh] sm:max-w-2xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{formMode === "edit" ? "Edit Contract Type" : "Add Contract Type"}</DialogTitle>
          <DialogDescription>
            {formMode === "edit" ? "Update the contract type details below." : "Enter the details to add a contract type."}
          </DialogDescription>
        </DialogHeader>
        {formMode && (
          <ContractTypeForm
            key={`${formMode}-${selectedContractType?.id ?? "new"}`}
            data={selectedContractType}
            update={formMode === "edit"}
            onSuccess={handleFormSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
