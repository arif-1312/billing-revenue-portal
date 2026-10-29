import type { NotificationCategory } from "@/lib/notifications/types"

export const EMAIL_CATEGORY_COPY: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  PURCHASE_ORDER: {
    label: "Purchase order notifications",
    description:
      "Created, updated, closed, and expiring purchase orders. These are emailed.",
  },
  INVOICE: {
    label: "Invoice notifications",
    description:
      "Invoice creation, updates, and payment completion. These stay in the notification centre.",
  },
  PAYMENT: {
    label: "Payment notifications",
    description:
      "Due reminders, overdue balances, and payments received. These stay in the notification centre.",
  },
  CONTRACT: {
    label: "Contract notifications",
    description:
      "Contracts that are expiring or have ended. These stay in the notification centre.",
  },
  SYSTEM: {
    label: "System notifications",
    description:
      "Account and administrative alerts stay in the notification centre. P&L project changes are emailed.",
  },
}
