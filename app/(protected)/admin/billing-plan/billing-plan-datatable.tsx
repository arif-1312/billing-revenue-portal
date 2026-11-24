"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BillingPlanForm from "@/components/billing-plan/billing-plan-form";
import type { BillingPlan } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteBillingPlan, getBillingPlans } from "@/lib/actions/billing-plan";
type BillingPlanResult = Awaited<ReturnType<typeof getBillingPlans>>;
type BillingPlanRow = Extract<BillingPlanResult, readonly unknown[]>[number];
type DataTableProps = { data: BillingPlanRow[]; canCreate: boolean; canEdit: boolean; canDelete: boolean; title: string; actions?: React.ReactNode };

export default function BillingPlanDataTable({
  data,
  canCreate,
  canEdit,
  canDelete,
  title,
  actions,
}: DataTableProps) {
  const [tableData, setTableData] = React.useState<BillingPlanRow[]>(data);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [selectedBillingPlan, setSelectedBillingPlan] = React.useState<BillingPlan | undefined>();
  const router = useRouter();

  const closeForm = () => {
    setFormMode(null);
    setSelectedBillingPlan(undefined);
  };

  const openCreateForm = () => {
    setSelectedBillingPlan(undefined);
    setFormMode("create");
  };

  const openEditForm = (billingPlan: BillingPlan) => {
    setSelectedBillingPlan(billingPlan);
    setFormMode("edit");
  };

  const handleFormSuccess = async () => {
    closeForm();
    const refreshedPlans = await getBillingPlans();
    if (Array.isArray(refreshedPlans)) setTableData(refreshedPlans);
    router.refresh();
  };

  const deleteHandler = async (id: string) => {
    const res = await deleteBillingPlan(id);

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
          Add Billing Plan
        </Button>
      ) : actions}
    />
    <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
      <DialogContent scrollBody className="max-h-[90vh] sm:max-w-3xl" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{formMode === "edit" ? "Edit Billing Plan" : "Add Billing Plan"}</DialogTitle>
          <DialogDescription>
            {formMode === "edit" ? "Update the billing plan details below." : "Enter the details to add a billing plan."}
          </DialogDescription>
        </DialogHeader>
        {formMode && (
          <BillingPlanForm
            key={`${formMode}-${selectedBillingPlan?.id ?? "new"}`}
            data={selectedBillingPlan}
            update={formMode === "edit"}
            onSuccess={handleFormSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
