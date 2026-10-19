"use client";

import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";

const FyLabelContext = createContext("");

export function FyLabelProvider({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return <FyLabelContext.Provider value={label}>{children}</FyLabelContext.Provider>;
}

export function FyBadge({ className }: { className?: string }) {
  const label = useContext(FyLabelContext);
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border border-[#e4e8ee] bg-[#f8f9fb] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#667085]",
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
