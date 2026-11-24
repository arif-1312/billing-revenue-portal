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
  const [removedRows, setRemovedRows] = React.useState<{
    source: CreditNoteRecord[];
    ids: Set<string>;
  }>(() => ({ source: data, ids: new Set() }));
  const removedIds = removedRows.source === data ? removedRows.ids : new Set<string>();
  const tableData = data.filter((row) => !removedIds.has(row.id));

  const deleteHandler = async (id: string) => {
    const res = await deleteCreditNote(id);

    if (!res?.success) {
      toast.error("Error", { description: res?.message });
      return;
    }

    toast.success("Success", { description: res?.message });
    setRemovedRows((current) => {
      const ids = new Set(current.source === data ? current.ids : []);
      ids.add(id);
      return { source: data, ids };
    });
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
