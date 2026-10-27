"use server"

import { randomUUID } from "node:crypto"

import { consumeActionRateLimit } from "@/lib/action-rate-limit"
import { normalizeCategoryEmailInput } from "@/lib/email/preference-input"
import { normalizeEmailAddress } from "@/lib/email/address"
import { processEmailJob } from "@/lib/email/deliver"
import { scheduleEmailDrain } from "@/lib/email/queue"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, requirePermission } from "@/lib/rbac"

const JOB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function saveEmailCategories(categories: string[]) {
  const access = await requirePermission("/admin/email", "edit")
  if (!access.ok) return { success: false, message: access.message }

  const user = await getUserPermissions()
  if (!user) return { success: false, message: "Sign in again to update email settings." }

  const allowed = await consumeActionRateLimit(`email-categories:${user.id}`, 20, 15 * 60 * 1000)
  if (!allowed) {
    return { success: false, message: "Wait a few minutes before changing email categories again." }
  }

  if (!Array.isArray(categories) || categories.some((category) => typeof category !== "string")) {
    return { success: false, message: "Choose a valid email category." }
  }

  const items = normalizeCategoryEmailInput(categories)

  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.emailCategorySetting.upsert({
          where: { category: item.category },
          update: { emailEnabled: item.emailEnabled },
          create: item,
        }),
      ),
    )
  } catch {
    return { success: false, message: "Email categories could not be saved." }
  }

  return { success: true, message: "Email categories saved." }
}

export async function sendTestEmail() {
  const access = await requirePermission("/admin/email", "edit")
  if (!access.ok) return { success: false, message: access.message }

  const user = await getUserPermissions()
  if (!user) return { success: false, message: "Sign in again to send a test email." }

  const recipient = normalizeEmailAddress(user.email)
  if (!recipient) return { success: false, message: "Your account does not have a valid email address." }

  const allowed = await consumeActionRateLimit(`email-test:${user.id}`, 5, 15 * 60 * 1000)
  if (!allowed) {
    return { success: false, message: "Wait a few minutes before sending another test email." }
  }

  const recipientName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "there"
  const subject = "Billing Portal email test"

  try {
    const job = await prisma.emailJob.create({
      data: {
        idempotencyKey: `test:${user.id}:${randomUUID()}`,
        eventKey: `TEST:${user.id}:${randomUUID()}`,
        recipientUserId: user.id,
        recipientEmail: recipient,
        subject,
        templateKey: "system_test",
        payload: {
          recipientName,
          title: "Email service test",
          body: "This is a test message from the Billing Portal. No business record was changed.",
          category: "SYSTEM",
          eventType: "SYSTEM_TEST",
          poNumber: "",
          invoiceNumber: "",
          companyName: "",
          customerName: "",
          href: "/admin/email",
          occurredAt: new Date().toISOString(),
        },
        status: "PENDING",
      },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.email,
        action: "CREATE",
        model: "EmailTest",
        recordId: job.id,
        after: { recipient, subject },
      },
    })

    const updated = await processEmailJob(job.id)
    if (!updated) return { success: false, message: "The test email could not be queued." }
    if (updated.status === "SENT") return { success: true, message: "Test email sent." }
    if (updated.status === "RETRYING") {
      return {
        success: false,
        message: `${updated.lastError || "Temporary delivery failure."} It will be retried.`,
      }
    }
    return {
      success: false,
      message: updated.lastError || "The test email could not be sent.",
    }
  } catch {
    return { success: false, message: "The test email could not be sent." }
  }
}

export async function retryEmailJob(id: string) {
  const access = await requirePermission("/admin/email", "edit")
  if (!access.ok) return { success: false, message: access.message }
  if (!JOB_ID.test(id)) return { success: false, message: "That email job is no longer available." }

  const user = await getUserPermissions()
  if (!user) return { success: false, message: "Sign in again to retry email delivery." }

  const allowed = await consumeActionRateLimit(`email-retry:${user.id}`, 30, 15 * 60 * 1000)
  if (!allowed) return { success: false, message: "Wait a few minutes before retrying more emails." }

  try {
    const updated = await prisma.emailJob.updateMany({
      where: { id, status: "FAILED" },
      data: {
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        lastAttemptAt: null,
        sentAt: null,
        lockedAt: null,
        lockToken: null,
      },
    })
    if (updated.count === 0) {
      return { success: false, message: "Only failed email jobs can be retried." }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.email,
        action: "UPDATE",
        model: "EmailJob",
        recordId: id,
        after: { status: "PENDING", retry: true },
      },
    })
    scheduleEmailDrain()
    return { success: true, message: "Email queued for delivery." }
  } catch {
    return { success: false, message: "This email could not be retried." }
  }
}
