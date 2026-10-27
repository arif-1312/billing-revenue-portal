import type { NotificationCategory } from "@/lib/notifications/types"

export const EMAIL_CATEGORY_COPY: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  PURCHASE_ORDER: {
    label: "Purchase order notifications",
    description:
      "Created, updated, closed, and expiring purchase orders. Critical alerts still appear in the notification centre.",
  },
  INVOICE: {
    label: "Invoice notifications",
    description:
      "Invoice creation, updates, and payment completion. Critical alerts still appear in the notification centre.",
  },
  PAYMENT: {
    label: "Payment notifications",
    description:
      "Due reminders, overdue balances, and payments received. Critical alerts still appear in the notification centre.",
  },
  CONTRACT: {
    label: "Contract notifications",
    description:
      "Contracts that are expiring or have ended. Critical alerts still appear in the notification centre.",
  },
  SYSTEM: {
    label: "System notifications",
    description:
      "Account, role, and administrative alerts. Security and critical administrative notices stay on.",
  },
}
