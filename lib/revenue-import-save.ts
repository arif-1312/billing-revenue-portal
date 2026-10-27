import {
  PaymentReceived,
  POStatus,
  Prisma,
  PurchaseOrderType,
} from "@prisma/client";

import { toBusinessDateValue } from "@/lib/date-utils";
import { guardRevenueImportWrite } from "@/lib/financial-write";
import { moneyToNumber } from "@/lib/money";
import { canonicalCustomerName, normalizeCustomerKey } from "@/lib/customer-names";
import { canonicalCompanyName, normalizeCompanyKey } from "@/lib/company-names";
import {
  normalizeRevenueKey,
  type AssessedRevenueImport,
  type RevenuePurchaseOrderDraft,
} from "@/lib/revenue-excel";

type ImportDb = Prisma.TransactionClient;

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function planCycleCount(name: string) {
  const value = name.toLowerCase();
  if (value.includes("quarter")) return 4;
  if (value.includes("month")) return 12;
  if (
    value.includes("annual") ||
    value.includes("year") ||
    value.includes("one-time") ||
    value.includes("one time")
  ) {
    return 1;
  }
  return 0;
}

function durationMonths(name: string) {
  const match = name.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function nextCode(prefix: string, codes: string[]) {
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");

  for (const code of codes) {
    const match = pattern.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }

  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

async function resolveNamedId(
  names: string[],
  load: () => Promise<Array<{ id: string; name: string }>>,
  create: (name: string) => Promise<{ id: string }>,
) {
  const records = await load();
  const ids = new Map<string, string>();

  for (const record of records) {
    const key = normalizeRevenueKey(record.name);
    if (key && !ids.has(key)) ids.set(key, record.id);
  }

  for (const name of names) {
    const key = normalizeRevenueKey(name);
    if (!key || ids.has(key)) continue;
    const created = await create(name);
    ids.set(key, created.id);
  }

  return ids;
}

export async function persistRevenueImport(
  db: ImportDb,
  assessed: AssessedRevenueImport,
  options: { actorIsSystem: boolean } = { actorIsSystem: false },
) {
  for (const row of assessed.inserts) {
    if (!row.purchaseOrder) continue;
    if (row.purchaseOrder.customerName) {
      row.purchaseOrder.customerName = canonicalCustomerName(
        row.purchaseOrder.customerName,
      );
    }
    if (row.purchaseOrder.companyName) {
      row.purchaseOrder.companyName = canonicalCompanyName(
        row.purchaseOrder.companyName,
      );
    }
  }

  const drafts = new Map<string, RevenuePurchaseOrderDraft>();
  const purchaseOrderUpdates = new Map<string, RevenuePurchaseOrderDraft>();

  for (const row of assessed.inserts) {
    if (!row.purchaseOrder) continue;
    if (row.purchaseOrderId) {
      purchaseOrderUpdates.set(row.purchaseOrderId, row.purchaseOrder);
      continue;
    }
    drafts.set(
      normalizeRevenueKey(row.purchaseOrder.customerPONumber),
      row.purchaseOrder,
    );
  }

  const draftList = [...drafts.values(), ...purchaseOrderUpdates.values()];

  await guardRevenueImportWrite(
    db,
    assessed.inserts.map((row) => ({
      excelRow: row.excelRow,
      purchaseOrderId: row.purchaseOrderId,
      billingCycleId: row.billingCycleId,
      invoiceNumber: row.invoiceNumber,
      invoiceAmount: row.invoiceAmount,
      creditNote: row.creditNote,
      collectedAmount: row.collectedAmount,
    })),
    options.actorIsSystem,
  );

  const customerNames = draftList.map((draft) => draft.customerName);
  const companyNames = draftList.map((draft) => draft.companyName);
  const vendorNames = draftList.map((draft) => draft.vendorName);
  const planNames = draftList.map((draft) => draft.billingPlanName);
  const serviceNames = draftList.map((draft) => draft.serviceTypeName);
  const durationNames = draftList.map((draft) => draft.contractDurationName);
  const contractNames = draftList.map((draft) => draft.contractTypeName);

  const [customers, vendors] = await Promise.all([
    db.customer.findMany({
      select: { id: true, customerCode: true, companyName: true, firstName: true },
    }),
    db.vendor.findMany({
      select: { id: true, vendorCode: true, companyName: true, firstName: true },
    }),
  ]);

  const customerIds = new Map<string, string>();
  const customerCodes = customers.map((customer) => customer.customerCode);
  for (const customer of customers) {
    for (const name of [customer.companyName, customer.firstName]) {
      const canonical = canonicalCustomerName(name ?? "");
      const key = normalizeRevenueKey(canonical);
      if (!key) continue;
      const alreadyCanonical =
        normalizeCustomerKey(name ?? "") === normalizeCustomerKey(canonical);
      if (!customerIds.has(key) || alreadyCanonical) {
        customerIds.set(key, customer.id);
      }
    }
  }

  for (const name of customerNames) {
    const canonical = canonicalCustomerName(name);
    const key = normalizeRevenueKey(canonical);
    if (!key || customerIds.has(key)) continue;
    const code = nextCode("CUST", customerCodes);
    customerCodes.push(code);
    const created = await db.customer.create({
      data: {
        customerCode: code,
        firstName: canonical,
        companyName: canonical,
        phone: "-",
      },
    });
    customerIds.set(key, created.id);
  }

  const vendorIds = new Map<string, string>();
  const vendorCodes = vendors.map((vendor) => vendor.vendorCode);
  for (const vendor of vendors) {
    for (const name of [vendor.companyName, vendor.firstName]) {
      const key = normalizeRevenueKey(name ?? "");
      if (key && !vendorIds.has(key)) vendorIds.set(key, vendor.id);
    }
  }

  for (const name of vendorNames) {
    const key = normalizeRevenueKey(name);
    if (!key || vendorIds.has(key)) continue;
    const code = nextCode("VEND", vendorCodes);
    vendorCodes.push(code);
    const created = await db.vendor.create({
      data: {
        vendorCode: code,
        firstName: name,
        companyName: name,
        phone: "-",
      },
    });
    vendorIds.set(key, created.id);
  }

  const companyRecords = await db.company.findMany({
    select: { id: true, name: true },
  });
  const companyIds = new Map<string, string>();

  for (const company of companyRecords) {
    const canonical = canonicalCompanyName(company.name);
    const key = normalizeRevenueKey(canonical);
    if (!key) continue;
    const alreadyCanonical =
      normalizeCompanyKey(company.name) === normalizeCompanyKey(canonical);
    if (!companyIds.has(key) || alreadyCanonical) {
      companyIds.set(key, company.id);
    }
  }

  for (const name of companyNames) {
    const canonical = canonicalCompanyName(name);
    const key = normalizeRevenueKey(canonical);
    if (!key || companyIds.has(key)) continue;
    const created = await db.company.create({ data: { name: canonical } });
    companyIds.set(key, created.id);
  }

  const planIds = await resolveNamedId(
    planNames,
    async () =>
      (await db.billingPlan.findMany({ select: { id: true, name: true } })).map(
        (plan) => ({ id: plan.id, name: plan.name }),
      ),
    (name) =>
      db.billingPlan.create({
        data: { name, totalBillingCycles: planCycleCount(name) },
      }),
  );
  const serviceIds = await resolveNamedId(
    serviceNames,
    async () =>
      (await db.serviceType.findMany({ select: { id: true, name: true } })).map(
        (service) => ({ id: service.id, name: service.name }),
      ),
    (name) => db.serviceType.create({ data: { name } }),
  );
  const durationIds = await resolveNamedId(
    durationNames,
    async () =>
      (
        await db.contractDuration.findMany({ select: { id: true, name: true } })
      ).map((duration) => ({ id: duration.id, name: duration.name })),
    (name) =>
      db.contractDuration.create({
        data: { name, totalNumberOfMonths: durationMonths(name) },
      }),
  );
  const contractIds = await resolveNamedId(
    contractNames,
    async () =>
      (await db.contractType.findMany({ select: { id: true, name: true } })).map(
        (contract) => ({ id: contract.id, name: contract.name }),
      ),
    (name) => db.contractType.create({ data: { name } }),
  );

  const purchaseOrderIds = new Map<string, string>();

  for (const row of assessed.inserts) {
    if (!row.purchaseOrderId) continue;
    purchaseOrderIds.set(
      normalizeRevenueKey(row.purchaseOrder?.customerPONumber ?? ""),
      row.purchaseOrderId,
    );
  }

  function purchaseOrderData(draft: RevenuePurchaseOrderDraft) {
    return {
      customerPONumber: draft.customerPONumber,
      poAmount: draft.poAmount,
      status: draft.status as POStatus,
      scope: emptyToNull(draft.scope),
      poOwner: emptyToNull(draft.poOwner),
      paymentTerms: emptyToNull(draft.paymentTerms),
      ...(draft.purchaseOrderType
        ? { purchaseOrderType: draft.purchaseOrderType as PurchaseOrderType }
        : {}),
      startFrom: draft.startFrom ? toBusinessDateValue(draft.startFrom) : null,
      endDate: draft.endDate ? toBusinessDateValue(draft.endDate) : null,
      remark: emptyToNull(draft.remark),
      customerId: customerIds.get(normalizeRevenueKey(draft.customerName)) ?? null,
      companyId: companyIds.get(normalizeRevenueKey(draft.companyName)) ?? null,
      vendorId: vendorIds.get(normalizeRevenueKey(draft.vendorName)) ?? null,
      billingPlanId: planIds.get(normalizeRevenueKey(draft.billingPlanName)) ?? null,
      serviceTypeId:
        serviceIds.get(normalizeRevenueKey(draft.serviceTypeName)) ?? null,
      contractDurationId:
        durationIds.get(normalizeRevenueKey(draft.contractDurationName)) ?? null,
      contractId: contractIds.get(normalizeRevenueKey(draft.contractTypeName)) ?? null,
    };
  }

  const createdIds: string[] = [];

  for (const [key, draft] of drafts) {
    const created = await db.purchaseOrder.create({
      data: purchaseOrderData(draft),
    });
    purchaseOrderIds.set(key, created.id);
    createdIds.push(created.id);
  }

  for (const [id, draft] of purchaseOrderUpdates) {
    await db.purchaseOrder.update({
      where: { id },
      data: purchaseOrderData(draft),
    });
    purchaseOrderIds.set(normalizeRevenueKey(draft.customerPONumber), id);
  }

  for (const row of assessed.inserts) {
    const purchaseOrderId =
      row.purchaseOrderId ||
      purchaseOrderIds.get(normalizeRevenueKey(row.purchaseOrder?.customerPONumber ?? ""));

    if (!purchaseOrderId) {
      throw new Error(`Row ${row.excelRow} has no revenue record to update`);
    }

    const invoiceDate = row.invoiceDate
      ? toBusinessDateValue(row.invoiceDate)
      : null;
    const billingSubmittedDate = row.billingSubmittedDate
      ? toBusinessDateValue(row.billingSubmittedDate)
      : null;
    const paymentDueDate = row.paymentDueDate
      ? toBusinessDateValue(row.paymentDueDate)
      : null;
    const paymentReceivedDate = row.paymentReceivedDate
      ? toBusinessDateValue(row.paymentReceivedDate)
      : null;

    const cycleData = {
      purchaseOrderId,
      invoiceNumber: row.invoiceNumber.trim(),
      invoiceAmount: row.invoiceAmount,
      ...(row.creditNote != null
        ? { creditNote: new Prisma.Decimal(row.creditNote) }
        : {}),
      collectedAmount: row.collectedAmount,
      invoiceDate,
      billingSubmittedDate,
      paymentReceivedDate,
      paymentDueDate,
      paymentReceived: row.paymentReceived as PaymentReceived,
      billingRemark: row.billingRemark,
      tds: new Prisma.Decimal(row.tds),
    };

    const saved = row.billingCycleId
      ? await db.billingCycle.update({
          where: { id: row.billingCycleId },
          data: cycleData,
        })
      : await db.billingCycle.create({ data: cycleData });

    const preservedPayments = row.billingCycleId
      ? await db.billingCyclePayment.count({
          where: { billingCycleId: saved.id },
        })
      : 0;

    if (preservedPayments > 0) continue;

    await db.billingCyclePayment.deleteMany({
      where: { billingCycleId: saved.id },
    });

    const collected = moneyToNumber(row.collectedAmount);
    if (paymentReceivedDate && collected !== 0) {
      await db.billingCyclePayment.create({
        data: {
          billingCycleId: saved.id,
          receivedDate: paymentReceivedDate,
          amount: collected,
        },
      });
    }
  }

  const affectedPurchaseOrderIds = [
    ...new Set([
      ...createdIds,
      ...purchaseOrderUpdates.keys(),
      ...assessed.inserts.flatMap((row) =>
        row.purchaseOrderId ? [row.purchaseOrderId] : [],
      ),
    ]),
  ];

  return {
    billingCyclesCreated: assessed.inserts.filter((row) => !row.billingCycleId).length,
    billingCyclesUpdated: assessed.inserts.filter((row) => row.billingCycleId).length,
    purchaseOrdersCreated: drafts.size,
    purchaseOrdersUpdated: purchaseOrderUpdates.size,
    affectedPurchaseOrderIds,
  };
}
