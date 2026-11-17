import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EditPageShellProps = {
  title: string;
  backHref: string;
  backLabel?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  children: ReactNode;
};

export function EditPageShell({
  title,
  backHref,
  backLabel = "Back",
  eyebrow = "Record",
  icon: Icon = PencilLine,
  children,
}: EditPageShellProps) {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1 bg-blue-600" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {eyebrow}
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
                {title}
              </h1>
            </div>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-9 rounded-lg border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </section>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">{children}</CardContent>
      </Card>
    </div>
  );
}
