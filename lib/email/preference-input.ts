import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/types"

import { categoryEmailCanBeDisabled, categoryLocks } from "./policy"

export function normalizePreferenceInput(
  items: Array<{ category?: string; inAppEnabled?: unknown; emailEnabled?: unknown }>,
) {
  const normalized = NOTIFICATION_CATEGORIES.map((category) => {
    const item = items.find((row) => row.category === category)
    if (!item || typeof item.inAppEnabled !== "boolean" || typeof item.emailEnabled !== "boolean") {
      return null
    }
    const locks = categoryLocks(category)
    return {
      category,
      inAppEnabled: locks.inAppLocked ? true : item.inAppEnabled,
      emailEnabled: locks.emailLocked ? true : item.emailEnabled,
    }
  })

  if (normalized.some((row) => row == null)) return null
  return normalized as Array<{
    category: NotificationCategory
    inAppEnabled: boolean
    emailEnabled: boolean
  }>
}

export function normalizeCategoryEmailInput(categories: string[]) {
  const selected = new Set(categories)
  return NOTIFICATION_CATEGORIES.map((category) => ({
    category,
    emailEnabled: categoryEmailCanBeDisabled(category) ? selected.has(category) : true,
  }))
}
