"use client";

import * as React from "react";
import { useActionState, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { loginFormUser } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Eye, EyeOff } from "lucide-react";

type LoginActionState = {
  success: boolean;
  message: string;
} | null;

export function LoginForm({
  companyName,
  resetNotice = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { companyName?: string; resetNotice?: boolean }) {
  const [data, action] = useActionState<LoginActionState, FormData>(
    loginFormUser,
    null
  );

  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (data?.success === false && data.message) {
      setError(data.message);
    }
  }, [data]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {

    const user = username.trim();
    const pass = password.trim();

    if (!user || !pass) {
      event.preventDefault();
      setError("Username and password are required.");
      return;
    }

    setError("");
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
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
                  {error}
                </p>
              )}

              <Field>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="h-11 rounded-xl border-slate-200"
                />
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
                  className="h-11 w-full rounded-xl bg-[#1d4ed8] text-white shadow-md transition-colors hover:bg-[#1e40af]"
                >
                  Sign In
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}