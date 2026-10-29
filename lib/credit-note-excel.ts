import ExcelJS from "exceljs";

import { formatKolkataDate, parseKolkataDate } from "@/lib/fiscal-year";
import { MONEY_MAX } from "@/lib/validators";

const MAX_IMPORT_ROWS = 2000;
const HEADER_SCAN_ROWS = 20;
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

export const CREDIT_NOTE_HEADERS = [
  "Particulars",
  "Date",
  "Vch Type",
  "Vch No.",
  "Amount",
] as const;

const HEADER_ALIASES: Record<string, (typeof CREDIT_NOTE_HEADERS)[number]> = {
  particulars: "Particulars",
  particular: "Particulars",
  date: "Date",
  "vch date": "Date",
  "voucher date": "Date",
  "vch type": "Vch Type",
  vchtype: "Vch Type",
  "voucher type": "Vch Type",
  "vch no": "Vch No.",
  "vch no.": "Vch No.",
  vchno: "Vch No.",
  "voucher no": "Vch No.",
  "voucher no.": "Vch No.",
  "voucher number": "Vch No.",
  "vch number": "Vch No.",
  amount: "Amount",
  amt: "Amount",
  "credit amount": "Amount",
};

export type CreditNoteImportRow = {
  excelRow: number;
  particulars: string;
  date: string;
  vchType: string;
  vchNo: string;
  amount: number;
};

export type CreditNoteImportError = {
  row: number;
  message: string;
};

export type CreditNoteWorkbookRow = {
  particulars: string;
  date: string;
  vchType: string;
  vchNo: string;
  amount: number;
};

export function creditNoteKey(vchType: string, vchNo: string, date: string) {
  return `${vchType.trim().toLowerCase()}|${vchNo.trim().toLowerCase()}|${date}`;
}

function headerKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function cellText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return formatKolkataDate(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((part) => cellText(part)).join("").trim();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => cellText(part)).join("").trim();
    }
    if ("text" in value) return cellText(value.text);
    if ("result" in value) return cellText(value.result);
  }
  return "";
}

function isRealDate(year: number, month: number, day: number) {
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = formatKolkataDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    const year = utc.getUTCFullYear();
    const month = utc.getUTCMonth() + 1;
    const day = utc.getUTCDate();
    return isRealDate(year, month, day) ? toIsoDate(year, month, day) : null;
  }

  const text = cellText(value);
  if (!text) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isRealDate(year, month, day) ? toIsoDate(year, month, day) : null;
  }

  const localMatch = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(text);
  if (localMatch) {
    const day = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const year = Number(localMatch[3]);
    return isRealDate(year, month, day) ? toIsoDate(year, month, day) : null;
  }

  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const cleaned = cellText(value).replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
}

function readCell(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date || typeof value !== "object") return value;
  if ("result" in value && value.result !== undefined) {
    return readCell(value.result as ExcelJS.CellValue);
  }
  if ("richText" in value) return cellText(value.richText);
  if ("text" in value) return cellText(value.text);
  return null;
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function safeText(value: string) {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function parseCreditNoteWorkbook(buffer: Buffer) {
  return readCreditNoteWorkbook(buffer);
}

async function readCreditNoteWorkbook(buffer: Buffer): Promise<{
  rows: CreditNoteImportRow[];
  errors: CreditNoteImportError[];
  error?: string;
}> {
  if (!buffer.length) {
    return { rows: [], errors: [], error: "The Excel file is empty." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return { rows: [], errors: [], error: "Choose a valid .xlsx Excel file." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: [], error: "The workbook has no sheets." };
  }

  let headerRowNumber = 0;
  const columns = new Map<(typeof CREDIT_NOTE_HEADERS)[number], number>();

  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, HEADER_SCAN_ROWS); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const found = new Map<(typeof CREDIT_NOTE_HEADERS)[number], number>();

    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = HEADER_ALIASES[headerKey(cellText(readCell(cell.value)))];
      if (header && !found.has(header)) found.set(header, columnNumber);
    });

    if (found.size >= 3) {
      headerRowNumber = rowNumber;
      found.forEach((column, header) => columns.set(header, column));
      break;
    }
  }

  const missing = CREDIT_NOTE_HEADERS.filter((header) => !columns.has(header));
  if (!headerRowNumber || missing.length > 0) {
    return {
      rows: [],
      errors: [],
      error: "The sheet needs columns Particulars, Date, Vch Type, Vch No., and Amount.",
    };
  }

  const rows: CreditNoteImportRow[] = [];
  const errors: CreditNoteImportError[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const read = (header: (typeof CREDIT_NOTE_HEADERS)[number]) =>
      readCell(row.getCell(columns.get(header) ?? 1).value);

    const particulars = cellText(read("Particulars"));
    const dateValue = read("Date");
    const vchType = cellText(read("Vch Type"));
    const vchNo = cellText(read("Vch No."));
    const amountValue = read("Amount");
    const blank = !particulars && !cellText(dateValue) && !vchType && !vchNo && !cellText(amountValue);
    if (blank) continue;

    dataRows += 1;
    if (dataRows > MAX_IMPORT_ROWS) {
      return {
        rows: [],
        errors: [],
        error: `The workbook has more than ${MAX_IMPORT_ROWS} credit notes.`,
      };
    }

    const messages: string[] = [];
    if (!particulars) messages.push("Particulars is required.");
    if (particulars.length > 300) messages.push("Particulars is too long.");
    if (!vchType) messages.push("Vch Type is required.");
    if (vchType.length > 80) messages.push("Vch Type is too long.");
    if (!vchNo) messages.push("Vch No. is required.");
    if (vchNo.length > 80) messages.push("Vch No. is too long.");

    const date = parseDate(dateValue);
    if (!date) messages.push("Date must be a real date.");

    const amount = parseAmount(amountValue);
    if (amount == null) messages.push("Amount must be a number.");
    else if (amount <= 0) messages.push("Amount must be greater than 0.");
    else if (amount > MONEY_MAX) messages.push("Amount is too large.");

    if (messages.length > 0 || !date || amount == null) {
      errors.push({ row: rowNumber, message: messages.join(" ") });
      continue;
    }

    try {
      if (formatKolkataDate(parseKolkataDate(date)) !== date) {
        errors.push({ row: rowNumber, message: "Date must be a real date." });
        continue;
      }
    } catch {
      errors.push({ row: rowNumber, message: "Date must be a real date." });
      continue;
    }

    const key = creditNoteKey(vchType, vchNo, date);
    const previous = seen.get(key);
    if (previous) {
      errors.push({
        row: rowNumber,
        message: `Vch No. ${vchNo} on ${date} is repeated on row ${previous}.`,
      });
      continue;
    }
    seen.set(key, rowNumber);

    rows.push({
      excelRow: rowNumber,
      particulars,
      date,
      vchType,
      vchNo,
      amount,
    });
  }

  if (dataRows === 0) {
    return { rows: [], errors: [], error: "The sheet has no credit note rows." };
  }

  return { rows, errors };
}

export async function buildCreditNoteWorkbook(rows: CreditNoteWorkbookRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Credit Notes");
  sheet.addRow([...CREDIT_NOTE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [
    { width: 36 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
  ];

  for (const row of rows) {
    sheet.addRow([
      safeText(row.particulars),
      row.date,
      safeText(row.vchType),
      safeText(row.vchNo),
      row.amount,
    ]);
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const contents = await workbook.xlsx.writeBuffer();
  return Buffer.from(contents);
}
