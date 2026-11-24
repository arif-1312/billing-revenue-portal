"use client"

import * as React from "react"

import { toast } from "sonner"

import { DataTable } from "@/components/datatable/DataTable"
import { RevenueExcelActions } from "@/components/revenue/revenue-excel-actions"
import { deletePurchaseOrder } from "@/lib/actions/purschase-order"

import { getUsersColumns } from "./column"

type BillingCycleRow = {
  invoiceAmount?: number | null
  creditNote?: number | null
  collectedAmount?: number | null
  invoiceDate?: string | Date | null
  billingSubmittedDate?: string | Date | null
  paymentDueDate?: string | Date | null
}

type RevenueRow = {
  id: string
  poAmount?: number | null
  scope?: string | null
  status?: string | null
  company?: { name?: string | null } | null
  billingCycles?: BillingCycleRow[] | null
}

type RevenueDataTableProps = {
  data: RevenueRow[]
  canEdit: boolean
  canDelete: boolean
  canCreate: boolean
  title: string
  actions?: React.ReactNode
}

export default function RevenueDataTable({
  data,
  canEdit,
  canDelete,
  canCreate,
  title,
  actions,
}: RevenueDataTableProps) {
  const [removedRows, setRemovedRows] = React.useState<{
    source: RevenueRow[];
    ids: Set<string>;
  }>(() => ({ source: data, ids: new Set() }));
  const removedIds = removedRows.source === data ? removedRows.ids : new Set<string>();
  const tableData = data.filter((row) => !removedIds.has(row.id));

  const deleteHandler = async (id: string) => {
    const res = await deletePurchaseOrder(id)

    if (!res?.success) {
      toast.error("Error", { description: res?.message })
      return
    }

    toast.success("Success", { description: res?.message })

    setRemovedRows((current) => {
      const ids = new Set(current.source === data ? current.ids : []);
      ids.add(id);
      return { source: data, ids };
    });
  }

  const columns = getUsersColumns({
    canEdit,
    canDelete,
    onDelete: deleteHandler,
  })

  return (
    <div
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
    >
      <DataTable
        data={tableData}
        columns={columns}
        tableWidth="content"
        title={title}
        actions={actions}
        toolbar={(filteredRows) => (
          <RevenueExcelActions
            canCreate={canCreate}
            purchaseOrderIds={filteredRows.map((row) => row.id)}
          />
        )}
        rowClassName={(_, index) =>
          index % 2 === 0
            ? "bg-white hover:bg-[#EAF3FC] transition-colors"
            : "bg-slate-50/70 hover:bg-[#EAF3FC] transition-colors"
        }
      />
    </div>
  )
}
