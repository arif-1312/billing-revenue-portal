import type { Metadata } from "next"

import { AuthCard } from "@/components/auth/auth-card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Forgot Password",
  referrer: "no-referrer",
}

export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot Password"
      description="Enter your username or the email address registered on your account. We will send a reset link if the account exists."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
