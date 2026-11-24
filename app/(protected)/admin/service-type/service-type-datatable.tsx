"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ServiceTypeForm from "@/components/service-type/service-type-form";
import type { ServiceType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteServiceType, getServiceTypes } from "@/lib/actions/service-type";
type ServiceTypeRow = Awaited<ReturnType<typeof getServiceTypes>>[number];
type DataTableProps = { data: ServiceTypeRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function ServiceTypeDataTable({
  data,
  canCreate,
  canEdit,
  canDelete,
  title,
  actions,
}: DataTableProps) {
  const [tableData, setTableData] = React.useState<ServiceTypeRow[]>(data);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [selectedServiceType, setSelectedServiceType] = React.useState<ServiceType | undefined>();
  const router = useRouter();

  const closeForm = () => {
    setFormMode(null);
    setSelectedServiceType(undefined);
  };

  const openCreateForm = () => {
    setSelectedServiceType(undefined);
    setFormMode("create");
  };

  const openEditForm = (serviceType: ServiceType) => {
    setSelectedServiceType(serviceType);
    setFormMode("edit");
  };

  const handleFormSuccess = async () => {
    closeForm();
    setTableData(await getServiceTypes());
    router.refresh();
  };

  const deleteHandler = async (id: string) => {
    const res = await deleteServiceType(id);

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
        <Button className="rounded-xl bg-sky-600 text-white shadow-sm hover:bg-sky-700" onClick={openCreateForm}>
          Add Service Type
        </Button>
      ) : actions}
    />
    <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent scrollBody className="max-h-[90vh] sm:max-w-2xl" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{formMode === "edit" ? "Edit Service Type" : "Add Service Type"}</DialogTitle>
          <DialogDescription>
            {formMode === "edit" ? "Update the service type details below." : "Enter the details to add a service type."}
          </DialogDescription>
        </DialogHeader>
        {formMode && (
          <ServiceTypeForm
            key={`${formMode}-${selectedServiceType?.id ?? "new"}`}
            data={selectedServiceType}
            update={formMode === "edit"}
            onSuccess={handleFormSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
