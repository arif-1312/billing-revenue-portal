import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { resetAccountForToken } from "@/lib/password-reset-service"

export const metadata: Metadata = {
  title: "Reset Password",
  referrer: "no-referrer",
}

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = first(params.token)
  const account = token ? await resetAccountForToken(token) : null

  return (
    <AuthCard
      title="Reset Your Password"
      description="Choose a new password for the account linked to this reset link."
    >
      {account && token ? (
        <ResetPasswordForm token={token} username={account.username} />
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This reset link is invalid or has expired.
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-[#1d4ed8]">
            Request a new link
          </Link>
        </div>
      )}
    </AuthCard>
  )
}

function first(value: string | string[] | undefined) {
  const token = Array.isArray(value) ? value[0] : value
  return token?.trim() || ""
}
