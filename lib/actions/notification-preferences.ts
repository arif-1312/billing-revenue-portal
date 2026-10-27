"use server"

import { consumeActionRateLimit } from "@/lib/action-rate-limit"
import { normalizePreferenceInput } from "@/lib/email/preference-input"
import { prisma } from "@/lib/prisma"
import { getUserPermissions, requirePermission } from "@/lib/rbac"

export async function saveNotificationPreferences(input: {
  items: Array<{ category?: string; inAppEnabled?: unknown; emailEnabled?: unknown }>
}) {
  const access = await requirePermission("/admin/notifications", "view")
  if (!access.ok) return { success: false, message: access.message }

  const user = await getUserPermissions()
  if (!user) return { success: false, message: "Sign in again to update preferences." }

  const allowed = await consumeActionRateLimit(
    `notification-preferences:${user.id}`,
    30,
    15 * 60 * 1000,
  )
  if (!allowed) {
    return { success: false, message: "Wait a few minutes before changing preferences again." }
  }

  const items = normalizePreferenceInput(input.items)
  if (!items) return { success: false, message: "Choose a valid notification preference." }

  try {
    await prisma.$transaction(
      items.map((item) =>
        prisma.notificationPreference.upsert({
          where: {
            userId_category: { userId: user.id, category: item.category },
          },
          update: {
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
          create: {
            userId: user.id,
            category: item.category,
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
        }),
      ),
    )
  } catch {
    return { success: false, message: "Preferences could not be saved." }
  }

  return { success: true, message: "Notification preferences saved." }
}
