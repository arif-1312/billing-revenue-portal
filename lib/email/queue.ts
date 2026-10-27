import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"

import { planEmailJobs, type EmailNotificationSource } from "./plan"
import {
  STALE_EMAIL_LOCK_MINUTES,
  summarizeEmailJobs,
  type EmailJobState,
} from "./outcome"

const PAYLOAD_KEYS = [
  "recipientName",
  "title",
  "body",
  "category",
  "eventType",
  "poNumber",
  "invoiceNumber",
  "companyName",
  "customerName",
  "href",
  "occurredAt",
] as const

export async function enqueueNotificationEmails(notifications: EmailNotificationSource[]) {
  const eligible = notifications.filter((notification) => notification.emailEligible)
  if (eligible.length === 0) return

  try {
    const [users, preferences, settings] = await Promise.all([
      prisma.user.findMany({
        where: { status: "ACTIVE", role: { status: "ACTIVE" } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: {
            select: {
              roleModules: {
                where: { canView: true, module: { status: "ACTIVE" } },
                select: { module: { select: { route: true } } },
              },
            },
          },
        },
      }),
      prisma.notificationPreference.findMany({
        select: { userId: true, category: true, emailEnabled: true },
      }),
      prisma.emailCategorySetting.findMany({
        select: { category: true, emailEnabled: true },
      }),
    ])

    const jobs = planEmailJobs({
      notifications: eligible,
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        viewRoutes: user.role.roleModules.map((roleModule) => roleModule.module.route),
      })),
      preferences,
      categoryEnabled: Object.fromEntries(
        settings.map((setting) => [setting.category, setting.emailEnabled]),
      ),
    })

    if (jobs.length > 0) {
      await prisma.emailJob.createMany({
        data: jobs.map((job) => ({
          idempotencyKey: job.idempotencyKey,
          notificationId: job.notificationId,
          eventKey: job.eventKey,
          recipientUserId: job.recipientUserId,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
          templateKey: job.templateKey,
          payload: Object.fromEntries(
            PAYLOAD_KEYS.map((key) => [key, job.payload[key]]),
          ),
          status: "PENDING",
        })),
        skipDuplicates: true,
      })
      scheduleEmailDrain()
    }

    const queued = new Set(jobs.map((job) => job.notificationId))
    const skipped = eligible
      .filter((notification) => !queued.has(notification.id))
      .map((notification) => notification.id)

    if (skipped.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: skipped }, emailStatus: "PENDING" },
        data: { emailStatus: "SKIPPED" },
      })
    }
  } catch {
    console.error("Email jobs could not be queued")
  }
}

export async function enqueueAuthEmail(input: {
  idempotencyKey: string
  recipientUserId: string
  recipientEmail: string
  subject: string
  templateKey: "password_reset" | "password_changed"
  payload: Record<string, string>
}) {
  await prisma.emailJob.create({
    data: {
      idempotencyKey: input.idempotencyKey,
      eventKey: input.idempotencyKey,
      recipientUserId: input.recipientUserId,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      templateKey: input.templateKey,
      payload: input.payload,
      status: "PENDING",
    },
  })
  scheduleEmailDrain()
}

export async function requeueOrphanNotifications() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000)
  const rows = await prisma.notification.findMany({
    where: {
      emailEligible: true,
      emailStatus: "PENDING",
      createdAt: { lt: cutoff },
      emailJobs: { none: {} },
    },
    take: 50,
  })

  if (rows.length === 0) return

  await enqueueNotificationEmails(
    rows.map((row) => ({
      id: row.id,
      dedupeKey: row.dedupeKey,
      category: row.category,
      eventType: row.eventType,
      priority: row.priority,
      title: row.title,
      body: row.body,
      customerName: row.customerName,
      companyName: row.companyName,
      invoiceNumber: row.invoiceNumber,
      poNumber: row.poNumber,
      href: row.href,
      occurredAt: row.occurredAt.toISOString(),
      emailEligible: row.emailEligible,
    })),
  )
}

export async function recoverStaleEmailJobs() {
  const cutoff = new Date(Date.now() - STALE_EMAIL_LOCK_MINUTES * 60 * 1000)
  await prisma.emailJob.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "RETRYING",
      nextAttemptAt: new Date(),
      lockedAt: null,
      lockToken: null,
      lastError: "Recovered after the worker stopped during delivery.",
    },
  })
}

export async function claimEmailJobs(limit: number) {
  const token = randomUUID()
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH claimed AS (
      SELECT "id"
      FROM "EmailJob"
      WHERE "status" IN ('PENDING'::"EmailJobStatus", 'RETRYING'::"EmailJobStatus")
        AND "nextAttemptAt" <= NOW()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "EmailJob" AS job
    SET
      "status" = 'PROCESSING'::"EmailJobStatus",
      "lockedAt" = NOW(),
      "lockToken" = ${token},
      "updatedAt" = NOW()
    FROM claimed
    WHERE job."id" = claimed."id"
    RETURNING job."id"
  `

  if (rows.length === 0) return []

  return prisma.emailJob.findMany({
    where: { id: { in: rows.map((row) => row.id) }, lockToken: token },
  })
}

export async function recordEmailResult(
  job: { id: string; lockToken: string | null; notificationId: string | null },
  outcome: {
    status: "PENDING" | "SENT" | "FAILED" | "RETRYING"
    attemptCount: number
    nextAttemptAt: Date
    sentAt: Date | null
    lastError: string | null
    lastAttemptAt: Date | null
  },
) {
  const updated = await prisma.emailJob.updateMany({
    where: {
      id: job.id,
      lockToken: job.lockToken ?? "",
      status: "PROCESSING",
    },
    data: {
      status: outcome.status,
      attemptCount: outcome.attemptCount,
      nextAttemptAt: outcome.nextAttemptAt,
      sentAt: outcome.sentAt,
      lastError: outcome.lastError,
      lastAttemptAt: outcome.lastAttemptAt,
      lockedAt: null,
      lockToken: null,
    },
  })

  if (updated.count === 0) return false
  if (job.notificationId) await refreshNotificationEmailStatus(job.notificationId)
  return true
}

export async function refreshNotificationEmailStatus(notificationId: string) {
  const groups = await prisma.emailJob.groupBy({
    by: ["status"],
    where: { notificationId },
    _count: { _all: true },
  })
  const counts: Partial<Record<EmailJobState, number>> = {}
  for (const group of groups) counts[group.status] = group._count._all
  const emailStatus = summarizeEmailJobs(counts)

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      emailStatus,
      ...(emailStatus === "SENT" ? { emailSentAt: new Date() } : {}),
    },
  })
}

let drainScheduled = false

export function scheduleEmailDrain() {
  if (process.env.EMAIL_WORKER_PROCESS === "1") return
  void import("./loop")
    .then(({ startEmailProcessingLoop }) => startEmailProcessingLoop())
    .catch(() => {
      console.error("Email delivery loop could not start")
    })
  if (drainScheduled) return
  drainScheduled = true
  const release = () => {
    drainScheduled = false
  }
  const timer = setTimeout(release, 5_000)

  void import("next/server")
    .then(({ after }) => {
      try {
        after(() => {
          clearTimeout(timer)
          release()
          void runEmailDrain()
        })
      } catch {
        clearTimeout(timer)
        release()
      }
    })
    .catch(() => {
      clearTimeout(timer)
      release()
    })
}

function runEmailDrain() {
  return import("./deliver")
    .then(({ processEmailBatch }) => processEmailBatch({ limit: 10 }))
    .catch(() => {
      console.error("Email drain failed")
    })
}
