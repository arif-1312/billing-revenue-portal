import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCount, formatInr, type TrendTone } from "@/lib/revenue-metrics";
import { cn } from "@/lib/utils";

import { FyBadge } from "./fy-badge";

const toneClass: Record<TrendTone, string> = {
  good: "text-[var(--financial-collected)]",
  bad: "text-[var(--financial-overdue)]",
  neutral: "text-[var(--kpi-label)]",
};

type KpiAccent = "billing" | "collected" | "receivables" | "notDue" | "overdue";

const cardTone: Record<KpiAccent, { accent: string; background: string; border: string }> = {
  billing: {
    accent: "var(--kpi-billing-accent)",
    background: "var(--kpi-billing-background)",
    border: "var(--kpi-billing-border)",
  },
  collected: {
    accent: "var(--kpi-collected-accent)",
    background: "var(--kpi-collected-background)",
    border: "var(--border)",
  },
  receivables: {
    accent: "var(--kpi-receivables-accent)",
    background: "var(--kpi-receivables-background)",
    border: "var(--border)",
  },
  notDue: {
    accent: "var(--kpi-not-due-accent)",
    background: "var(--kpi-not-due-background)",
    border: "var(--border)",
  },
  overdue: {
    accent: "var(--kpi-overdue-accent)",
    background: "var(--kpi-overdue-background)",
    border: "var(--border)",
  },
};

export type KpiDetailKey =
  | "plannedBilling"
  | "billedAmount"
  | "netBilledAmount"
  | "creditNoteAmount"
  | "billingDone"
  | "billingAchievement"
  | "totalCollected"
  | "totalReceivables"
  | "notYetDue"
  | "overdueAmount"
  | "collectionEfficiency"
  | "overdueInvoiceCount"
  | "pendingCollection";

export function HoverAmount({
  value,
  className,
  onClick,
}: {
  value: number;
  className?: string;
  onClick?: () => void;
}) {
  const exact = formatInr(value);
  const display = formatInr(value, true);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className={cn(
          "pointer-events-auto cursor-pointer border-0 bg-transparent p-0 text-inherit",
          className,
        )}
        onClick={onClick}
        aria-label={exact}
      >
        {display}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="font-mono text-sm font-semibold tabular-nums"
      >
        {exact}
      </TooltipContent>
    </Tooltip>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  mode = "currency",
  accent = "billing",
  deltaText,
  deltaTone = "neutral",
  unavailable = false,
  detailKey,
  onOpenDetails,
}: {
  label: string;
  value: number;
  hint: string;
  mode?: "currency" | "number" | "percent";
  accent?: KpiAccent;
  deltaText: string;
  deltaTone?: TrendTone;
  unavailable?: boolean;
  detailKey: KpiDetailKey;
  onOpenDetails: (key: KpiDetailKey) => void;
}) {
  const exact =
    mode === "percent"
      ? `${value.toFixed(2)}%`
      : mode === "number"
        ? formatCount(value)
        : formatInr(value);
  const display =
    mode === "percent"
      ? `${value.toFixed(2)}%`
      : mode === "number"
        ? formatCount(value)
        : formatInr(value, true);
  const amountLabel = unavailable ? "Unavailable" : exact;
  const colors = cardTone[accent];
  const openDetails = () => onOpenDetails(detailKey);

  return (
    <article
      className="group relative flex min-h-[8.75rem] min-w-0 flex-col rounded-xl border px-3.5 py-3 transition-[border-color,box-shadow] duration-150 hover:shadow-sm"
      style={{
        backgroundColor: colors.background,
        borderColor: colors.border,
        boxShadow: `inset 3px 0 0 ${colors.accent}, 0 1px 2px rgb(15 23 42 / 0.035)`,
      }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--financial-billing)]"
        aria-label={`View ${label} details`}
        onClick={openDetails}
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="min-h-4 text-[11px] font-medium leading-4 text-[var(--kpi-label)]">
            {label}
          </h2>

          <div className="mt-1 flex h-6 items-center">
            <FyBadge />
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto rounded-md p-0.5 text-[var(--kpi-label)] hover:bg-slate-50 hover:text-[var(--financial-billing)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--financial-billing)]"
              aria-label={`About ${label}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="max-w-72">
            <span className="block font-mono text-sm font-semibold tabular-nums">
              {amountLabel}
            </span>
            <span className="mt-1 block opacity-80">{hint}</span>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="pointer-events-none relative z-10">
      {unavailable || mode !== "currency" ? (
        <p className="mt-1 truncate font-mono text-[23px] leading-7 font-semibold tracking-tight text-[var(--kpi-value)] tabular-nums">
          {unavailable ? "—" : display}
        </p>
      ) : (
        <HoverAmount
          value={value}
          onClick={openDetails}
          className="mt-1 block w-full truncate text-left font-mono text-[23px] leading-7 font-semibold tracking-tight text-[var(--kpi-value)] tabular-nums"
        />
      )}
      <p
        className={cn(
          "mt-1 truncate text-[11px] font-medium tabular-nums",
          toneClass[deltaTone],
        )}
      >
        {deltaText}
      </p>
      </div>
    </article>
  );
}
