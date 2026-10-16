"use client";

import { cn } from "@/lib/utils";

export const DASHBOARD_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "forecast", label: "Forecast" },
  { id: "customers", label: "Customer Analysis" },
  { id: "companies", label: "Company-wise Billing" },
  { id: "aging", label: "Aging & Collections" },
] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number]["id"];

export function isDashboardView(value: string | null): value is DashboardView {
  return DASHBOARD_VIEWS.some((view) => view.id === value);
}

export function DashboardTabs({
  value,
  onChange,
}: {
  value: DashboardView;
  onChange: (value: DashboardView) => void;
}) {
  return (
    <div role="tablist" aria-label="Management review sections" className="flex w-full min-w-0 gap-1 overflow-x-auto border-b border-[#e4e8ee]">
      {DASHBOARD_VIEWS.map((view) => {
        const selected = view.id === value;
        return (
          <button
            key={view.id}
            type="button"
            role="tab"
            id={`tab-${view.id}`}
            aria-selected={selected}
            aria-controls={`panel-${view.id}`}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F6FB5]",
              selected
                ? "border-[#1F6FB5] font-semibold text-[#1F6FB5]"
                : "border-transparent font-medium text-[#667085] hover:text-[#1c2430]",
            )}
            onClick={() => onChange(view.id)}
            onKeyDown={(event) => {
              const index = DASHBOARD_VIEWS.findIndex((item) => item.id === view.id);
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const next =
                event.key === "ArrowRight"
                  ? DASHBOARD_VIEWS[(index + 1) % DASHBOARD_VIEWS.length]
                  : DASHBOARD_VIEWS[(index - 1 + DASHBOARD_VIEWS.length) % DASHBOARD_VIEWS.length];
              onChange(next.id);
              document.getElementById(`tab-${next.id}`)?.focus();
            }}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
