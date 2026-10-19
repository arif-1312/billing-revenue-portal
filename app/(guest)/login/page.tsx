import React from "react";
import { LoginForm } from "./login-form";
import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getConfiguration } from "@/lib/actions/configuration";
import { isSignedInSession } from "@/lib/session-decision";

export const metadata: Metadata = {
  title: "Sign In",
};

async function SignInPage() {
  const session = await auth();
  const configuration = await getConfiguration();
  const companyName = configuration?.name || "SY ASSOCIATES";
  const logo = configuration?.logo || "/sy.png";

  if (isSignedInSession(session)) {
    return redirect("/admin/home");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,#eff6ff_0%,#f8fafc_45%,#dbeafe_100%)]">
      <div className="mx-auto flex min-h-screen items-stretch">
        <div className="grid w-full overflow-hidden  shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur md:grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative hidden overflow-hidden bg-[linear-gradient(155deg,#0f172a_0%,#1d4ed8_48%,#60a5fa_100%)] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_25%)]" />

            <div className="relative  flex align-items gap-4">
              <div className="rounded-2xl h-[100px] w-[100px] flex align-items justify-content backdrop-blur">
                <Image
                  src={logo}
                  alt="Logo"
                  fill
                  className="rounded-xl object-cover w-full h-full"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-blue-100/80">
                  Billing Platform
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-wide">
                  {companyName}
                </h1>
              </div>
            </div>

            <div className="relative z-10 max-w-xl space-y-8">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.35em] text-blue-100/75">
                  Welcome Back
                </p>
                <h2 className="text-5xl font-semibold leading-tight">
                  Track revenue, billing, and profitability from one place.
                </h2>
                <p className="max-w-lg text-base leading-7 text-blue-50/85">
                  Sign in to access a cleaner view of collections, project
                  margins, and financial performance across your organization.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-semibold">Revenue</p>
                  <p className="mt-1 text-sm text-blue-100/80">
                    Review billing and collections with clarity.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-semibold">P&amp;L</p>
                  <p className="mt-1 text-sm text-blue-100/80">
                    Monitor cost, profit, and overdue movement.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-2xl font-semibold">Control</p>
                  <p className="mt-1 text-sm text-blue-100/80">
                    Keep your financial operations organized.
                  </p>
                </div>
              </div>
            </div>

            <p className="relative z-10 text-sm text-blue-100/70">
              &copy; {new Date().getFullYear()} {companyName}
            </p>
          </div>

          <div className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
            <div className="w-full max-w-md space-y-8">
              <div className="flex items-center justify-center gap-3 lg:hidden">
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <Image
                    src={logo}
                    alt="Logo"
                    width={42}
                    height={42}
                    className="rounded-lg"
                  />
                </div>
                <div className="text-left">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Billing Platform
                  </p>
                  <h1 className="text-lg font-semibold text-slate-900">
                    {companyName}
                  </h1>
                </div>
              </div>

              <div className="space-y-3 text-center lg:text-left">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-blue-600">
                  Sign In
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Continue to your dashboard
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  Use your account credentials to access revenue reporting,
                  billing workflows, and P&amp;L insights.
                </p>
              </div>

              <LoginForm companyName={companyName} />

              <p className="text-center text-xs text-slate-400 lg:text-left">
                Protected access for authorized users only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
