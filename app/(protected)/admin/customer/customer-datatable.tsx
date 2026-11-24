"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import CustomerForm from "@/components/customer/customer-form"
import type { Customer as CustomerFormValues } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteCustomer, getCustomers } from "@/lib/actions/customer";

type CustomerRecord = Awaited<ReturnType<typeof getCustomers>>[number];
type DataTableProps = { data: CustomerRecord[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function CustomerDataTable({
  data,
  canCreate,
  canEdit,
  canDelete,
  title,
  actions
}: DataTableProps) {
  const [tableData, setTableData] = React.useState<CustomerRecord[]>(data);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerRecord | undefined>();
  const router = useRouter();

  const closeForm = () => {
    setFormMode(null);
    setSelectedCustomer(undefined);
  };

  const openCreateForm = () => {
    setSelectedCustomer(undefined);
    setFormMode("create");
  };

  const openEditForm = (customer: CustomerRecord) => {
    setSelectedCustomer(customer);
    setFormMode("edit");
  };

  const selectedCustomerFormValues = selectedCustomer
    ? (Object.fromEntries(
        Object.entries(selectedCustomer).map(([key, value]) => [
          key,
          value ?? undefined,
        ]),
      ) as CustomerFormValues)
    : undefined;

  const handleFormSuccess = async () => {
    closeForm();
    setTableData(await getCustomers());
    router.refresh();
  };

  const deleteHandler = async (id: string) => {
    const res = await deleteCustomer(id);

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
        actions={canCreate ? <Button onClick={openCreateForm}>Add Customer</Button> : actions}
      />
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent scrollBody className="max-h-[90vh] sm:max-w-4xl" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription >
              {formMode === "edit" ? "Update the customer details below." : "Enter the details to add a customer."}
            </DialogDescription>
          </DialogHeader>
          {formMode && (
            <CustomerForm
              key={`${formMode}-${selectedCustomer?.id ?? "new"}`}
              data={selectedCustomerFormValues}
              update={formMode === "edit"}
              onSuccess={handleFormSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
