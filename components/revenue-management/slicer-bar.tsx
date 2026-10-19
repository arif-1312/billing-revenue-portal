"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { matchingPreset, type PeriodMode } from "@/lib/dashboard-presets";
import { filterTokens, toggleFilterToken, type DashboardFilters } from "@/lib/revenue-metrics";
import { cn } from "@/lib/utils";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const quarters = [
  { value: "1", label: "Q1 · Apr–Jun" },
  { value: "2", label: "Q2 · Jul–Sep" },
  { value: "3", label: "Q3 · Oct–Dec" },
  { value: "4", label: "Q4 · Jan–Mar" },
];
const presets = [
  ["month", "This Month"],
  ["quarter", "This Quarter"],
  ["fy", "This FY"],
  ["last-fy", "Last FY"],
] as const;

export function SlicerFields({
  filters,
  companies,
  customers,
  years,
  statuses,
  status,
  onStatus,
  onChange,
  onPreset,
  periodMode,
  collapsed = false,
  onToggle,
}: {
  filters: DashboardFilters;
  companies: Array<{ id: string; name: string }>;
  customers: Array<{ id: string; name: string }>;
  years: number[];
  statuses: string[];
  status: string;
  onStatus: (value: string) => void;
  onChange: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  onPreset: (preset: "month" | "quarter" | "fy" | "last-fy") => void;
  periodMode: PeriodMode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const active = matchingPreset(filters, new Date());
  const periodLabel =
    periodMode === "dates"
      ? "Custom dates override month and quarter."
      : periodMode === "month"
        ? "Month is the active period."
        : periodMode === "quarter"
          ? "Quarter is the active period."
          : "Financial year is the active period.";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map(([preset, label]) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={active === preset}
            className={cn(
              "h-8",
              active === preset && "border-[#1F6FB5] bg-[#e8f3fb] text-[#1F6FB5] hover:bg-[#e8f3fb]",
            )}
            onClick={() => onPreset(preset)}
          >
            {label}
          </Button>
        ))}
        {onToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-[#667085]"
            aria-expanded={!collapsed}
            onClick={onToggle}
          >
            <ChevronDown className={cn("transition-transform", collapsed ? "" : "rotate-180")} />
            {collapsed ? "Show filters" : "Hide filters"}
          </Button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Field label="Financial Year">
            <MultiSelect
              allLabel="All years"
              value={filters.year}
              options={years.map((year) => ({
                value: String(year),
                label: `FY ${year}–${String(year + 1).slice(-2)}`,
              }))}
              onChange={(value) => onChange("year", value)}
            />
          </Field>
          <Field label="Quarter">
            <MultiSelect
              allLabel="All quarters"
              value={filters.quarter}
              options={quarters}
              onChange={(value) => onChange("quarter", value)}
            />
          </Field>
          <Field label="Month">
            <MultiSelect
              allLabel="All months"
              value={filters.month}
              options={months.map((month, index) => ({ value: String(index), label: month }))}
              onChange={(value) => onChange("month", value)}
            />
          </Field>
          <Field label="Company">
            <MultiSelect
              allLabel="All companies"
              value={filters.company}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              onChange={(value) => onChange("company", value)}
            />
          </Field>
          <Field label="Customer">
            <MultiSelect
              allLabel="All customers"
              value={filters.customer}
              options={customers.map((customer) => ({ value: customer.id, label: customer.name }))}
              onChange={(value) => onChange("customer", value)}
            />
          </Field>
          <Field label="Billing Status">
            <MultiSelect
              allLabel="All statuses"
              value={status}
              options={statuses.map((item) => ({ value: item, label: item }))}
              onChange={onStatus}
            />
          </Field>
          <DateField label="From Date" value={filters.startDate} onChange={(date) => onChange("startDate", date)} />
          <DateField label="To Date" value={filters.endDate} onChange={(date) => onChange("endDate", date)} />
        </div>
      )}
      <p className="text-[11px] text-[#667085]">{periodLabel} Select more than one value in a filter to include all of them. Billing status applies to totals, rankings, and tables.</p>
    </div>
  );
}

export function SlicerBar(props: React.ComponentProps<typeof SlicerFields>) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="hidden md:block">
        <SlicerFields
          {...props}
          collapsed={!open}
          onToggle={() => setOpen((value) => !value)}
        />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <SlidersHorizontal />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <SlicerFields {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function MultiSelect({
  allLabel,
  value,
  options,
  onChange,
}: {
  allLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const selected = filterTokens(value);
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-between px-2 font-normal">
          <span className="truncate">{summary}</span>
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div
          role="button"
          tabIndex={0}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#f3f5f8]"
          onClick={() => onChange("all")}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onChange("all");
          }}
        >
          <Checkbox checked={selected.length === 0} className="pointer-events-none" tabIndex={-1} />
          <span className="truncate">{allLabel}</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              role="button"
              tabIndex={0}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[#f3f5f8]"
              onClick={() => onChange(toggleFilterToken(value, option.value))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onChange(toggleFilterToken(value, option.value));
              }}
            >
              <Checkbox checked={selected.includes(option.value)} className="pointer-events-none" tabIndex={-1} />
              <span className="truncate">{option.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-[11px] text-[#667085]">{label}</Label>
      {children}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Date;
  onChange: (value?: Date) => void;
}) {
  return (
    <Field label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start px-2 font-normal">
            <CalendarIcon />
            <span className="truncate">{value ? format(value, "dd MMM yyyy") : "Any date"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
