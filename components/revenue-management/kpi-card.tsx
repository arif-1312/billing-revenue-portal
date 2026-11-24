import {
  CircleAlert,
  CircleDollarSign,
  Clock3,
  FileText,
  Gauge,
  Info,
  Receipt,
  Timer,
  TrendingUp,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

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

const metricIcons: Record<KpiDetailKey, LucideIcon> = {
  plannedBilling: FileText,
  billedAmount: Receipt,
  netBilledAmount: Wallet,
  creditNoteAmount: FileText,
  billingDone: Receipt,
  billingAchievement: TrendingUp,
  totalCollected: CircleDollarSign,
  totalReceivables: Wallet,
  notYetDue: Clock3,
  overdueAmount: TriangleAlert,
  collectionEfficiency: Gauge,
  overdueInvoiceCount: CircleAlert,
  pendingCollection: Timer,
};

export function HoverAmount({
  value,
  className,
  onClick,
  displayInCrores = false,
}: {
  value: number;
  className?: string;
  onClick?: () => void;
  displayInCrores?: boolean;
}) {
  const exact = formatInr(value);
  const display = displayInCrores
    ? `${value < 0 ? "-" : ""}₹${(Math.abs(value) / 1_00_00_000).toFixed(2)} Cr`
    : formatInr(value, true);

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
  hero = false,
  sparkline = [],
  progressValue,
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
  hero?: boolean;
  sparkline?: number[];
  progressValue?: number;
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
  const MetricIcon = metricIcons[detailKey];
  const openDetails = () => onOpenDetails(detailKey);
  const sparklineValues = sparkline.filter(Number.isFinite);
  const sparklineMin = Math.min(...sparklineValues, 0);
  const sparklineMax = Math.max(...sparklineValues, 1);
  const sparklineRange = sparklineMax - sparklineMin || 1;
  const sparklinePoints = sparklineValues
    .map((point, index) => {
      const x = sparklineValues.length < 2 ? 50 : (index / (sparklineValues.length - 1)) * 100;
      const y = 27 - ((point - sparklineMin) / sparklineRange) * 22;
      return `${x},${y}`;
    })
    .join(" ");
  const progress = Math.max(0, Math.min(progressValue ?? value, 100));

  return (
    <article
      className={cn(
        "group relative flex min-h-[8.75rem] min-w-0 flex-col overflow-hidden rounded-2xl border px-4 py-3.5 transition-colors duration-200 hover:border-primary/40",
        hero
          ? "border-[var(--kpi-billing-border)] bg-[var(--kpi-billing-background)] text-white shadow-sm"
          : "border-slate-200 bg-white shadow-sm",
      )}
      style={hero ? undefined : {
        backgroundColor: colors.background,
        borderColor: colors.border,
        boxShadow: "0 1px 2px rgb(0 0 0 / 0.16)",
      }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
        aria-label={`View ${label} details`}
        onClick={openDetails}
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border"
            style={{
              color: colors.accent,
              borderColor: `color-mix(in srgb, ${colors.accent} 20%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${colors.accent} 12%, var(--card))`,
            }}
          >
            <MetricIcon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className={cn("truncate text-xs font-medium leading-4", hero ? "text-slate-300" : "text-[var(--kpi-label)]")}>
              {label}
            </h2>
            <div className="mt-1 flex h-5 items-center">
              <FyBadge className={hero ? "border-white/15 bg-white/10 text-slate-200" : undefined} />
            </div>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn("pointer-events-auto rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", hero ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-[var(--kpi-label)] hover:bg-secondary hover:text-[var(--financial-billing)]")}
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
        <p className={cn("mt-1 truncate font-mono text-[23px] leading-7 font-semibold tracking-tight tabular-nums", hero ? "text-white" : "text-[var(--kpi-value)]")}>
          {unavailable ? "—" : display}
        </p>
      ) : (
        <HoverAmount
          value={value}
          displayInCrores
          onClick={openDetails}
          className={cn("mt-1 block w-full truncate text-left font-mono text-[23px] leading-7 font-semibold tracking-tight tabular-nums", hero ? "text-white" : "text-[var(--kpi-value)]")}
        />
      )}
      <p
        className={cn(
          "mt-1 truncate text-[11px] font-medium tabular-nums",
          hero ? "text-slate-300" : "",
          toneClass[deltaTone],
        )}
      >
        {deltaText}
      </p>
      {hero ? (
        <div className="mt-auto flex items-end justify-between gap-4 pt-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between gap-2 text-[10px] text-slate-300">
              <span>Billing achievement</span>
              <span className="font-mono tabular-nums">{unavailable ? "—" : `${progress.toFixed(1)}%`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[var(--financial-billing)] transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {sparklinePoints ? (
            <svg aria-hidden="true" viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-20 shrink-0 overflow-visible text-cyan-300 sm:w-24">
            <polyline points={sparklinePoints} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </div>
      ) : null}
      </div>
    </article>
  );
}
