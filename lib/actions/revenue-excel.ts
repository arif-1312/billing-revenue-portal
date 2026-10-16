"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { persistRevenueImport } from "@/lib/revenue-import-save";
import { requirePermission } from "@/lib/rbac";
import {
  assessRevenueImport,
  buildRevenueImportContext,
  buildRevenueWorkbook,
  parseRevenueWorkbook,
  type AssessedRevenueImport,
  type RevenueExportPurchaseOrder,
  type RevenueImportCandidate,
  type RevenueImportContext,
  type RevenueImportPreviewRow,
  type RevenueImportRowError,
} from "@/lib/revenue-excel";
import { formatError } from "@/lib/utils";

const REVENUE_ROUTE = "/admin/revenue";
const MAX_FILE_BYTES = 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ImportDb = Prisma.TransactionClient | typeof prisma;

export type RevenueExportResult = {
  success: boolean;
  message?: string;
  fileName?: string;
  base64?: string;
  rowCount?: number;
};

export type RevenueImportResult = {
  success: boolean;
  message?: string;
  columnErrors: string[];
  errors: RevenueImportRowError[];
  rows: RevenueImportPreviewRow[];
  canCommit: boolean;
  importedCount?: number;
};

function emptyImportResult(
  message: string,
  partial?: Partial<RevenueImportResult>,
): RevenueImportResult {
  return {
    success: false,
    message,
    columnErrors: [],
    errors: [],
    rows: [],
    canCommit: false,
    ...partial,
  };
}

function displayName(
  companyName?: string | null,
  firstName?: string | null,
  lastName?: string | null,
) {
  const company = companyName?.trim();
  if (company) return company;

  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

class ImportRejected extends Error {
  assessed: AssessedRevenueImport;

  constructor(assessed: AssessedRevenueImport) {
    super("IMPORT_REJECTED");
    this.assessed = assessed;
  }
}

async function readUpload(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { error: "Choose an .xlsx file." };
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "Only .xlsx files can be imported." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { error: "Excel file must be 1 MB or smaller." };
  }

  return { buffer: Buffer.from(await file.arrayBuffer()) };
}

async function loadRevenueImportContext(
  db: ImportDb,
  candidates: RevenueImportCandidate[],
): Promise<RevenueImportContext> {
  const [purchaseOrders, billingCycles] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { customerPONumber: { not: null } },
      select: { id: true, customerPONumber: true },
    }),
    db.billingCycle.findMany({
      select: { id: true, purchaseOrderId: true, invoiceNumber: true },
    }),
  ]);

  return buildRevenueImportContext(
    purchaseOrders,
    billingCycles,
    candidates,
  );
}

function toImportResult(
  assessed: AssessedRevenueImport,
  message?: string,
): RevenueImportResult {
  return {
    success: true,
    message,
    columnErrors: assessed.columnErrors,
    errors: assessed.errors,
    rows: assessed.rows,
    canCommit: assessed.canCommit,
  };
}

async function assessUpload(buffer: Buffer, db: ImportDb = prisma) {
  const parsed = parseRevenueWorkbook(buffer);
  const assessed = assessRevenueImport(
    parsed,
    parsed.candidates.length
      ? await loadRevenueImportContext(db, parsed.candidates)
      : {
          purchaseOrdersByNumber: new Map(),
          existingInvoices: new Map(),
        },
  );

  return assessed;
}

export async function exportRevenueWorkbook(
  purchaseOrderIds: string[],
): Promise<RevenueExportResult> {
  try {
    const access = await requirePermission(REVENUE_ROUTE, "view");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const orderedIds: string[] = [];
    const seen = new Set<string>();

    for (const id of purchaseOrderIds) {
      if (!UUID_PATTERN.test(id) || seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
    }

    const purchaseOrders = orderedIds.length
      ? await prisma.purchaseOrder.findMany({
          where: { id: { in: orderedIds } },
          include: {
            customer: true,
            company: true,
            vendor: true,
            billingPlan: true,
            ServiceType: true,
            contractDuration: true,
            contract: true,
            billingCycles: true,
          },
        })
      : [];

    const byId = new Map(purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder]));
    const exportRows: RevenueExportPurchaseOrder[] = orderedIds.flatMap((id) => {
      const purchaseOrder = byId.get(id);
      if (!purchaseOrder) return [];

      return [
        {
          customerPONumber: purchaseOrder.customerPONumber,
          poAmount: purchaseOrder.poAmount,
          status: purchaseOrder.status,
          scope: purchaseOrder.scope,
          poOwner: purchaseOrder.poOwner,
          paymentTerms: purchaseOrder.paymentTerms,
          purchaseOrderType: purchaseOrder.purchaseOrderType,
          startFrom: purchaseOrder.startFrom,
          endDate: purchaseOrder.endDate,
          remark: purchaseOrder.remark,
          customerName: displayName(
            purchaseOrder.customer?.companyName,
            purchaseOrder.customer?.firstName,
            purchaseOrder.customer?.lastName,
          ),
          companyName: purchaseOrder.company?.name ?? "",
          vendorName: displayName(
            purchaseOrder.vendor?.companyName,
            purchaseOrder.vendor?.firstName,
            purchaseOrder.vendor?.lastName,
          ),
          billingPlanName: purchaseOrder.billingPlan?.name ?? "",
          serviceTypeName: purchaseOrder.ServiceType?.name ?? "",
          contractDurationName: purchaseOrder.contractDuration?.name ?? "",
          contractTypeName: purchaseOrder.contract?.name ?? "",
          billingCycles: purchaseOrder.billingCycles.map((cycle) => ({
            invoiceNumber: cycle.invoiceNumber,
            invoiceDate: cycle.invoiceDate,
            invoiceAmount: cycle.invoiceAmount,
            collectedAmount: cycle.collectedAmount,
            tds: Number(cycle.tds ?? 0),
            paymentReceived: cycle.paymentReceived,
            paymentReceivedDate: cycle.paymentReceivedDate,
            paymentDueDate: cycle.paymentDueDate,
            billingSubmittedDate: cycle.billingSubmittedDate,
            billingRemark: cycle.billingRemark,
          })),
        },
      ];
    });

    const workbook = buildRevenueWorkbook(exportRows);
    const today = new Date().toISOString().slice(0, 10);

    return {
      success: true,
      fileName: `revenue-${today}.xlsx`,
      base64: workbook.toString("base64"),
      rowCount: workbookRowCount(exportRows),
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

function workbookRowCount(purchaseOrders: RevenueExportPurchaseOrder[]) {
  return purchaseOrders.reduce((count, purchaseOrder) => {
    const cycles = purchaseOrder.billingCycles?.length ?? 0;
    return count + (cycles > 0 ? cycles : 1);
  }, 0);
}

export async function previewRevenueImport(
  formData: FormData,
): Promise<RevenueImportResult> {
  try {
    const access = await requirePermission(REVENUE_ROUTE, "create");
    if (!access.ok) {
      return emptyImportResult(access.message);
    }

    const upload = await readUpload(formData);
    if ("error" in upload && upload.error) {
      return emptyImportResult(upload.error);
    }
    if (!("buffer" in upload) || !upload.buffer) {
      return emptyImportResult("Choose an .xlsx file.");
    }

    return toImportResult(await assessUpload(upload.buffer));
  } catch (error) {
    return emptyImportResult(formatError(error));
  }
}

export async function commitRevenueImport(
  formData: FormData,
): Promise<RevenueImportResult> {
  try {
    const access = await requirePermission(REVENUE_ROUTE, "create");
    if (!access.ok) {
      return emptyImportResult(access.message);
    }

    const upload = await readUpload(formData);
    if ("error" in upload && upload.error) {
      return emptyImportResult(upload.error);
    }
    if (!("buffer" in upload) || !upload.buffer) {
      return emptyImportResult("Choose an .xlsx file.");
    }

    const buffer = upload.buffer;
    const importedCount = await prisma.$transaction(
      async (tx) => {
        const assessed = await assessUpload(buffer, tx);

        if (assessed.inserts.length === 0) {
          throw new ImportRejected(assessed);
        }

        const saved = await persistRevenueImport(tx, assessed);
        return { saved, skippedRows: assessed.errors.length };
      },
      { timeout: 60000 },
    );

    const { saved, skippedRows } = importedCount;

    revalidatePath("/admin/revenue");

    return {
      success: true,
      message: [
        saved.billingCyclesCreated
          ? `Imported ${saved.billingCyclesCreated} billing cycle${saved.billingCyclesCreated === 1 ? "" : "s"}`
          : "",
        saved.billingCyclesUpdated
          ? `updated ${saved.billingCyclesUpdated} billing cycle${saved.billingCyclesUpdated === 1 ? "" : "s"}`
          : "",
        saved.purchaseOrdersCreated
          ? `created ${saved.purchaseOrdersCreated} revenue record${saved.purchaseOrdersCreated === 1 ? "" : "s"}`
          : "",
        saved.purchaseOrdersUpdated
          ? `updated ${saved.purchaseOrdersUpdated} revenue record${saved.purchaseOrdersUpdated === 1 ? "" : "s"}`
          : "",
        skippedRows
          ? `skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} that could not be read`
          : "",
      ]
        .filter(Boolean)
        .join(", ")
        .replace(/^./, (letter) => letter.toUpperCase()) + ".",
      columnErrors: [],
      errors: [],
      rows: [],
      canCommit: false,
      importedCount:
        saved.billingCyclesCreated + saved.billingCyclesUpdated,
    };
  } catch (error) {
    if (error instanceof ImportRejected) {
      return {
        ...toImportResult(error.assessed),
        success: false,
        message: "Import was not saved because no rows could be read from the file.",
      };
    }

    return emptyImportResult(formatError(error));
  }
}
