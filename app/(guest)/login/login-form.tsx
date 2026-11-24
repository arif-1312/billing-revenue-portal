"use client";

import * as React from "react";
import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import { loginFormUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

type LoginActionState = {
  success: boolean;
  message: string;
} | null;

type LoginCompany = { id: string; name: string; logo: string | null };

export function LoginForm({
  companyName,
  companies,
  resetNotice = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { companyName?: string; resetNotice?: boolean; companies: LoginCompany[] }) {
  const [data, action, isPending] = useActionState<LoginActionState, FormData>(
    loginFormUser,
    null
  );

  const [validationError, setValidationError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const error = validationError || (!isPending && data?.success === false ? data.message : "");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {

    const user = identifier.trim();
    const pass = password.trim();

    if (!user || !pass || !companyId) {
      event.preventDefault();
      setValidationError(!companyId ? "Select your company to continue." : "Username/email and password are required.");
      return;
    }

    setValidationError("");
  };



  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden border-slate-200/80 bg-white/90 p-0 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <CardContent className="p-0 md:grid md:grid-cols-1">
          <form action={action} onSubmit={handleSubmit} className="p-6 md:p-8">
            <FieldGroup className="gap-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {companyName || "Billing Software"}
                </h1>
                <p className="text-sm leading-6 text-slate-500">
                  Login to continue securely into your finance workspace.
                </p>
              </div>

              {resetNotice ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-800">
                  Your password has been reset successfully. Please log in using your new password.
                </p>
              ) : null}

              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
                  {error}
                </p>
              )}

              <Field>
                <FieldLabel htmlFor="email">Username or Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  className="h-11 rounded-xl border-slate-200"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="companyId">Company</FieldLabel>
                <input type="hidden" name="companyId" value={companyId} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {companies.map((company) => {
                    const selected = companyId === company.id;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => { setCompanyId(company.id); setValidationError(""); }}
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                          selected ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {company.logo ? <Image src={company.logo} alt="" width={32} height={32} className="size-8 rounded-lg object-contain" /> : <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">{company.name.slice(0, 1).toUpperCase()}</span>}
                        <span className="truncate text-sm font-medium">{company.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative w-full">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-11 w-full rounded-xl border-slate-200 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    // aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center 
                     px-3 text-slate-500"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <Field>
                <div className="flex justify-end">
                  <a href="/forgot-password" className="text-sm font-medium text-[#1d4ed8] hover:text-[#1e40af]">
                    Forgot Password?
                  </a>
                </div>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-11 w-full rounded-xl bg-[#1d4ed8] text-white shadow-md transition-colors hover:bg-[#1e40af]"
                >
                  {isPending ? "Signing in…" : "Sign In"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
