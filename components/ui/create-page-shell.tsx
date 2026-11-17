import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CreatePageShellProps = {
  title: string;
  backHref: string;
  backLabel?: string;
  children: ReactNode;
};

export function CreatePageShell({
  title,
  backHref,
  backLabel = "Back",
  children,
}: CreatePageShellProps) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              {title}
            </CardTitle>

            <Button
              asChild
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Link href={backHref}>
                <ArrowLeft className="size-4" />
                {backLabel}
              </Link>
            </Button>

          </div>
        </CardHeader>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-6">{children}</CardContent>
      </Card>
    </div>
  );
}
