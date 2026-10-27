"use client"

import { useActionState, useState } from "react"

import { sendPasswordResetLink } from "@/lib/actions/password-reset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial = { success: false, message: "" }

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(sendPasswordResetLink, initial)
  const [identifier, setIdentifier] = useState("")

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <p
          className={
            state.success
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {state.message}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="identifier">Username or email</Label>
        <Input
          id="identifier"
          name="identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          className="h-11 rounded-xl border-slate-200"
          required
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
      >
        {pending ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  )
}
