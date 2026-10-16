"use server";

import { prisma } from "../prisma";
import { purchaseOrderSchema } from "../validators";
import { formatError } from "../utils";
import { toBusinessDateValue } from "../date-utils";
import { PurchaseOrder } from "@/types";
import { PaymentReceived, Prisma } from "@prisma/client";
import { generatePurchaseOrderBillingCycles } from "../billing-cycle-utils";
import { requirePermission } from "@/lib/rbac";

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
    receivedDate?: string | Date | null;
    amount?: number | null;
  }> | null;
}) => {
  const entered = (billingCycle?.payments ?? []).flatMap((payment) => {
    const receivedDate = toLocalDate(payment.receivedDate);
    const amount = Number(payment.amount || 0);
    if (!receivedDate || !Number.isFinite(amount) || amount === 0) return [];
    return [{ receivedDate, amount }];
  });

  if (entered.length > 0) return entered;

  const receivedDate = toLocalDate(billingCycle?.paymentReceivedDate);
  const amount = Number(billingCycle?.collectedAmount || 0);
  if (!receivedDate || !Number.isFinite(amount) || amount === 0) return [];

  return [{ receivedDate, amount }];
};

const billingCycleCreateData = (billingCycle: {
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
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
      collectedAmount: item.cycle.collectedAmount,
      invoiceDate: item.cycle.invoiceDate,
      billingSubmittedDate: item.cycle.billingSubmittedDate,
      paymentReceivedDate: item.cycle.paymentReceivedDate,
      paymentDueDate: item.cycle.paymentDueDate,
      paymentReceived: item.cycle.paymentReceived ?? undefined,
      billingRemark: item.cycle.billingRemark,
      tds: item.cycle.tds,
      purchaseOrder: { connect: { id: purchaseOrderId } },
      payments: item.payments.length ? { create: item.payments } : undefined,
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

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id },
        data: purchaseOrderData,
      });
      await tx.billingCycle.deleteMany({
        where: { purchaseOrderId: id },
      });
      await createBillingCycles(
        tx,
        id,
        validated.billingCycles?.map((bc) => billingCycleCreateData(bc)) ?? [],
      );
    });

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
