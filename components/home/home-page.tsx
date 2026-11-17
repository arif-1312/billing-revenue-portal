import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  DollarSign,
  FileText,
  IndianRupee,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HomePageProps = {
  configuration?: {
    name?: string | null;
    logo?: string | null;
  };
};

export default function HomePage({ configuration }: HomePageProps) {
  const companyName = configuration?.name || "";
  const logo = configuration?.logo || "";

  return (
    <div className="min-h-[calc(100svh-var(--header-height))] bg-[#F5F7FA] text-[#263445]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {logo || companyName ? (
          <header className="mb-7 flex min-h-14 items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:mb-8 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {logo ? (
                <Image
                  src={logo}
                  alt={companyName}
                  width={40}
                  height={40}
                  className="shrink-0 rounded-lg border border-slate-200"
                />
              ) : null}
              {companyName ? (
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {companyName}
                </h1>
              ) : null}
            </div>
          </header>
        ) : null}

        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div>
            <p className="mb-3 text-sm font-semibold text-[#1976D2]">
              Financial Operations Simplified
            </p>

            <h2 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl">
              One Portal for
              <span className="block text-[#1976D2]">Revenue & Billing</span>
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Manage revenue streams, billing workflows, and profit analysis in
              one clean and reliable workspace.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-10 rounded-lg bg-[#1976D2] px-5 text-white shadow-sm hover:bg-[#155EA8]"
              >
                <Link href="/admin/dashboard?tab=revenue">
                  Open Revenue Dashboard
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-10 rounded-lg border-slate-200 bg-white px-5"
              >
                <Link href="/admin/dashboard?tab=pl">Open P&amp;L</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,0.32)]">
              <CardContent className="p-4 sm:p-6">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <h4 className="font-semibold">Revenue Tracking</h4>
                      <p className="text-sm text-slate-500">
                        Monitor payments &amp; collections
                      </p>
                    </div>
                    <DollarSign className="text-[#1976D2]" />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <h4 className="font-semibold">Profit &amp; Loss</h4>
                      <p className="text-sm text-slate-500">
                        Analyze performance
                      </p>
                    </div>
                    <BarChart3 className="text-[#1976D2]" />
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <h4 className="font-semibold">Billing Management</h4>
                      <p className="text-sm text-slate-500">
                        Organize billing cycles
                      </p>
                    </div>
                    <FileText className="text-[#1976D2]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="absolute -top-5 -left-4 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-md sm:flex lg:-left-7">
              <TrendingUp className="text-[#1976D2]" />
              <div>
                <p className="text-sm font-semibold">Smarter Decisions</p>
                <p className="text-xs text-slate-500">Data-driven insights</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: IndianRupee,
              title: "Revenue Tracking",
              desc: "Track all financial activities in real time.",
            },
            {
              icon: BarChart3,
              title: "P&L Insights",
              desc: "Understand profitability clearly.",
            },
            {
              icon: FileText,
              title: "Billing Control",
              desc: "Manage billing efficiently.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="rounded-xl border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="p-5">
                <item.icon className="mb-3 size-6 text-[#1976D2]" />
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-5 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Ready to manage finances?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Access your dashboards and insights instantly.
            </p>
          </div>

          <Button
            asChild
            size="lg"
            className="h-10 rounded-lg bg-[#1976D2] px-4 text-white hover:bg-[#155EA8] md:mt-0"
          >
            <Link href="/admin/dashboard?tab=pl">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </section>

        <footer className="mt-8 text-center text-sm text-slate-500">
          Copyright {new Date().getFullYear()} {companyName}. All rights
          reserved.
        </footer>
      </div>
    </div>
  );
}
