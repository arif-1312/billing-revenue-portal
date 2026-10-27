"use server"

import { auth } from "@/auth"
import {
  completePasswordReset,
  requestPasswordReset,
  requestPasswordResetForUser,
} from "@/lib/password-reset-service"
import { RESET_REQUEST_MESSAGE } from "@/lib/password-reset"

export async function sendPasswordResetLink(
  _previous: { success: boolean; message: string } | null,
  formData: FormData,
) {
  const identifier = String(formData.get("identifier") || "")
  if (!identifier.trim()) {
    return { success: false, message: "Enter your username or registered email address." }
  }

  try {
    const result = await requestPasswordReset(identifier)
    return { success: true, message: result.message }
  } catch {
    return { success: true, message: RESET_REQUEST_MESSAGE }
  }
}

export async function resetPasswordWithToken(
  _previous: { success: boolean; message: string } | null,
  formData: FormData,
) {
  const result = await completePasswordReset({
    token: String(formData.get("token") || ""),
    newPassword: String(formData.get("newPassword") || ""),
    confirmPassword: String(formData.get("confirmPassword") || ""),
  })
  return result
}

export async function sendMyPasswordResetLink() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { success: false, message: "Sign in again to request a password reset." }
  }
  return requestPasswordResetForUser(userId)
}
