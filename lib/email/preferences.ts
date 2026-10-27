import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types"
import { prisma } from "@/lib/prisma"
import { getUserPermissions } from "@/lib/rbac"

import { EMAIL_CATEGORY_COPY } from "./categories"
import { categoryLocks } from "./policy"

export async function getMyNotificationPreferences() {
  const user = await getUserPermissions()
  if (!user) return null

  const [preferences, settings] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId: user.id } }),
    prisma.emailCategorySetting.findMany(),
  ])

  return NOTIFICATION_CATEGORIES.map((category) => {
    const preference = preferences.find((row) => row.category === category)
    const setting = settings.find((row) => row.category === category)
    const locks = categoryLocks(category)
    const globallyEnabled = setting?.emailEnabled ?? true

    return {
      category,
      label: EMAIL_CATEGORY_COPY[category].label,
      description: EMAIL_CATEGORY_COPY[category].description,
      inAppEnabled: locks.inAppLocked ? true : preference?.inAppEnabled ?? true,
      emailEnabled: locks.emailLocked ? true : preference?.emailEnabled ?? true,
      inAppLocked: locks.inAppLocked,
      emailLocked: locks.emailLocked,
      emailPaused: !locks.emailLocked && !globallyEnabled,
    }
  })
}
