"use client"

import { useActionState, useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { resetPasswordWithToken } from "@/lib/actions/password-reset"
import { PASSWORD_POLICY } from "@/lib/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initial = { success: false, message: "" }

export function ResetPasswordForm({
  token,
  username,
}: {
  token: string
  username: string
}) {
  const [state, action, pending] = useActionState(resetPasswordWithToken, initial)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const strength = useMemo(() => passwordStrength(password), [password])

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {state.message}
        </p>
        <Button asChild className="h-11 w-full rounded-xl bg-[#1d4ed8] text-white hover:bg-[#1e40af]">
          <a href="/login?reset=success">Continue to login</a>
        </Button>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" value={username} readOnly className="h-11 rounded-xl border-slate-200 bg-slate-50" />
      </div>
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New Password"
        value={password}
        shown={show}
        onToggle={() => setShow((current) => !current)}
        onChange={setPassword}
      />
      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${strength.bar}`} style={{ width: strength.width }} />
        </div>
        <p className="text-xs leading-5 text-slate-500">{PASSWORD_POLICY}</p>
      </div>
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm New Password"
        value={confirm}
        shown={show}
        onChange={setConfirm}
      />
      <Button
        type="submit"
        disabled={pending || password.length === 0 || confirm.length === 0}
        className="h-11 w-full rounded-xl bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
      >
        {pending ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  )
}

function PasswordField({
  id,
  name,
  label,
  value,
  shown,
  onChange,
  onToggle,
}: {
  id: string
  name: string
  label: string
  value: string
  shown: boolean
  onChange: (value: string) => void
  onToggle?: () => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          className="h-11 rounded-xl border-slate-200 pr-10"
          required
        />
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
          >
            {shown ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function passwordStrength(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length
  if (password.length >= 12 && classes >= 3) {
    return { width: "100%", bar: "bg-emerald-600" }
  }
  if (password.length >= 8 && classes >= 2) {
    return { width: "66%", bar: "bg-amber-500" }
  }
  if (password.length > 0) return { width: "33%", bar: "bg-rose-500" }
  return { width: "0%", bar: "bg-slate-200" }
}
