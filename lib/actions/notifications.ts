"use server"

import { revalidatePath } from "next/cache"

import {
  deleteNotificationReceipt,
  getNotificationPreview,
  getUnreadNotificationCount,
  markAllNotificationReceiptsRead,
  markNotificationReceiptRead,
} from "@/lib/notifications/store"

export async function loadNotificationPreview(scope: "all" | "unread") {
  return getNotificationPreview(scope === "unread" ? "unread" : "all")
}

export async function loadUnreadNotificationCount() {
  return getUnreadNotificationCount()
}

export async function markNotificationRead(receiptId: string) {
  const result = await markNotificationReceiptRead(receiptId)
  if (result.ok) revalidatePath("/admin/notifications")
  return result
}

export async function markAllNotificationsRead() {
  const result = await markAllNotificationReceiptsRead()
  if (result.ok) revalidatePath("/admin/notifications")
  return result
}

export async function deleteNotification(receiptId: string) {
  const result = await deleteNotificationReceipt(receiptId)
  if (result.ok) revalidatePath("/admin/notifications")
  return result
}
