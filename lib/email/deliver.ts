import { prisma } from "@/lib/prisma"
import { singleLine } from "./html"
import { systemNotificationDraft } from "@/lib/notifications/model"
import { persistDrafts } from "@/lib/notifications/store"

import { attemptDelivery, type MailTransport } from "./attempt"
import { readSmtpConfig } from "./config"
import { applicationBaseUrl } from "./links"
import { sendSmtpMail } from "./smtp"
import { claimEmailJobs, recordEmailResult, recoverStaleEmailJobs, requeueOrphanNotifications } from "./queue"

type ClaimedEmailJob = Awaited<ReturnType<typeof claimEmailJobs>>[number]

const defaultTransport: MailTransport = async (mail) => {
  const config = readSmtpConfig()
  if (!config) throw new Error("Email service is not configured.")
  await sendSmtpMail(config, mail)
}

export async function processEmailBatch(options?: {
  limit?: number
  transport?: MailTransport
  now?: Date
}) {
  const now = options?.now ?? new Date()
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 50)

  await recoverStaleEmailJobs()
  await requeueOrphanNotifications()

  const jobs = await claimEmailJobs(limit)
  const counts = { processed: jobs.length, sent: 0, failed: 0, retrying: 0, deferred: 0 }
  if (jobs.length === 0) return counts

  for (const job of jobs) {
    const status = await deliverOne(job, options?.transport ?? defaultTransport, now)
    if (status === "SENT") counts.sent += 1
    if (status === "FAILED") counts.failed += 1
    if (status === "RETRYING") counts.retrying += 1
    if (status === "PENDING") counts.deferred += 1
  }

  return counts
}

export async function processEmailJob(
  id: string,
  options?: { transport?: MailTransport; now?: Date },
) {
  const { randomUUID } = await import("node:crypto")
  const token = randomUUID()
  const claimed = await prisma.emailJob.updateMany({
    where: {
      id,
      OR: [{ status: "PENDING" }, { status: "RETRYING" }],
    },
    data: {
      status: "PROCESSING",
      lockToken: token,
      lockedAt: new Date(),
    },
  })
  if (claimed.count === 0) return prisma.emailJob.findUnique({ where: { id } })

  const job = await prisma.emailJob.findFirst({ where: { id, lockToken: token } })
  if (!job) return null
  await deliverOne(job, options?.transport ?? defaultTransport, options?.now ?? new Date())
  return prisma.emailJob.findUnique({ where: { id } })
}

async function deliverOne(job: ClaimedEmailJob, transport: MailTransport, now: Date) {
  const configuration = await prisma.configuration.findFirst({ select: { name: true } })
  const outcome = await attemptDelivery({
    job: {
      recipientEmail: job.recipientEmail,
      cc: job.cc,
      bcc: job.bcc,
      subject: job.subject,
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        payload: job.payload,
        templateKey: job.templateKey,
      },
    config: readSmtpConfig(),
    transport,
    now,
    portalName: configuration?.name?.trim() || "Billing & Revenue Portal",
    baseUrl: applicationBaseUrl(),
  })

  const recorded = await recordEmailResult(job, outcome)
  if (recorded && outcome.status === "FAILED" && job.notificationId) {
    await notifyPermanentFailure(job.id, job.subject, outcome.attemptCount)
  }
  return recorded ? outcome.status : null
}

async function notifyPermanentFailure(jobId: string, subject: string, attempts: number) {
  try {
    await persistDrafts([
      systemNotificationDraft({
        eventType: "SYSTEM_EMAIL_FAILURE",
        entityType: "EmailJob",
        entityId: jobId,
        title: "Email delivery failed",
        body: `An email could not be delivered after ${attempts} attempts. Subject: ${singleLine(subject).slice(0, 120)}.`,
        href: "/admin/email?status=FAILED",
        fingerprint: jobId,
        priority: "HIGH",
      }),
    ])
  } catch {
    console.error("Email failure alert could not be stored")
  }
}
