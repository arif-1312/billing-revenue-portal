import { efficiencyLabel, efficiencyTone, type StatusTone } from "@/lib/revenue-metrics";
import { cn } from "@/lib/utils";

const toneClass: Record<StatusTone, string> = {
  bad: "border-[var(--financial-overdue)]/30 bg-[var(--financial-overdue)]/10 text-[var(--financial-overdue)]",
  warn: "border-[var(--financial-pending)]/30 bg-[var(--financial-pending)]/10 text-[var(--financial-pending)]",
  good: "border-[var(--financial-collected)]/30 bg-[var(--financial-collected)]/10 text-[var(--financial-collected)]",
};

export function StatusBadge({
  value,
  label,
}: {
  value?: number;
  label?: string;
}) {
  const tone = typeof value === "number" ? efficiencyTone(value) : "warn";
  const text = label ?? (typeof value === "number" ? efficiencyLabel(value) : "Unknown");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneClass[tone],
      )}
    >
      <span className="sr-only">Status: </span>
      {text}
    </span>
  );
}
