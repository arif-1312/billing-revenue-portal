import { normalizeEmailAddress } from "./address"
import { emailSubject } from "./template"
import {
  requiredViewRoute,
  shouldDeliverEmail,
} from "./policy"

export type EmailNotificationSource = {
  id: string
  dedupeKey: string
  category: string
  eventType: string
  priority: string
  title: string
  body: string
  customerName: string | null
  companyName: string | null
  invoiceNumber: string | null
  poNumber: string | null
  href: string | null
  occurredAt: string
  emailEligible: boolean
}

export type EmailRecipientCandidate = {
  id: string
  email: string
  firstName: string
  lastName: string
  viewRoutes: string[]
}

export type EmailPreference = {
  userId: string
  category: string
  emailEnabled: boolean
}

export type PlannedEmailJob = {
  idempotencyKey: string
  notificationId: string
  eventKey: string
  recipientUserId: string
  recipientEmail: string
  subject: string
  templateKey: string
  payload: {
    recipientName: string
    title: string
    body: string
    category: string
    eventType: string
    poNumber: string
    invoiceNumber: string
    companyName: string
    customerName: string
    href: string
    occurredAt: string
  }
}

export function planEmailJobs(input: {
  notifications: EmailNotificationSource[]
  users: EmailRecipientCandidate[]
  preferences: EmailPreference[]
  categoryEnabled: Partial<Record<string, boolean>>
}) {
  const jobs: PlannedEmailJob[] = []

  for (const notification of input.notifications) {
    const route = requiredViewRoute(notification.category, notification.href)

    for (const user of input.users) {
      const email = normalizeEmailAddress(user.email)
      if (!email || !user.viewRoutes.includes(route)) continue

      const preference = input.preferences.find(
        (row) => row.userId === user.id && row.category === notification.category,
      )
      const allowed = shouldDeliverEmail({
        category: notification.category,
        priority: notification.priority,
        emailEligible: notification.emailEligible,
        categoryEnabled: input.categoryEnabled[notification.category] ?? true,
        userEmailEnabled: preference ? preference.emailEnabled : true,
      })
      if (!allowed) continue

      const recipientName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      jobs.push({
        idempotencyKey: `email:${notification.id}:${user.id}`,
        notificationId: notification.id,
        eventKey: notification.dedupeKey,
        recipientUserId: user.id,
        recipientEmail: email,
        subject: emailSubject({
          eventType: notification.eventType,
          title: notification.title,
          poNumber: notification.poNumber,
          invoiceNumber: notification.invoiceNumber,
        }),
        templateKey: notification.eventType.toLowerCase(),
        payload: {
          recipientName: recipientName || "there",
          title: notification.title,
          body: notification.body,
          category: notification.category,
          eventType: notification.eventType,
          poNumber: notification.poNumber?.trim() ?? "",
          invoiceNumber: notification.invoiceNumber?.trim() ?? "",
          companyName: notification.companyName?.trim() ?? "",
          customerName: notification.customerName?.trim() ?? "",
          href: notification.href ?? "",
          occurredAt: notification.occurredAt,
        },
      })
    }
  }

  return dedupePlannedJobs(jobs)
}

export function dedupePlannedJobs(jobs: PlannedEmailJob[]) {
  const seen = new Set<string>()
  return jobs.filter((job) => {
    if (seen.has(job.idempotencyKey)) return false
    seen.add(job.idempotencyKey)
    return true
  })
}
