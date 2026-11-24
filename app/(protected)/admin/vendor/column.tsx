"use client"

import { ColumnDef } from "@tanstack/react-table"
import { EditIcon, Trash } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteDialog } from "@/components/ui/delete-dailog"
import { Vendor } from "@/types"

type VendorColumnOptions = {
  canEdit: boolean
  canDelete: boolean
  onEdit: (vendor: Vendor) => void
  onDelete: (id: string) => void
}

export const getVendorsColumns = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: VendorColumnOptions): ColumnDef<Vendor>[] => {
  const columns: ColumnDef<Vendor>[] = [
    {
      accessorKey: "vendorCode",
      header: "Vendor Code",
    },
    {
      accessorKey: "companyName",
      header: "Vendor",
      cell: ({ row }) => {
        const vendor = row.original
        const fullName = [vendor.firstName, vendor.lastName].filter(Boolean).join(" ")

        return (
          <div>
            <div>{vendor.companyName || fullName || "-"}</div>
            <div className="text-xs text-muted-foreground">{fullName || vendor.email || "-"}</div>
          </div>
        )
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "city",
      header: "City",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status

        return status === "ACTIVE" ? (
          <Badge className="bg-green-500">ACTIVE</Badge>
        ) : (
          <Badge variant="destructive">INACTIVE</Badge>
        )
      },
    },
  ]

  if (canEdit || canDelete) {
    columns.push({
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const id = row.original.id as string

        return (
          <div className="flex gap-2">
            {canEdit && (
              <Button
                size="icon"
                className="bg-orange-500 hover:bg-orange-600"
                aria-label={`Edit ${row.original.companyName || row.original.vendorCode}`}
                onClick={() => onEdit(row.original)}
              >
                <EditIcon size={16} />
              </Button>
            )}

            {canDelete && (
              <DeleteDialog
                onConfirm={() => onDelete(id)}
                title="Delete Vendor?"
                description="Are you sure you want to delete this vendor? This action cannot be undone."
                preventOutsideDismiss
              >
                <Button
                  size="icon"
                  variant="destructive"
                >
                  <Trash size={16} />
                </Button>
              </DeleteDialog>
            )}
          </div>
        )
      },
    })
  }

  return columns
}
