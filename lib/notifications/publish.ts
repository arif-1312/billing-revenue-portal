import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/prisma"
import { getActiveCompanyContext } from "@/lib/company-context"

import {
  systemNotificationDraft,
  transitionNotificationDrafts,
  type NotificationDraft,
  type PurchaseOrderSnapshot,
  type SystemNotificationInput,
} from "./model"
import {
  loadPurchaseOrderSnapshots,
  persistDrafts,
  syncStateNotificationsIfDue,
} from "./store"

export async function safeNotify(task: () => Promise<void>) {
  try {
    await task()
  } catch {
    console.error("Notification delivery failed")
  }
}

export async function publishPurchaseOrderChange(
  before: PurchaseOrderSnapshot | null,
  purchaseOrderId: string,
) {
  const [after] = await loadPurchaseOrderSnapshots(prisma, [purchaseOrderId])
  if (!after) return
  await publishDrafts(transitionNotificationDrafts(before, after))
  await syncStateNotificationsIfDue(true)
}

export async function publishPurchaseOrderChanges(
  before: PurchaseOrderSnapshot[],
  purchaseOrderIds: string[],
) {
  if (purchaseOrderIds.length === 0) return
  const after = await loadPurchaseOrderSnapshots(prisma, purchaseOrderIds)
  const previous = new Map(before.map((order) => [order.id, order]))
  const drafts = after.flatMap((order) =>
    transitionNotificationDrafts(previous.get(order.id) ?? null, order),
  )
  await publishDrafts(drafts)
  await syncStateNotificationsIfDue(true)
}

export async function safePublishSystem(input: SystemNotificationInput) {
  await safeNotify(async () => {
    const company = await getActiveCompanyContext().catch(() => null)
    await publishDrafts([
      systemNotificationDraft({
        ...input,
        companyId: input.companyId ?? company?.companyId ?? null,
      }),
    ])
  })
}

async function publishDrafts(drafts: NotificationDraft[]) {
  await persistDrafts(drafts)
  try {
    revalidatePath("/admin/notifications")
  } catch {
    // Stored rows are still returned on the next read.
  }
}
