import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount, formatInr, type TrendTone } from "@/lib/revenue-metrics";
import { cn } from "@/lib/utils";

import { FyBadge } from "./fy-badge";

const toneClass: Record<TrendTone, string> = {
  good: "text-[#0E8A6A]",
  bad: "text-[#C5363C]",
  neutral: "text-[#667085]",
};

export function KpiCard({
  label,
  value,
  support,
  hint,
  mode = "currency",
  accent,
  deltaText,
  deltaTone = "neutral",
  unavailable = false,
}: {
  label: string;
  value: number;
  support: string;
  hint: string;
  mode?: "currency" | "number" | "percent";
  accent: string;
  deltaText: string;
  deltaTone?: TrendTone;
  unavailable?: boolean;
}) {
  const exact =
    mode === "percent" ? `${value.toFixed(2)}%` : mode === "number" ? formatCount(value) : formatInr(value);
  const display =
    mode === "percent" ? `${value.toFixed(2)}%` : mode === "number" ? formatCount(value) : formatInr(value, true);

  return (
    <article
      className="min-w-0 rounded-md border px-3 py-2.5"
      style={{
        backgroundColor: `color-mix(in srgb, ${accent} 12%, white)`,
        borderColor: `color-mix(in srgb, ${accent} 38%, white)`,
        boxShadow: `inset 3px 0 0 ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <h2 className="text-[11px] font-medium leading-4 text-[#667085]">{label}</h2>
          <FyBadge />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-sm text-[#98a2b3] hover:text-[#1F6FB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FB5]"
              aria-label={`About ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <p
        className="mt-1 truncate font-mono text-[22px] leading-7 font-semibold tracking-tight text-[#1c2430] tabular-nums"
        title={unavailable ? "Unavailable" : exact}
      >
        {unavailable ? "—" : display}
      </p>
      <p className={cn("mt-1 truncate text-[11px] font-medium tabular-nums", toneClass[deltaTone])}>{deltaText}</p>
      <p className="truncate text-[11px] leading-4 text-[#667085]">{support}</p>
    </article>
  );
}
