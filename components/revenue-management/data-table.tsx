import { cn } from "@/lib/utils";

export function DataTable({
  columns,
  rows,
  sort,
  onSort,
  className,
}: {
  columns: Array<{ id: string; label: string; align?: "left" | "right" }>;
  rows: Array<Array<React.ReactNode>>;
  sort?: { id: string; dir: "asc" | "desc" };
  onSort?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("max-h-[28rem] max-w-full min-w-0 overflow-auto", className)}>
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#f7f8fa]">
          <tr>
            {columns.map((column) => {
              const active = sort?.id === column.id;
              const label = active ? `${column.label}, sorted ${sort.dir === "asc" ? "ascending" : "descending"}` : column.label;
              return (
                <th
                  key={column.id}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "border-b border-[#e4e8ee] px-3 py-2 text-xs font-semibold text-[#667085]",
                    column.align === "right" && "text-right",
                  )}
                >
                  {onSort ? (
                    <button
                      type="button"
                      className={cn("hover:text-[#1c2430]", column.align === "right" && "ml-auto block")}
                      aria-label={label}
                      onClick={() => onSort(column.id)}
                    >
                      {column.label}
                      {active ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-[#667085]">
                No rows for this selection.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="hover:bg-[#f8fafc]">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={cn(
                      "border-b border-[#f0f2f5] px-3 py-2 text-[#1c2430]",
                      columns[cellIndex]?.align === "right" && "text-right",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
