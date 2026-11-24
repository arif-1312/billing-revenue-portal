"use client";

import React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BillingSummary = {
  id: number;
  billtilldate: number;
  billthismonth: number;
  billdonecount: number;
  billingAmount: number;
};

const columns: ColumnDef<BillingSummary>[] = [
  {
    accessorKey: "billtilldate",
    header: "Bill Till Date",
  },
  {
    accessorKey: "billthismonth",
    header: "Bill This Month",
  },
  {
    accessorKey: "billdonecount",
    header: "Total Bill Count",
  },
  {
    accessorKey: "billingAmount",
    header: "Amount",
    cell: ({ row }) => <span>₹ {row.original.billingAmount.toLocaleString("en-IN")}</span>,
  },
];

export function BillTable({ data }: { data: BillingSummary[] }) {
  const [globalFilter, setGlobalFilter] = React.useState("");

  // TanStack's table instance exposes imperative functions the React compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <div className="px-4 lg:px-6 mt-6">
      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-sm border rounded px-2 py-1"
        />
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-4">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
