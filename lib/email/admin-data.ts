import type { EmailJobStatus } from "@prisma/client"

import { EMAIL_CATEGORY_COPY } from "@/lib/email/categories"
import { publicSmtpStatus } from "@/lib/email/config"
import { categoryEmailCanBeDisabled } from "@/lib/email/policy"
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/rbac"

const PAGE_SIZE = 20
const STATUSES = ["PENDING", "PROCESSING", "SENT", "FAILED", "RETRYING"] as const

export async function getEmailAdminData(input: { status?: string; page?: string }) {
  const [canView, canEdit] = await Promise.all([
    canAccess("/admin/email", "view"),
    canAccess("/admin/email", "edit"),
  ])
  if (!canView) return null

  const status = STATUSES.includes(input.status as (typeof STATUSES)[number])
    ? (input.status as EmailJobStatus)
    : ""
  const page = Math.max(1, Number(input.page) || 1)
  const where = status ? { status } : {}

  const [settings, total, jobs, grouped] = await Promise.all([
    prisma.emailCategorySetting.findMany(),
    prisma.emailJob.count({ where }),
    prisma.emailJob.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        recipientEmail: true,
        subject: true,
        templateKey: true,
        status: true,
        attemptCount: true,
        maxAttempts: true,
        lastAttemptAt: true,
        sentAt: true,
        lastError: true,
        eventKey: true,
        notificationId: true,
      },
    }),
    prisma.emailJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ])

  const counts = { PENDING: 0, PROCESSING: 0, SENT: 0, FAILED: 0, RETRYING: 0 }
  for (const group of grouped) counts[group.status] = group._count._all

  return {
    status: publicSmtpStatus(),
    canEdit,
    page,
    pageSize: PAGE_SIZE,
    total,
    statusFilter: status,
    counts,
    categories: NOTIFICATION_CATEGORIES.map((category) => ({
      category,
      label: EMAIL_CATEGORY_COPY[category].label,
      description: EMAIL_CATEGORY_COPY[category].description,
      emailEnabled:
        category === "SYSTEM"
          ? true
          : settings.find((row) => row.category === category)?.emailEnabled ?? true,
      locked: !categoryEmailCanBeDisabled(category),
    })),
    jobs: jobs.map((job) => ({
      ...job,
      lastAttemptAt: stamp(job.lastAttemptAt),
      sentAt: stamp(job.sentAt),
      lastError: job.lastError,
    })),
  }
}

function stamp(value: Date | null) {
  if (!value) return null
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}
