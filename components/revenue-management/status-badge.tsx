import { efficiencyLabel, efficiencyTone, type StatusTone } from "@/lib/revenue-metrics";
import { cn } from "@/lib/utils";

const toneClass: Record<StatusTone, string> = {
  bad: "border-[#DC4545]/25 bg-[#DC4545]/10 text-[#B42323]",
  warn: "border-[#E69A23]/30 bg-[#E69A23]/10 text-[#9B620D]",
  good: "border-[#15966A]/25 bg-[#15966A]/10 text-[#117653]",
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
