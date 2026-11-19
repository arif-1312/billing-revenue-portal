"use server";

import { calendarDaysBetween, formatKolkataDate, parseKolkataDate } from "@/lib/fiscal-year";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function getUpcomingPoRenewals() {
  const access = await requirePermission("/admin/dashboard", "view");
  if (!access.ok) throw new Error("You do not have permission to view PO renewals.");

  const now = new Date();
  const start = parseKolkataDate(formatKolkataDate(now));
  const end = new Date(start.getTime() + 31 * 86_400_000);
  const orders = await prisma.purchaseOrder.findMany({
    where: { status: "LIVE", endDate: { gte: start, lt: end } },
    orderBy: { endDate: "asc" },
    select: {
      id: true, customerPONumber: true, startFrom: true, endDate: true,
      poAmount: true, poOwner: true,
      customer: { select: { companyName: true, firstName: true, lastName: true } },
      company: { select: { name: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    poNumber: order.customerPONumber?.trim() || "—",
    customer: order.customer?.companyName?.trim() || [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") || "—",
    company: order.company?.name || "—",
    owner: order.poOwner?.trim() || "—",
    startDate: order.startFrom ? formatKolkataDate(order.startFrom) : null,
    endDate: formatKolkataDate(order.endDate!),
    daysLeft: calendarDaysBetween(order.endDate!, now),
    amount: order.poAmount == null ? null : Number(order.poAmount),
  }));
}
