"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FyBadge } from "./fy-badge";

export function ChartCard({
  title,
  description,
  rows,
  children,
  loading,
  error,
  empty,
  className,
  extra,
}: {
  title: string;
  description?: string;
  filename?: string;
  rows: Array<Record<string, string | number>>;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
  extra?: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);

  return (
    <article className={`flex min-w-0 flex-col rounded-md border border-[#e4e8ee] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className ?? ""}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[#1c2430]">{title}</h3>
            <FyBadge />
          </div>
          {description ? <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {extra}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Show ${title} as a table`}
            aria-pressed={asTable}
            onClick={() => setAsTable((value) => !value)}
          >
            <Table2 />
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="h-56 animate-pulse rounded-md bg-[#f3f5f8] motion-reduce:animate-none" />
      ) : error ? (
        <p className="py-10 text-center text-sm text-[#C5363C]">{error}</p>
      ) : empty ? (
        <p className="py-10 text-center text-sm text-[#667085]">No data for this selection.</p>
      ) : asTable ? (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f8fa]">
              <tr>
                {Object.keys(rows[0] ?? {}).map((header) => (
                  <th key={header} className="border-b border-[#e4e8ee] px-2 py-2 text-xs font-semibold text-[#667085]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-[#f0f2f5]">
                  {Object.values(row).map((value, cell) => (
                    <td
                      key={cell}
                      className={`px-2 py-2 text-[#1c2430] ${typeof value === "number" ? "text-right font-mono tabular-nums" : ""}`}
                    >
                      {typeof value === "number"
                        ? new Intl.NumberFormat("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(value)
                        : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </article>
  );
}
