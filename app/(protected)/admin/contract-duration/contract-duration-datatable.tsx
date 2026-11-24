"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ContractDurationForm from "@/components/contract-duration/contract-duration-form";
import type { ContractDuration } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteContractDuration, getContractDurations } from "@/lib/actions/contract-duration";
type ContractDurationRow = Awaited<ReturnType<typeof getContractDurations>>[number];
type DataTableProps = { data: ContractDurationRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function ContractDurationDataTable({
  data,
  canCreate,
  canEdit,
  canDelete,
  title,
  actions,
}: DataTableProps) {
  const [tableData, setTableData] = React.useState<ContractDurationRow[]>(data);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [selectedDuration, setSelectedDuration] = React.useState<ContractDuration | undefined>();
  const router = useRouter();

  const closeForm = () => {
    setFormMode(null);
    setSelectedDuration(undefined);
  };

  const openCreateForm = () => {
    setSelectedDuration(undefined);
    setFormMode("create");
  };

  const openEditForm = (duration: ContractDuration) => {
    setSelectedDuration(duration);
    setFormMode("edit");
  };

  const handleFormSuccess = async () => {
    closeForm();
    setTableData(await getContractDurations());
    router.refresh();
  };

  const deleteHandler = async (id: string) => {
    const res = await deleteContractDuration(id);

    if (!res?.success) {
      toast.error("Error", { description: res?.message });
      return;
    }

    toast.success("Success", { description: res?.message });

    setTableData((prev) => prev.filter((r) => r.id !== id));
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
          Add Contract Duration
        </Button>
      ) : actions}
    />
    <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent scrollBody className="max-h-[90vh] sm:max-w-2xl" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{formMode === "edit" ? "Edit Contract Duration" : "Add Contract Duration"}</DialogTitle>
          <DialogDescription>
            {formMode === "edit" ? "Update the contract duration details below." : "Enter the details to add a contract duration."}
          </DialogDescription>
        </DialogHeader>
        {formMode && (
          <ContractDurationForm
            key={`${formMode}-${selectedDuration?.id ?? "new"}`}
            data={selectedDuration}
            update={formMode === "edit"}
            onSuccess={handleFormSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
