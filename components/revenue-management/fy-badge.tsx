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
        "inline-flex shrink-0 items-center rounded-md border border-[#DCE7F3] bg-[var(--fy-badge-background)] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[var(--fy-badge-foreground)]",
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
