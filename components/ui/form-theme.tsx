import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const themedFieldClassName = "space-y-2.5";
export const themedLabelClassName =
  "text-sm font-medium text-foreground transition-colors duration-200";
export const themedInputClassName =
  "h-10 rounded-lg border-border bg-card text-foreground shadow-none transition-colors placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
export const themedSelectTriggerClassName =
  "h-10 w-full rounded-lg border-border bg-card text-foreground shadow-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20";
export const themedTextareaClassName =
  "min-h-[120px] rounded-lg border-border bg-card text-foreground shadow-none transition-colors placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";
export const themedSectionClassName =
  "overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6";
export const themedSectionHeaderClassName = "mb-6 space-y-2";
export const themedSectionTitleClassName =
  "text-base font-semibold tracking-tight text-foreground";
export const themedSectionDescriptionClassName =
  "text-sm leading-6 text-muted-foreground";
export const themedTabsListClassName =
  "grid h-auto w-full grid-cols-2 rounded-xl border border-border bg-secondary p-1 md:w-fit";
export const themedTabTriggerClassName =
  "rounded-lg px-5 py-2.5 font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm";
export const themedSubmitButtonClassName =
  "h-10 rounded-lg bg-primary px-5 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90";
export const themedCheckboxClassName =
  "size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30";

type ThemedFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function ThemedFormSection({
  title,
  description,
  children,
  className,
}: ThemedFormSectionProps) {
  return (
    <section className={cn(themedSectionClassName, className)}>
      <div className={themedSectionHeaderClassName}>
        <h2 className={themedSectionTitleClassName}>{title}</h2>
        {description ? (
          <p className={themedSectionDescriptionClassName}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
