"use client"

import * as React from "react"

import { toast } from "sonner"

import { DataTable } from "@/components/datatable/DataTable"
import { RevenueExcelActions } from "@/components/revenue/revenue-excel-actions"
import { deletePurchaseOrder } from "@/lib/actions/purschase-order"
import { billedInvoiceAmount } from "@/lib/invoice-balances"

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

function getRevenueTotals(
  cycles: BillingCycleRow[] | null | undefined,
) {
  return (cycles || []).reduce(
    (sum, cycle) => {
      const billedAmount = billedInvoiceAmount(cycle)
      const collectedAmount = Math.min(
        Number(cycle.collectedAmount || 0),
        billedAmount,
      )

      return {
        billed: sum.billed + billedAmount,
        collected: sum.collected + collectedAmount,
      }
    },
    { billed: 0, collected: 0 },
  )
}

export default function RevenueDataTable({
  data,
  canEdit,
  canDelete,
  canCreate,
  title,
  actions,
}: RevenueDataTableProps) {
  const [tableData, setTableData] = React.useState(data)

  React.useEffect(() => {
    setTableData(data)
  }, [data])

  const deleteHandler = async (id: string) => {
    const res = await deletePurchaseOrder(id)

    if (!res?.success) {
      toast.error("Error", { description: res?.message })
      return
    }

    toast.success("Success", { description: res?.message })

    setTableData((prev) => prev.filter((r) => r.id !== id))
  }

  const columns = getUsersColumns({
    canEdit,
    canDelete,
    onDelete: deleteHandler,
  })

  return (
    <div
      className="
        rounded-3xl
        border border-white/10 dark:border-white/5
        bg-gradient-to-br from-background via-background to-muted/30
        backdrop-blur-xl
        shadow-[0_8px_30px_rgb(0,0,0,0.08)]
        overflow-hidden
      "
    >
      <DataTable
        data={tableData}
        columns={columns}
        title={title}
        actions={actions}
        toolbar={(filteredRows) => (
          <RevenueExcelActions
            canCreate={canCreate}
            purchaseOrderIds={filteredRows.map((row) => row.id)}
          />
        )}
        rowClassName={(row) => {
          const totals = getRevenueTotals(row.billingCycles)
          const realization =
            totals.billed > 0
              ? (totals.collected / totals.billed) * 100
              : 0
          const isLive = row.status === "LIVE"

          if (realization >= 85) {
            return `
              bg-emerald-50/70
              dark:bg-emerald-950/20
              hover:bg-emerald-100/80
              dark:hover:bg-emerald-900/30
              hover:scale-[1.01]
              hover:shadow-md
              transition-all duration-300
              border-l-4 border-emerald-500
            `
          }

          if (isLive) {
            return `
              bg-amber-50/80
              dark:bg-amber-950/20
              hover:bg-amber-100/80
              dark:hover:bg-amber-900/30
              hover:scale-[1.01]
              hover:shadow-md
              transition-all duration-300
              border-l-4 border-amber-500
            `
          }

          return `
            bg-slate-50/80
            dark:bg-slate-900/40
            hover:bg-slate-100/80
            dark:hover:bg-slate-800/50
            hover:scale-[1.01]
            hover:shadow-md
            transition-all duration-300
            border-l-4 border-slate-400
          `
        }}
        className="
          [&_table]:border-separate
          [&_table]:border-spacing-y-1
          [&_tbody_tr]:rounded-xl
          [&_tbody_tr]:shadow-sm
          [&_tbody_tr]:overflow-hidden
          [&_tbody_tr]:animate-in
          [&_tbody_tr]:fade-in
          [&_tbody_tr]:slide-in-from-bottom-1
          [&_tbody_tr:nth-child(even)]:bg-muted/20
          [&_tbody_td]:px-4
          [&_tbody_td]:py-3
          [&_tbody_td]:text-sm
        "
      />
    </div>
  )
}
