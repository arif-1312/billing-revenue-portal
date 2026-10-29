"use client";

import * as React from "react";
import { toast } from "sonner";

import { DataTable } from "@/components/datatable/DataTable";
import { deleteCreditNote, type CreditNoteRecord } from "@/lib/actions/credit-note";

import { getCreditNoteColumns } from "./column";

export default function CreditNoteDataTable({
  data,
  canEdit,
  canDelete,
  title,
  actions,
}: {
  data: CreditNoteRecord[];
  canEdit: boolean;
  canDelete: boolean;
  title: string;
  actions?: React.ReactNode;
}) {
  const [tableData, setTableData] = React.useState(data);

  React.useEffect(() => {
    setTableData(data);
  }, [data]);

  const deleteHandler = async (id: string) => {
    const res = await deleteCreditNote(id);

    if (!res?.success) {
      toast.error("Error", { description: res?.message });
      return;
    }

    toast.success("Success", { description: res?.message });
    setTableData((prev) => prev.filter((row) => row.id !== id));
  };

  const columns = getCreditNoteColumns({
    canEdit,
    canDelete,
    onDelete: deleteHandler,
  });

  return (
    <DataTable
      data={tableData}
      columns={columns}
      title={title}
      actions={actions}
    />
  );
}
