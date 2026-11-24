"use client";

import * as React from "react";
import { toast } from "sonner";

import { getUsersColumns } from "./column";
import { DataTable } from "@/components/datatable/DataTable";
import { deleteProject } from "@/lib/actions/project";
import type { ProjectRow } from "./column";

export default function PLDataTable({
  data,
  canEdit,
  canDelete,
  canView,
  title,
  actions,
}: { data: ProjectRow[]; canEdit: boolean; canDelete: boolean; canView?: boolean; title: string; actions?: React.ReactNode }) {
  const [tableData, setTableData] = React.useState(data);

  const deleteHandler = async (id: string) => {
    const res = await deleteProject(id);

    if (!res?.success) {
      toast.error("Error", { description: res?.message });
      return;
    }

    toast.success("Success", { description: res?.message });

    setTableData((prev: ProjectRow[]) => prev.filter((row) => row.id !== id));
  };

  const columns = getUsersColumns({
    canView,
    canEdit,
    canDelete,
    onDelete: deleteHandler,
  });

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
      {/* Top Gradient Strip */}
      {/* <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" /> */}

      <DataTable
        data={tableData}
        columns={columns}
        title={title}
        actions={actions}
        rowClassName={(row) => {
          const revenue = Number(row.totalRevenue) || 0;
          const cost = Number(row.totalCost) || 0;
          const projected = Number(row.projectedProfit) || 0;

          const gm =
            revenue === 0 ? 0 : ((revenue - cost) / revenue) * 100;

          return gm >= projected
            ? `
              bg-emerald-50/70
              dark:bg-emerald-950/20
              hover:bg-emerald-100/80
              dark:hover:bg-emerald-900/30
              hover:scale-[1.01]
              hover:shadow-md
              transition-all duration-300
              border-l-4 border-emerald-500
            `
            : `
              bg-rose-50/70
              dark:bg-rose-950/20
              hover:bg-rose-100/80
              dark:hover:bg-rose-900/30
              hover:scale-[1.01]
              hover:shadow-md
              transition-all duration-300
              border-l-4 border-rose-500
            `;
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

          [&_tbody_td]:py-3
          [&_tbody_td]:px-4
          [&_tbody_td]:text-sm
        "
      />
    </div>
  );
}
