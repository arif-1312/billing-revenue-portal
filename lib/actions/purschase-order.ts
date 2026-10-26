"use server";

import { prisma } from "../prisma";
import { purchaseOrderSchema } from "../validators";
import { formatError } from "../utils";
import { toBusinessDateValue } from "../date-utils";
import { PurchaseOrder } from "@/types";
import { PaymentReceived, Prisma } from "@prisma/client";
import { generatePurchaseOrderBillingCycles } from "../billing-cycle-utils";
import { moneyToNumber } from "../money";
import { purchaseOrderUpdateBlock } from "../purchase-order-guard";
import { canAccess, getUserPermissions, requirePermission } from "@/lib/rbac";
import type { PurchaseOrderSnapshot } from "@/lib/notifications/model";
import {
  publishPurchaseOrderChange,
  safeNotify,
} from "@/lib/notifications/publish";
import { loadPurchaseOrderSnapshots } from "@/lib/notifications/store";

// ================= DATE HELPER =================
const toLocalDate = (date?: string | Date | null): Date | undefined => {
  return toBusinessDateValue(date) ?? undefined;
};

const emptyToUndefined = (value?: string | null) => {
  if (typeof value !== "string") return value ?? undefined;

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const resolveBillingSubmittedDate = (billingCycle?: {
  billingSubmittedDate?: string | Date | null;
  invoiceDate?: string | Date | null;
}) => {
  return toLocalDate(
    billingCycle?.invoiceDate ?? billingCycle?.billingSubmittedDate,
  );
};

const resolvePaymentDueDate = (billingCycle?: {
  billingSubmittedDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  paymentDueDate?: string | Date | null;
}) => {
  return toLocalDate(
    billingCycle?.paymentDueDate ??
      billingCycle?.invoiceDate ??
      billingCycle?.billingSubmittedDate,
  );
};

const receiptCreates = (billingCycle?: {
  collectedAmount?: number | null;
  paymentReceivedDate?: string | Date | null;
  payments?: Array<{
    id?: string | null;
    receivedDate?: string | Date | null;
    amount?: number | null;
  }> | null;
}) => {
  const entered = (billingCycle?.payments ?? []).flatMap((payment) => {
    const receivedDate = toLocalDate(payment.receivedDate);
    const amount = Number(payment.amount || 0);
    if (!receivedDate || !Number.isFinite(amount) || amount === 0) return [];
    return [{
      id: typeof payment.id === "string" ? payment.id : undefined,
      receivedDate,
      amount,
    }];
  });

  if (entered.length > 0) return entered;

  const receivedDate = toLocalDate(billingCycle?.paymentReceivedDate);
  const amount = Number(billingCycle?.collectedAmount || 0);
  if (!receivedDate || !Number.isFinite(amount) || amount === 0) return [];

  return [{ id: undefined, receivedDate, amount }];
};

const billingCycleCreateData = (billingCycle: {
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  creditNote?: number | null;
  collectedAmount?: number | null;
  invoiceDate?: string | Date | null;
  billingSubmittedDate?: string | Date | null;
  paymentReceivedDate?: string | Date | null;
  paymentDueDate?: string | Date | null;
  paymentReceived?: PaymentReceived | null;
  billingRemark?: string | null;
  tds?: number | null;
  payments?: Array<{
    receivedDate?: string | Date | null;
    amount?: number | null;
  }> | null;
}) => {
  const payments = receiptCreates(billingCycle);
  const collectedAmount = payments.length
    ? payments.reduce((total, payment) => total + payment.amount, 0)
    : billingCycle.collectedAmount ?? 0;
  const latestReceipt = [...payments].sort(
    (left, right) => left.receivedDate.getTime() - right.receivedDate.getTime(),
  ).at(-1);

  return {
    cycle: {
      invoiceNumber: billingCycle.invoiceNumber ?? "",
      invoiceAmount: billingCycle.invoiceAmount ?? 0,
      creditNote: new Prisma.Decimal(billingCycle.creditNote ?? 0),
      collectedAmount,
      invoiceDate: toLocalDate(billingCycle.invoiceDate),
      billingSubmittedDate: resolveBillingSubmittedDate(billingCycle),
      paymentReceivedDate: latestReceipt?.receivedDate ?? toLocalDate(billingCycle.paymentReceivedDate),
      paymentDueDate: resolvePaymentDueDate(billingCycle),
      paymentReceived: billingCycle.paymentReceived,
      billingRemark: billingCycle.billingRemark ?? "",
      tds: new Prisma.Decimal(billingCycle.tds ?? 0),
    },
    payments,
  };
};

const createBillingCycles = async (
  db: Prisma.TransactionClient,
  purchaseOrderId: string,
  cycles: Array<ReturnType<typeof billingCycleCreateData>>,
) => {
  for (const item of cycles) {
    const data: Prisma.BillingCycleCreateInput = {
      invoiceNumber: item.cycle.invoiceNumber,
      invoiceAmount: item.cycle.invoiceAmount,
      creditNote: item.cycle.creditNote,
      collectedAmount: item.cycle.collectedAmount,
      invoiceDate: item.cycle.invoiceDate,
      billingSubmittedDate: item.cycle.billingSubmittedDate,
      paymentReceivedDate: item.cycle.paymentReceivedDate,
      paymentDueDate: item.cycle.paymentDueDate,
      paymentReceived: item.cycle.paymentReceived ?? undefined,
      billingRemark: item.cycle.billingRemark,
      tds: item.cycle.tds,
      purchaseOrder: { connect: { id: purchaseOrderId } },
      payments: item.payments.length
        ? {
            create: item.payments.map((payment) => ({
              amount: payment.amount,
              receivedDate: payment.receivedDate,
            })),
          }
        : undefined,
    };

    await db.billingCycle.create({ data });
  }
};

// ================= GET ALL =================
export async function getPurchaseOrders() {
  try {
    const access = await requirePermission("/admin/revenue", "view");
    if (!access.ok) {
      return { success: false, data: [], message: access.message };
    }

    const data = await prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: {
        billingPlan: true,
        ServiceType: true,
        contractDuration: true,
        contract: true,
        customer: true,
        billingCycles: {
          include: {
            payments: {
              orderBy: { receivedDate: "asc" },
            },
          },
        },
        company: true,
        vendor: true,
      },
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, data: [], message: formatError(error) };
  }
}

// ================= CREATE =================
export async function createPurchaseOrder(data: PurchaseOrder) {
  try {
    const access = await requirePermission("/admin/revenue", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const validated = purchaseOrderSchema.parse(data);
    const billingPlanId = emptyToUndefined(validated.billingPlanId);
    const billingPlan =
      billingPlanId
        ? await prisma.billingPlan.findUnique({
            where: { id: billingPlanId },
          })
        : null;

    if (billingPlanId && !billingPlan) {
      throw new Error("Billing Plan not found");
    }

    const generatedCycles =
      billingPlan &&
      !validated.billingCycles?.length &&
      validated.startFrom
        ? generatePurchaseOrderBillingCycles({
            startDate: toLocalDate(validated.startFrom) ?? new Date(),
            endDate: toLocalDate(validated.endDate) ?? null,
            totalBillingCycles: billingPlan.totalBillingCycles,
            planName: billingPlan.name,
            type: billingPlan.billingCycleType as "START" | "MID" | "END",
          })
        : [];
    const generatedInvoiceAmount =
      generatedCycles.length > 0
        ? Math.round(((validated.poAmount ?? 0) / generatedCycles.length) * 100) / 100
        : 0;
    const generatedBillingCycles = generatedCycles.map((cycle) => ({
      invoiceNumber: "",
      invoiceAmount: generatedInvoiceAmount,
      collectedAmount: 0,
      invoiceDate: cycle.invoiceDate,
      billingSubmittedDate: resolveBillingSubmittedDate(cycle),
      paymentReceivedDate: null,
      paymentDueDate: resolvePaymentDueDate(cycle),
      paymentReceived: PaymentReceived.NO,
      billingRemark: "",
      tds: new Prisma.Decimal(0),
    }));

    const purchaseOrderData: Prisma.PurchaseOrderUncheckedCreateInput = {
      customerPONumber: emptyToUndefined(validated.customerPONumber) ?? null,
      poAmount: validated.poAmount ?? null,
      serviceTypeId: emptyToUndefined(validated.serviceTypeId) ?? null,
      contractDurationId:
        emptyToUndefined(validated.contractDurationId) ?? null,
      contractId: emptyToUndefined(validated.contractId) ?? null,
      startFrom: toLocalDate(validated.startFrom) ?? null,
      endDate: toLocalDate(validated.endDate) ?? null,
      companyId: emptyToUndefined(validated.companyId) ?? null,
      vendorId: emptyToUndefined(validated.vendorId) ?? null,
      paymentTerms: emptyToUndefined(validated.paymentTerms) ?? null,
      customerId: emptyToUndefined(validated.customerId) ?? null,
      billingPlanId: billingPlanId ?? null,
      poOwner: emptyToUndefined(validated.poOwner) ?? null,
      purchaseOrderType: validated.purchaseOrderType ?? null,
      status: validated.status,
      ageingDays: validated.ageingDays?.toString() ?? null,
      remark: validated.remark ?? null,
      scope: emptyToUndefined(validated.scope) ?? null,
      ...(generatedBillingCycles.length > 0
        ? { billingCycles: { create: generatedBillingCycles } }
        : {}),
    };

    const created = await prisma.purchaseOrder.create({
      data: purchaseOrderData,
      select: { id: true },
    });

    if (generatedCycles.length === 0) {
      await prisma.$transaction((tx) =>
        createBillingCycles(
          tx,
          created.id,
          validated.billingCycles.map((bc) => billingCycleCreateData(bc)),
        ),
      );
    }

    await safeNotify(() => publishPurchaseOrderChange(null, created.id));

    return { success: true, message: "Purchase Order created successfully" };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// ================= GET BY ID =================
export async function getPurchaseOrderById(id: string) {
  try {
    const access = await requirePermission("/admin/revenue", "view", [
      { route: "/admin/revenue", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const data = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        ServiceType: true,
        billingPlan: true,
        contractDuration: true,
        contract: true,
        customer: true,
        billingCycles: {
          include: {
            payments: {
              orderBy: { receivedDate: "asc" },
            },
          },
        },
        company: true,
        vendor: true,
      },
    });

    if (!data) return { success: false };

    return { success: true, data };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

const syncBillingCycles = async (
  db: Prisma.TransactionClient,
  purchaseOrderId: string,
  cycles: NonNullable<PurchaseOrder["billingCycles"]>,
  options: { canDelete: boolean; isSystem: boolean },
) => {
  const existing = await db.billingCycle.findMany({
    where: { purchaseOrderId },
    include: { payments: true },
  });
  const existingById = new Map(existing.map((cycle) => [cycle.id, cycle]));
  const seen = new Set<string>();

  for (const cycle of cycles) {
    const prepared = billingCycleCreateData(cycle);
    const previous = cycle.id ? existingById.get(cycle.id) : undefined;

    if (previous) {
      seen.add(previous.id);
      const paid =
        previous.payments.length > 0 || previous.paymentReceived === "YES";
      if (
        paid &&
        !options.isSystem &&
        (moneyToNumber(previous.invoiceAmount) !==
          moneyToNumber(prepared.cycle.invoiceAmount) ||
          moneyToNumber(previous.creditNote) !==
            moneyToNumber(prepared.cycle.creditNote))
      ) {
        throw new Error("Paid billing cycles cannot be changed.");
      }

      await db.billingCycle.update({
        where: { id: previous.id },
        data: {
          ...prepared.cycle,
          paymentReceived: prepared.cycle.paymentReceived ?? undefined,
        },
      });

      const incomingIds = new Set(
        prepared.payments.flatMap((payment) =>
          payment.id ? [payment.id] : [],
        ),
      );
      for (const payment of previous.payments) {
        if (incomingIds.has(payment.id)) continue;
        if (!options.canDelete && !options.isSystem) {
          throw new Error("Delete permission is required to remove a payment.");
        }
        await db.billingCyclePayment.delete({ where: { id: payment.id } });
      }

      for (const payment of prepared.payments) {
        if (payment.id && previous.payments.some((item) => item.id === payment.id)) {
          await db.billingCyclePayment.update({
            where: { id: payment.id },
            data: {
              amount: payment.amount,
              receivedDate: payment.receivedDate,
            },
          });
          continue;
        }

        await db.billingCyclePayment.create({
          data: {
            billingCycleId: previous.id,
            amount: payment.amount,
            receivedDate: payment.receivedDate,
          },
        });
      }
      continue;
    }

    await db.billingCycle.create({
      data: {
        invoiceNumber: prepared.cycle.invoiceNumber,
        invoiceAmount: prepared.cycle.invoiceAmount,
        creditNote: prepared.cycle.creditNote,
        collectedAmount: prepared.cycle.collectedAmount,
        invoiceDate: prepared.cycle.invoiceDate,
        billingSubmittedDate: prepared.cycle.billingSubmittedDate,
        paymentReceivedDate: prepared.cycle.paymentReceivedDate,
        paymentDueDate: prepared.cycle.paymentDueDate,
        paymentReceived: prepared.cycle.paymentReceived ?? undefined,
        billingRemark: prepared.cycle.billingRemark,
        tds: prepared.cycle.tds,
        purchaseOrder: { connect: { id: purchaseOrderId } },
        payments: prepared.payments.length
          ? {
              create: prepared.payments.map((payment) => ({
                amount: payment.amount,
                receivedDate: payment.receivedDate,
              })),
            }
          : undefined,
      },
    });
  }

  for (const cycle of existing) {
    if (seen.has(cycle.id)) continue;
    const paid = cycle.payments.length > 0 || cycle.paymentReceived === "YES";
    if (paid && !options.isSystem) {
      throw new Error("Paid billing history cannot be removed.");
    }
    if (!options.canDelete && !options.isSystem) {
      throw new Error("Delete permission is required to remove a billing cycle.");
    }
    await db.billingCycle.delete({ where: { id: cycle.id } });
  }
};

// ================= UPDATE =================
export async function updatePurchaseOrder(
  data: PurchaseOrder,
  id: string
) {
  try {
    const access = await requirePermission("/admin/revenue", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const validated = purchaseOrderSchema.parse(data);
    const billingPlanId = emptyToUndefined(validated.billingPlanId);
    let previous: PurchaseOrderSnapshot | null = null;
    let previousLoaded = false;
    try {
      const snapshots = await loadPurchaseOrderSnapshots(prisma, [id]);
      previous = snapshots[0] ?? null;
      previousLoaded = true;
    } catch {
      previousLoaded = false;
    }

    const purchaseOrderData: Prisma.PurchaseOrderUncheckedUpdateInput = {
      customerPONumber: emptyToUndefined(validated.customerPONumber) ?? null,
      poAmount: validated.poAmount ?? null,
      serviceTypeId: emptyToUndefined(validated.serviceTypeId) ?? null,
      contractDurationId:
        emptyToUndefined(validated.contractDurationId) ?? null,
      contractId: emptyToUndefined(validated.contractId) ?? null,
      startFrom: toLocalDate(validated.startFrom) ?? null,
      endDate: toLocalDate(validated.endDate) ?? null,
      companyId: emptyToUndefined(validated.companyId) ?? null,
      vendorId: emptyToUndefined(validated.vendorId) ?? null,
      paymentTerms: emptyToUndefined(validated.paymentTerms) ?? null,
      customerId: emptyToUndefined(validated.customerId) ?? null,
      billingPlanId: billingPlanId ?? null,
      poOwner: emptyToUndefined(validated.poOwner) ?? null,
      purchaseOrderType: validated.purchaseOrderType ?? null,
      status: validated.status,
      ageingDays: validated.ageingDays?.toString() ?? null,
      remark: validated.remark ?? null,
      scope: emptyToUndefined(validated.scope) ?? null,
    };

    const current = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true, updatedAt: true },
    });
    if (!current) {
      return { success: false, message: "Purchase order not found" };
    }

    const actor = await getUserPermissions();
    const actorIsSystem = Boolean(
      actor?.role?.isSystem && actor.role.status === "ACTIVE",
    );
    const blocked = purchaseOrderUpdateBlock({
      status: current.status,
      actorIsSystem,
      expectedUpdatedAt: validated.updatedAt,
      currentUpdatedAt: current.updatedAt,
    });
    if (blocked) {
      return { success: false, message: blocked };
    }

    const canDelete = await canAccess("/admin/revenue", "delete");

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id },
        data: purchaseOrderData,
      });
      await syncBillingCycles(
        tx,
        id,
        validated.billingCycles ?? [],
        { canDelete, isSystem: actorIsSystem },
      );
    });

    if (previousLoaded) {
      await safeNotify(() => publishPurchaseOrderChange(previous, id));
    }

    return { success: true, message: "Purchase Order updated successfully" };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// ================= DELETE =================
export async function deletePurchaseOrder(id: string) {
  try {
    const access = await requirePermission("/admin/revenue", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    await prisma.$transaction([
      prisma.billingCycle.deleteMany({
        where: { purchaseOrderId: id },
      }),
      prisma.purchaseOrder.delete({
        where: { id },
      }),
    ]);

    return {
      success: true,
      message: "Purchase Order deleted successfully",
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// ================= GET BILLING CYCLES =================
export async function getBillingCyclesByPOID(id: string) {
  try {
    const access = await requirePermission("/admin/revenue", "view", [
      { route: "/admin/revenue", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const data = await prisma.billingCycle.findMany({
      where: { purchaseOrderId: id },
      orderBy: { billingSubmittedDate: "asc" },
    });

    return {
      success: true,
      data,
      message: "Billing Cycles fetched successfully",
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
