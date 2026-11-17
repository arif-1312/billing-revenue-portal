"use client";

import * as React from "react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";

/* ✅ NEW IMPORTS (shadcn dropdown) */
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  tableWidth?: "full" | "content";
  rowClassName?: (row: TData, index: number) => string;
  toolbar?: (filteredRows: TData[]) => React.ReactNode;
}

function getRowEdgeClass(className: string) {
  const tokens = className.split(/\s+/).filter(Boolean);

  return tokens
    .filter(
      (token) =>
        token.startsWith("border-l-") ||
        token.startsWith("border-emerald-") ||
        token.startsWith("border-rose-"),
    )
    .join(" ");
}

function getDefaultAlternateRowClass(index: number) {
  return index % 2 === 0
    ? `
      bg-white
      hover:bg-[#EAF3FC]
      transition-colors duration-150
    `
    : `
      bg-slate-50/70
      hover:bg-[#EAF3FC]
      transition-colors duration-150
    `;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  title = "",
  actions,
  className,
  tableWidth = "full",
  rowClassName,
  toolbar,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [currentData, setCurrentData] = React.useState<TData[]>(data);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  /* ✅ NEW STATE */
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  React.useEffect(() => {
    setCurrentData(data);
  }, [data]);

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter, data]);

  const globalFilterFn = (row: any, columnId: string, filterValue: string) => {
    return String(row.getValue(columnId) ?? "")
      .toLowerCase()
      .includes(filterValue.toLowerCase());
  };

  const table = useReactTable({
    data: currentData,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
      columnVisibility, 
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility, 
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
      <Card className="w-full min-w-0 rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>

          <div className="flex flex-wrap gap-2 items-center">
            {actions}

            {/* ✅ COLUMN TOGGLE BUTTON */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* <Button variant="outline" size="sm">
                  Columns
                </Button> */}
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Search..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />

            {toolbar?.(
              table.getFilteredRowModel().rows.map((row) => row.original),
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Columns
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className={cn("w-full min-w-0 overflow-hidden rounded-xl border border-[#E2E8F0]", className)}>
            <Table
              className={tableWidth === "content" ? "w-max min-w-full table-fixed" : "w-full"}
              style={tableWidth === "content" ? { width: `${table.getTotalSize()}px` } : undefined}
            >
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="h-11 border-b border-[#E2E8F0] bg-[#EAF3FC] hover:bg-[#EAF3FC]"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{ width: `${header.getSize()}px` }}
                        className="cursor-pointer select-none whitespace-nowrap px-3 py-3 text-xs font-semibold text-[#17365D]"
                      >
                        <div className="flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}

                          {{
                            asc: "🔼",
                            desc: "🔽",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row, index) => {
                    const rowClasses = rowClassName
                      ? rowClassName(row.original, index)
                      : getDefaultAlternateRowClass(index);
                    const rowEdgeClasses = getRowEdgeClass(rowClasses);

                    return (
                      <TableRow key={row.id} className={rowClasses}>
                        {row.getVisibleCells().map((cell, index) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: `${cell.column.getSize()}px` }}
                            className={cn(
                              "whitespace-normal break-words align-top px-3 py-3 text-sm text-[#263445]",
                              index === 0 && rowEdgeClasses,
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {table.getRowModel().rows.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {table.getFilteredRowModel().rows.length}
              </span>{" "}
              entries
            </p>

            <div className="flex items-center gap-2">
              <p className="mr-2 text-sm text-slate-500">
                Page{" "}
                <span className="font-semibold text-slate-700">
                  {table.getState().pagination.pageIndex + 1}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {table.getPageCount() || 1}
                </span>
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
