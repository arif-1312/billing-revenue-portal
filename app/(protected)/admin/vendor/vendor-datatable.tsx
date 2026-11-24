"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import VendorForm from "@/components/vendor/vendor-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { DataTable } from "@/components/datatable/DataTable"
import { deleteVendor, getVendors } from "@/lib/actions/vendor"
import { Vendor } from "@/types"

import { getVendorsColumns } from "./column"

type VendorDataTableProps = {
  data: Vendor[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  title: string
  actions?: React.ReactNode
}

export default function VendorDataTable({
  data,
  canEdit,
  canDelete,
  canCreate,
  title,
  actions,
}: VendorDataTableProps) {
  const [tableData, setTableData] = React.useState(data)
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null)
  const [selectedVendor, setSelectedVendor] = React.useState<Vendor | undefined>()
  const router = useRouter()

  const closeForm = () => {
    setFormMode(null)
    setSelectedVendor(undefined)
  }

  const openCreateForm = () => {
    setSelectedVendor(undefined)
    setFormMode("create")
  }

  const openEditForm = (vendor: Vendor) => {
    setSelectedVendor(vendor)
    setFormMode("edit")
  }

  const handleFormSuccess = async () => {
    closeForm()
    setTableData(await getVendors())
    router.refresh()
  }

  const deleteHandler = async (id: string) => {
    const res = await deleteVendor(id)

    if (!res?.success) {
      toast.error("Error", { description: res?.message })
      return
    }

    toast.success("Success", { description: res?.message })

    setTableData((prev) =>
      prev.filter((row) => row.id !== id)
    )
  }

  const columns = getVendorsColumns({
    canEdit,
    canDelete,
    onEdit: openEditForm,
    onDelete: deleteHandler,
  })

  return (
    <>
      <DataTable
        data={tableData}
        columns={columns}
        title={title}
        actions={canCreate ? <Button onClick={openCreateForm}>Add Vendor</Button> : actions}
      />
      <Dialog open={formMode !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent scrollBody className="max-h-[90vh] sm:max-w-4xl" onInteractOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit" ? "Update the vendor details below." : "Enter the details to add a vendor."}
            </DialogDescription>
          </DialogHeader>
          {formMode && (
            <VendorForm
              key={`${formMode}-${selectedVendor?.id ?? "new"}`}
              data={selectedVendor}
              update={formMode === "edit"}
              onSuccess={handleFormSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
