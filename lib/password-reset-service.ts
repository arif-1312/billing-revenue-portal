import { headers } from "next/headers"

import { consumeActionRateLimit } from "@/lib/action-rate-limit"
import { clientAddress } from "@/lib/client-address"
import { enqueueAuthEmail } from "@/lib/email/queue"
import { applicationBaseUrl } from "@/lib/email/links"
import { hashPassword } from "@/lib/password"
import {
  RESET_REQUEST_MESSAGE,
  createResetToken,
  hashResetToken,
  resetExpiry,
  resetPasswordUrl,
  tokenIsUsable,
} from "@/lib/password-reset"
import { prisma } from "@/lib/prisma"
import { encryptSecret } from "@/lib/secret-box"
import { passwordMeetsPolicy } from "@/lib/validators"
import bcrypt from "bcrypt"

const RESET_SUBJECT = "Password Reset Request | Billing & Revenue Portal"
const CHANGED_SUBJECT = "Password Updated Successfully | Billing & Revenue Portal"

export async function requestPasswordReset(identifier: string) {
  const key = identifier.trim().toLowerCase().slice(0, 200)
  const headerList = await headers()
  const source = clientAddress(headerList) || "local"
  const accountAllowed = await consumeActionRateLimit(
    `reset:account:${key || "blank"}`,
    5,
    15 * 60 * 1000,
  )
  const sourceAllowed = await consumeActionRateLimit(
    `reset:source:${source}`,
    20,
    15 * 60 * 1000,
  )

  if (!accountAllowed || !sourceAllowed) {
    return {
      success: true,
      limited: true,
      message: "Please wait a few minutes before requesting another reset link.",
    }
  }

  await issueResetLink(key)
  return { success: true, limited: false, message: RESET_REQUEST_MESSAGE }
}

export async function requestPasswordResetForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: accountSelect,
  })
  if (!user || user.status !== "ACTIVE" || !user.email) {
    return { success: false, message: "A reset link could not be sent for this account." }
  }

  const allowed = await consumeActionRateLimit(`reset:user:${user.id}`, 5, 15 * 60 * 1000)
  if (!allowed) {
    return { success: false, message: "Please wait a few minutes before requesting another reset link." }
  }

  const sent = await sendResetLink(user)
  if (!sent) {
    return { success: false, message: "A reset link could not be sent for this account." }
  }

  await ownerNotice({
    userId: user.id,
    title: "Password reset requested",
    body: "A password reset link was sent to your registered email address.",
    fingerprint: `requested:${user.id}:${Date.now()}`,
  })

  return {
    success: true,
    message: "A password reset link has been sent to your registered email address.",
  }
}

export async function resetAccountForToken(token: string) {
  const row = await findUsableToken(token)
  if (!row) return null
  return { username: row.user.username }
}

export async function completePasswordReset(input: {
  token: string
  newPassword: string
  confirmPassword: string
}) {
  if (input.newPassword !== input.confirmPassword) {
    return { success: false, message: "New password and confirm password must match." }
  }
  if (!passwordMeetsPolicy(input.newPassword)) {
    return {
      success: false,
      message: "Use at least 12 characters, three character types, and avoid common passwords.",
    }
  }

  const row = await findUsableToken(input.token)
  if (!row) {
    return { success: false, message: "This reset link is invalid or has expired." }
  }

  const same = await bcrypt.compare(input.newPassword, row.user.password)
  if (same) {
    return {
      success: false,
      message: "New password must be different from the current password.",
    }
  }

  const hashedPassword = await hashPassword(input.newPassword)
  const now = new Date()
  const tokenHash = hashResetToken(input.token.trim())

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) {
        throw new Error("RESET_TOKEN_USED")
      }

      await tx.user.update({
        where: { id: row.user.id },
        data: { password: hashedPassword },
      })

      await tx.passwordResetToken.updateMany({
        where: { userId: row.user.id, usedAt: null },
        data: { usedAt: now },
      })

      await tx.auditLog.create({
        data: {
          userId: row.user.id,
          userName: row.user.username,
          action: "UPDATE",
          model: "SecurityEvent",
          recordId: row.user.id,
          after: { event: "PASSWORD_CHANGED", result: "success" },
        },
      })
    })
  } catch {
    return { success: false, message: "This reset link is invalid or has expired." }
  }

  await notifyPasswordChanged(row.user.id)
  return { success: true, message: "Your password has been reset successfully. Please log in using your new password." }
}

export async function notifyPasswordChanged(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: accountSelect,
  })
  if (!user?.email) return

  const when = formatActivity(new Date())
  const name = displayName(user)

  try {
    await enqueueAuthEmail({
      idempotencyKey: `password-changed:${user.id}:${Date.now()}`,
      recipientUserId: user.id,
      recipientEmail: user.email,
      subject: CHANGED_SUBJECT,
      templateKey: "password_changed",
      payload: authPayload(user, when),
    })
  } catch {
    console.error("Password change email could not be queued")
  }

  await ownerNotice({
    userId: user.id,
    title: "Password changed successfully",
    body: `Your account password was changed successfully on ${when.label}.`,
    fingerprint: `changed:${user.id}:${Date.now()}`,
  })
}

const accountSelect = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  status: true,
  password: true,
} as const

async function issueResetLink(identifier: string) {
  if (!identifier) {
    hashResetToken(createResetToken())
    return
  }

  const byUsername = await prisma.user.findFirst({
    where: { username: { equals: identifier, mode: "insensitive" }, status: "ACTIVE" },
    select: accountSelect,
  })
  const user = byUsername ?? await prisma.user.findFirst({
    where: { email: { equals: identifier, mode: "insensitive" }, status: "ACTIVE" },
    select: accountSelect,
  })

  if (!user?.email) {
    hashResetToken(createResetToken())
    return
  }

  await sendResetLink(user)
}

async function sendResetLink(user: {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
}) {
  const token = createResetToken()
  const url = resetPasswordUrl(applicationBaseUrl(), token)
  if (!url) return false

  const now = new Date()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: resetExpiry(now),
    },
  })

  try {
    await enqueueAuthEmail({
      idempotencyKey: `password-reset:${hashResetToken(token)}`,
      recipientUserId: user.id,
      recipientEmail: user.email,
      subject: RESET_SUBJECT,
      templateKey: "password_reset",
      payload: {
        ...authPayload(user, formatActivity(now)),
        secureLink: encryptSecret(url),
      },
    })
  } catch {
    console.error("Password reset email could not be queued")
    return false
  }

  return true
}

async function findUsableToken(token: string) {
  const value = token.trim()
  if (value.length < 32 || value.length > 200) return null

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(value) },
    select: {
      usedAt: true,
      expiresAt: true,
      user: { select: accountSelect },
    },
  })
  if (!row || row.user.status !== "ACTIVE") return null
  if (!tokenIsUsable({ usedAt: row.usedAt, expiresAt: row.expiresAt, now: new Date() })) {
    return null
  }
  return row
}

async function ownerNotice(input: {
  userId: string
  title: string
  body: string
  fingerprint: string
}) {
  try {
    await prisma.notification.create({
      data: {
        dedupeKey: `PASSWORD|${input.fingerprint}`,
        category: "SYSTEM",
        eventType: "SYSTEM_PASSWORD",
        priority: "HIGH",
        kind: "EVENT",
        title: input.title,
        body: input.body,
        entityType: "User",
        entityId: input.userId,
        href: "/admin/profile",
        emailEligible: false,
        emailStatus: "NOT_APPLICABLE",
        receipts: { create: { userId: input.userId } },
      },
    })
  } catch {
    console.error("Password security notification could not be stored")
  }
}

function authPayload(
  user: { firstName: string; lastName: string; username: string },
  when: { label: string; date: string; time: string },
) {
  return {
    recipientName: displayName(user),
    username: user.username,
    title: "Account security",
    body: "This message is about your account password.",
    category: "SYSTEM",
    eventType: "SYSTEM_PASSWORD",
    poNumber: "",
    invoiceNumber: "",
    companyName: "",
    customerName: "",
    href: "",
    occurredAt: when.label,
    activityDate: when.date,
    activityTime: when.time,
  }
}

function displayName(user: { firstName: string; lastName: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "there"
}

function formatActivity(date: Date) {
  const datePart = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
  const timePart = `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)} IST`
  return { date: datePart, time: timePart, label: `${datePart}, ${timePart}` }
}
