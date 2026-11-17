"use client";

import { X } from "lucide-react";

import { formatCount } from "@/lib/revenue-metrics";

export function FilterChips({
  chips,
  count,
  onReset,
}: {
  chips: Array<{ id: string; label: string; onRemove: () => void }>;
  count: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-50"
        >
          {chip.label}
          <X className="size-3" aria-hidden="true" />
          <span className="sr-only">Remove {chip.label}</span>
        </button>
      ))}
      <span className="text-xs font-medium text-[#667085]" aria-live="polite">
        {formatCount(count)} records
      </span>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        Reset filters
      </button>
    </div>
  );
}
