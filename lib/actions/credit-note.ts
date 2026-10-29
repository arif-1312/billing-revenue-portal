"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { consumeActionRateLimit } from "@/lib/action-rate-limit";
import {
  buildCreditNoteWorkbook,
  creditNoteKey,
  parseCreditNoteWorkbook,
  type CreditNoteImportError,
} from "@/lib/credit-note-excel";
import { formatKolkataDate, parseKolkataDate } from "@/lib/fiscal-year";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { formatError } from "@/lib/utils";
import { creditNoteSchema } from "@/lib/validators";

const ROUTE = "/admin/credit-note";
const MAX_FILE_BYTES = 1024 * 1024;

export type CreditNoteRecord = {
  id: string;
  particulars: string;
  date: string;
  vchType: string;
  vchNo: string;
  amount: number;
};

function revalidateCreditNotes() {
  revalidatePath(ROUTE);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/home");
}

function toRecord(note: {
  id: string;
  particulars: string;
  date: Date;
  vchType: string;
  vchNo: string;
  amount: Prisma.Decimal | number | string;
}): CreditNoteRecord {
  return {
    id: note.id,
    particulars: note.particulars,
    date: formatKolkataDate(note.date),
    vchType: note.vchType,
    vchNo: note.vchNo,
    amount: Number(note.amount),
  };
}

async function withinActionLimit(scope: string) {
  const session = await auth();
  const actor = session?.user?.id || session?.user?.email || "anonymous";
  return consumeActionRateLimit(`${scope}:${actor}`, 30, 60_000);
}

export async function getCreditNotes() {
  const access = await requirePermission(ROUTE, "view");
  if (!access.ok) return [];

  const notes = await prisma.creditNote.findMany({
    orderBy: [{ date: "desc" }, { vchNo: "asc" }],
  });

  return notes.map(toRecord);
}

export async function getCreditNoteById(id: string) {
  try {
    const access = await requirePermission(ROUTE, "view", [
      { route: ROUTE, action: "edit" },
    ]);
    if (!access.ok) return { success: false, message: access.message };

    const note = await prisma.creditNote.findFirst({ where: { id } });
    if (!note) return { success: false, message: "Credit note not found" };

    return {
      success: true,
      data: toRecord(note),
      message: "Credit note fetched successfully",
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function createCreditNote(data: unknown) {
  try {
    const access = await requirePermission(ROUTE, "create");
    if (!access.ok) return { success: false, message: access.message };

    const note = creditNoteSchema.parse(data);
    await prisma.creditNote.create({
      data: {
        particulars: note.particulars,
        date: parseKolkataDate(note.date),
        vchType: note.vchType,
        vchNo: note.vchNo,
        amount: new Prisma.Decimal(note.amount.toFixed(2)),
      },
    });

    revalidateCreditNotes();
    return { success: true, message: "Credit note created successfully" };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function updateCreditNote(data: unknown, id: string) {
  try {
    const access = await requirePermission(ROUTE, "edit");
    if (!access.ok) return { success: false, message: access.message };

    const note = creditNoteSchema.parse(data);
    await prisma.creditNote.update({
      where: { id },
      data: {
        particulars: note.particulars,
        date: parseKolkataDate(note.date),
        vchType: note.vchType,
        vchNo: note.vchNo,
        amount: new Prisma.Decimal(note.amount.toFixed(2)),
      },
    });

    revalidateCreditNotes();
    return { success: true, message: "Credit note updated successfully" };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function deleteCreditNote(id: string) {
  try {
    const access = await requirePermission(ROUTE, "delete");
    if (!access.ok) return { success: false, message: access.message };

    await prisma.creditNote.delete({ where: { id } });
    revalidateCreditNotes();
    return { success: true, message: "Credit note deleted successfully" };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export type CreditNoteExportResult = {
  success: boolean;
  message?: string;
  fileName?: string;
  base64?: string;
  rowCount?: number;
};

export async function exportCreditNoteWorkbook(): Promise<CreditNoteExportResult> {
  try {
    const access = await requirePermission(ROUTE, "view");
    if (!access.ok) return { success: false, message: access.message };
    if (!(await withinActionLimit("credit-note-export"))) {
      return { success: false, message: "Too many requests. Try again shortly." };
    }

    const notes = await getCreditNotes();
    const workbook = await buildCreditNoteWorkbook(notes);
    return {
      success: true,
      fileName: notes.length > 0 ? "credit-notes.xlsx" : "credit-notes-template.xlsx",
      base64: workbook.toString("base64"),
      rowCount: notes.length,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export type CreditNoteImportResult = {
  success: boolean;
  message?: string;
  errors: CreditNoteImportError[];
  importedCount?: number;
  updatedCount?: number;
};

export async function importCreditNoteWorkbook(
  formData: FormData,
): Promise<CreditNoteImportResult> {
  try {
    const access = await requirePermission(ROUTE, "create");
    if (!access.ok) return { success: false, message: access.message, errors: [] };
    if (!(await withinActionLimit("credit-note-import"))) {
      return { success: false, message: "Too many requests. Try again shortly.", errors: [] };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, message: "Choose an .xlsx file.", errors: [] };
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return { success: false, message: "Only .xlsx files can be imported.", errors: [] };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { success: false, message: "Excel file must be 1 MB or smaller.", errors: [] };
    }

    const parsed = await parseCreditNoteWorkbook(Buffer.from(await file.arrayBuffer()));
    if (parsed.error) {
      return { success: false, message: parsed.error, errors: [] };
    }
    if (parsed.errors.length > 0) {
      return {
        success: false,
        message: "Fix the rows below, then import the file again.",
        errors: parsed.errors,
      };
    }

    let importedCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.creditNote.findMany({
        select: { id: true, date: true, vchType: true, vchNo: true },
      });
      const byKey = new Map<string, string>();
      for (const note of existing) {
        byKey.set(
          creditNoteKey(note.vchType, note.vchNo, formatKolkataDate(note.date)),
          note.id,
        );
      }

      for (const row of parsed.rows) {
        const data = {
          particulars: row.particulars,
          date: parseKolkataDate(row.date),
          vchType: row.vchType,
          vchNo: row.vchNo,
          amount: new Prisma.Decimal(row.amount.toFixed(2)),
        };
        const id = byKey.get(creditNoteKey(row.vchType, row.vchNo, row.date));
        if (id) {
          await tx.creditNote.update({ where: { id }, data });
          updatedCount += 1;
        } else {
          const created = await tx.creditNote.create({ data });
          byKey.set(creditNoteKey(row.vchType, row.vchNo, row.date), created.id);
          importedCount += 1;
        }
      }
    });

    revalidateCreditNotes();
    return {
      success: true,
      message: `Imported ${importedCount} credit note${importedCount === 1 ? "" : "s"} and updated ${updatedCount}.`,
      errors: [],
      importedCount,
      updatedCount,
    };
  } catch (error) {
    return { success: false, message: formatError(error), errors: [] };
  }
}
