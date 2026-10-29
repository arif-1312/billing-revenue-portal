import ExcelJS from "exceljs";

import { formatStoredDate } from "@/lib/date-utils";
import { isAllowedMoneyAmount } from "@/lib/validators";

const MAX_IMPORT_ROWS = 1000;
const MAX_SHEETS_TO_SCAN = 12;
const MAX_COLUMNS_TO_READ = 80;
const HEADER_SCAN_ROWS = 40;
const MIN_DATE_YEAR = 1990;
const MAX_DATE_YEAR = 2100;

type ColumnKind = "text" | "number" | "date" | "payment" | "export";

type RevenueColumn = {
  header: string;
  key: string;
  required: boolean;
  kind: ColumnKind;
  aliases?: string[];
};

export const REVENUE_EXCEL_COLUMNS: RevenueColumn[] = [
  { header: "Invoice Number", key: "invoiceNumber", required: false, kind: "text" },
  {
    header: "Customer PO Number",
    key: "customerPONumber",
    required: false,
    kind: "text",
    aliases: ["PO Number"],
  },
  {
    header: "Customer",
    key: "customerName",
    required: false,
    kind: "text",
    aliases: ["Customer Name"],
  },
  { header: "Company", key: "companyName", required: false, kind: "text" },
  { header: "Vendor", key: "vendorName", required: false, kind: "text" },
  { header: "Invoice Date", key: "invoiceDate", required: false, kind: "date" },
  { header: "Invoice Amount", key: "invoiceAmount", required: false, kind: "number" },
  {
    header: "Credit Note Amount",
    key: "creditNote",
    required: false,
    kind: "number",
    aliases: ["Credit Note"],
  },
  { header: "Collected Amount", key: "collectedAmount", required: false, kind: "number" },
  { header: "TDS", key: "tds", required: false, kind: "number" },
  {
    header: "Payment Received",
    key: "paymentReceived",
    required: false,
    kind: "payment",
    aliases: ["Payment Status"],
  },
  { header: "Payment Received Date", key: "paymentReceivedDate", required: false, kind: "date" },
  { header: "Payment Due Date", key: "paymentDueDate", required: false, kind: "date" },
  { header: "Billing Submitted Date", key: "billingSubmittedDate", required: false, kind: "date" },
  { header: "Billing Remark", key: "billingRemark", required: false, kind: "text" },
  { header: "PO Amount", key: "poAmount", required: false, kind: "number" },
  { header: "PO Status", key: "poStatus", required: false, kind: "text" },
  { header: "Scope Of Work", key: "scope", required: false, kind: "text" },
  { header: "Billing Plan", key: "billingPlanName", required: false, kind: "text" },
  { header: "Service Type", key: "serviceTypeName", required: false, kind: "text" },
  { header: "Contract Duration", key: "contractDurationName", required: false, kind: "text" },
  { header: "Contract Type", key: "contractTypeName", required: false, kind: "text" },
  { header: "PO Owner", key: "poOwner", required: false, kind: "text" },
  { header: "Payment Terms", key: "paymentTerms", required: false, kind: "text" },
  { header: "Purchase Order Type", key: "purchaseOrderType", required: false, kind: "text" },
  { header: "Start Date", key: "startFrom", required: false, kind: "date" },
  { header: "End Date", key: "endDate", required: false, kind: "date" },
  {
    header: "Remark",
    key: "remark",
    required: false,
    kind: "text",
    aliases: ["Remarks"],
  },
];

// Recognized on import only. Kept out of the export template.
const EXTRA_IMPORT_COLUMNS: RevenueColumn[] = [
  {
    header: "Invoice Value (With Tax)",
    key: "invoiceValueWithTax",
    required: false,
    kind: "number",
    aliases: ["Invoice Value With Tax"],
  },
];

const HEADER_COLUMNS = [...REVENUE_EXCEL_COLUMNS, ...EXTRA_IMPORT_COLUMNS];

const IMPORT_KEYS = [
  "invoiceNumber",
  "customerPONumber",
  "customerName",
  "companyName",
  "vendorName",
  "invoiceDate",
  "invoiceAmount",
  "creditNote",
  "collectedAmount",
  "tds",
  "paymentReceived",
  "paymentReceivedDate",
  "paymentDueDate",
  "billingSubmittedDate",
  "billingRemark",
  "poAmount",
  "poStatus",
  "scope",
  "billingPlanName",
  "serviceTypeName",
  "contractDurationName",
  "contractTypeName",
  "poOwner",
  "paymentTerms",
  "purchaseOrderType",
  "startFrom",
  "endDate",
  "remark",
] as const;

export type RevenueImportField = (typeof IMPORT_KEYS)[number];

export type RevenueImportCandidate = {
  excelRow: number;
} & Record<RevenueImportField, unknown>;

export type RevenueImportRowError = {
  row: number;
  messages: string[];
};

export type RevenueImportPreviewRow = {
  excelRow: number;
  invoiceNumber: string;
  customerPONumber: string;
  customerName: string;
  invoiceDate: string;
  invoiceAmount: number;
  creditNote: number;
  collectedAmount: number;
  tds: number;
  paymentReceived: "YES" | "NO";
  paymentReceivedDate: string;
  paymentDueDate: string;
  billingSubmittedDate: string;
  billingRemark: string;
};

export type RevenuePurchaseOrderDraft = {
  customerPONumber: string;
  customerName: string;
  companyName: string;
  vendorName: string;
  poAmount: number | null;
  status: "LIVE" | "CLOSED";
  scope: string;
  billingPlanName: string;
  serviceTypeName: string;
  contractDurationName: string;
  contractTypeName: string;
  poOwner: string;
  paymentTerms: string;
  purchaseOrderType: "MAIL" | "AGREEMENT" | "NORMAL" | null;
  startFrom: string | null;
  endDate: string | null;
  remark: string;
};

export type RevenueImportInsert = {
  excelRow: number;
  purchaseOrderId: string;
  purchaseOrder: RevenuePurchaseOrderDraft | null;
  billingCycleId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  creditNote: number | null;
  collectedAmount: number;
  tds: number;
  paymentReceived: "YES" | "NO";
  paymentReceivedDate: string | null;
  paymentDueDate: string;
  billingSubmittedDate: string;
  billingRemark: string;
};

export type RevenueExistingInvoice = {
  id: string;
  purchaseOrderId: string;
};

export type RevenueImportContext = {
  purchaseOrdersByNumber: Map<string, string[]>;
  existingInvoices: Map<string, RevenueExistingInvoice[]>;
};

export type RevenueExportCycle = {
  invoiceNumber?: string | null;
  invoiceDate?: Date | string | null;
  invoiceAmount?: unknown;
  creditNote?: unknown;
  collectedAmount?: unknown;
  tds?: number | string | null;
  paymentReceived?: string | null;
  paymentReceivedDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  billingSubmittedDate?: Date | string | null;
  billingRemark?: string | null;
};

export type RevenueExportPurchaseOrder = {
  customerPONumber?: string | null;
  poAmount?: unknown;
  status?: string | null;
  scope?: string | null;
  poOwner?: string | null;
  paymentTerms?: string | null;
  purchaseOrderType?: string | null;
  startFrom?: Date | string | null;
  endDate?: Date | string | null;
  remark?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  vendorName?: string | null;
  billingPlanName?: string | null;
  serviceTypeName?: string | null;
  contractDurationName?: string | null;
  contractTypeName?: string | null;
  billingCycles?: RevenueExportCycle[] | null;
};

export type ParsedRevenueWorkbook = {
  columnErrors: string[];
  candidates: RevenueImportCandidate[];
};

export type AssessedRevenueImport = {
  columnErrors: string[];
  errors: RevenueImportRowError[];
  rows: RevenueImportPreviewRow[];
  inserts: RevenueImportInsert[];
  canCommit: boolean;
};

function normalizeHeader(value: string) {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\*+/g, "")
    .replace(/\s*\(\s*/g, " (")
    .replace(/\s*\)\s*/g, ") ")
    .replace(/[:：]+\s*$/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeRevenueKey(value: string) {
  return value.trim().toLowerCase();
}

function compactHeader(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9]/g, "");
}

function columnNames(column: RevenueColumn) {
  return [column.header, ...(column.aliases ?? [])];
}

function columnByHeader(header: string) {
  const normalized = normalizeHeader(header);
  const compact = compactHeader(header);
  if (!compact) return undefined;

  const invoiceAmount = HEADER_COLUMNS.find((column) => column.key === "invoiceAmount");
  const invoiceWithTax = HEADER_COLUMNS.find(
    (column) => column.key === "invoiceValueWithTax",
  );

  if (
    invoiceWithTax &&
    /withtax|includingtax|inclusiveoftax/.test(compact) &&
    !/withouttax|excludingtax|extax|beforetax/.test(compact)
  ) {
    return invoiceWithTax;
  }

  if (
    invoiceAmount &&
    /withouttax|excludingtax|extax|beforetax|taxablevalue/.test(compact)
  ) {
    return invoiceAmount;
  }

  for (const column of HEADER_COLUMNS) {
    for (const name of columnNames(column)) {
      if (normalizeHeader(name) === normalized || compactHeader(name) === compact) {
        return column;
      }
    }
  }

  const contained = HEADER_COLUMNS.filter((column) =>
    columnNames(column).some((name) => {
      const nameCompact = compactHeader(name);
      if (nameCompact.length < 6 || compact.length < 6) return false;
      return compact.includes(nameCompact) || nameCompact.includes(compact);
    }),
  );

  if (contained.length === 1) return contained[0];
  return undefined;
}

export function revenueCellText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return "";
}

function isEmptyCell(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return revenueCellText(value) === "";
}

function isBlankRow(row: unknown[]) {
  return row.every((cell) => isEmptyCell(cell));
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isRealCalendarDate(year: number, month: number, day: number) {
  if (year < MIN_DATE_YEAR || year > MAX_DATE_YEAR) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatImportDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function exportDate(value?: Date | string | null) {
  if (!value) return "";
  const formatted = formatStoredDate(value);
  return formatted === "-" ? "" : formatted;
}

function exportAmount(value: unknown, includeZero: boolean) {
  if (value == null || value === "") return includeZero ? 0 : "";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : "";
}

type ParsedDate = string | null | "invalid";
type ParsedAmount = number | null | "invalid";

function parseExcelDate(value: unknown): ParsedDate {
  if (isEmptyCell(value)) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "invalid";
    const year = value.getFullYear();
    const month = value.getMonth() + 1;
    const day = value.getDate();
    return isRealCalendarDate(year, month, day)
      ? toIsoDate(year, month, day)
      : "invalid";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    const year = utc.getUTCFullYear();
    const month = utc.getUTCMonth() + 1;
    const day = utc.getUTCDate();
    return isRealCalendarDate(year, month, day)
      ? toIsoDate(year, month, day)
      : "invalid";
  }

  const text = revenueCellText(value);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return isRealCalendarDate(year, month, day)
      ? toIsoDate(year, month, day)
      : "invalid";
  }

  const localMatch = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(text);
  if (localMatch) {
    const day = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const year = Number(localMatch[3]);
    return isRealCalendarDate(year, month, day)
      ? toIsoDate(year, month, day)
      : "invalid";
  }

  return "invalid";
}

function parseExcelAmount(value: unknown): ParsedAmount {
  if (isEmptyCell(value)) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "invalid";
  }

  const cleaned = revenueCellText(value).replace(/[₹,\s]/g, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return "invalid";

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : "invalid";
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cellText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((part) => cellText(part)).join("");
  if (typeof value === "object" && "text" in value) {
    return cellText((value as { text?: unknown }).text);
  }
  return "";
}

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null;
  if (value instanceof Date || typeof value !== "object") return value;

  if ("result" in value && value.result !== undefined) {
    return cellValue(value.result as ExcelJS.CellValue);
  }

  if ("richText" in value) {
    return cellText(value.richText);
  }

  if ("text" in value) {
    return cellText(value.text);
  }

  return value;
}

type PositionedRow = {
  excelRow: number;
  cells: unknown[];
};

const HEADER_MISSING =
  "No revenue column headers were found. The header row needs names such as Invoice Number, Customer PO Number, Customer, and Invoice Amount.";

function sheetRowCells(row: ExcelJS.Row) {
  const cells: unknown[] = [];
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber > MAX_COLUMNS_TO_READ) return;
    cells[colNumber - 1] = cellValue(cell.value);
  });
  return cells;
}

function readSheetRows(sheet: ExcelJS.Worksheet) {
  const rows: PositionedRow[] = [];
  let exceeded = false;

  sheet.eachRow((row) => {
    if (rows.length >= MAX_IMPORT_ROWS + HEADER_SCAN_ROWS) {
      exceeded = true;
      return;
    }
    rows.push({ excelRow: row.number, cells: sheetRowCells(row) });
  });

  return { rows, exceeded };
}

function headerMatchCount(rows: PositionedRow[]) {
  let best = 0;
  for (const row of rows.slice(0, HEADER_SCAN_ROWS)) {
    best = Math.max(best, indexesForHeader(row.cells).size);
  }
  return best;
}

async function readBestRevenueSheet(buffer: Buffer): Promise<{
  rows: PositionedRow[];
  error: string | null;
}> {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 4 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b
  ) {
    return { rows: [], error: "Choose a .xlsx Excel file." };
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheets = workbook.worksheets.slice(0, MAX_SHEETS_TO_SCAN);

    if (sheets.length === 0) {
      return { rows: [], error: "The workbook has no sheets." };
    }

    let best: { rows: PositionedRow[]; score: number; exceeded: boolean } | null =
      null;

    for (const sheet of sheets) {
      const read = readSheetRows(sheet);
      const score = headerMatchCount(read.rows);
      const richer =
        !best ||
        score > best.score ||
        (score === best.score && read.rows.length > best.rows.length);
      if (richer) {
        best = { rows: read.rows, score, exceeded: read.exceeded };
      }
    }

    if (!best || best.rows.length === 0) {
      return { rows: [], error: "The workbook has no data rows." };
    }

    if (best.exceeded) {
      return {
        rows: [],
        error: `The workbook has more than ${MAX_IMPORT_ROWS} data rows.`,
      };
    }

    return { rows: best.rows, error: null };
  } catch {
    return { rows: [], error: "Could not read the Excel file." };
  }
}

export async function readRevenueWorkbookMatrix(buffer: Buffer) {
  const read = await readBestRevenueSheet(buffer);
  if (read.error) {
    return { matrix: [] as unknown[][], error: read.error };
  }

  const matrix: unknown[][] = [];
  for (const row of read.rows) {
    if (row.excelRow > MAX_IMPORT_ROWS + HEADER_SCAN_ROWS) continue;
    matrix[row.excelRow - 1] = row.cells;
  }

  return { matrix, error: null };
}

function parsePositionedRows(rows: PositionedRow[]): ParsedRevenueWorkbook {
  const located = locateRevenueHeader(rows);

  if (located.columnErrors.length > 0) {
    return { columnErrors: located.columnErrors, candidates: [] };
  }

  const candidates: RevenueImportCandidate[] = [];
  const taxIndex = located.indexes.get("invoiceValueWithTax");
  const headerCells =
    rows.find((row) => row.excelRow === located.headerRow)?.cells ?? [];
  const withoutTaxIndex = withoutTaxColumn(headerCells);

  for (const row of rows) {
    if (row.excelRow <= located.headerRow) continue;
    if (isBlankRow(row.cells)) continue;

    const candidate = { excelRow: row.excelRow } as RevenueImportCandidate;

    for (const key of IMPORT_KEYS) {
      const columnIndex = located.indexes.get(key);
      candidate[key] =
        columnIndex == null ? null : (row.cells[columnIndex] ?? null);
    }

    if (withoutTaxIndex != null && isEmptyCell(candidate.invoiceAmount)) {
      candidate.invoiceAmount = row.cells[withoutTaxIndex] ?? null;
    }

    if (taxIndex != null && isEmptyCell(candidate.invoiceAmount)) {
      candidate.invoiceAmount = row.cells[taxIndex] ?? null;
    }

    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return {
      columnErrors: ["The workbook has no data rows."],
      candidates: [],
    };
  }

  if (candidates.length > MAX_IMPORT_ROWS) {
    return {
      columnErrors: [
        `The workbook has more than ${MAX_IMPORT_ROWS} data rows.`,
      ],
      candidates: [],
    };
  }

  return { columnErrors: [], candidates };
}

export function parseRevenueMatrix(matrix: unknown[][]): ParsedRevenueWorkbook {
  const rows: PositionedRow[] = [];
  matrix.forEach((row, index) => {
    rows.push({
      excelRow: index + 1,
      cells: Array.isArray(row) ? row : [],
    });
  });
  return parsePositionedRows(rows);
}

function locateRevenueHeader(rows: PositionedRow[]) {
  let indexes = new Map<string, number>();
  let headerRow = 0;

  for (const row of rows.slice(0, HEADER_SCAN_ROWS)) {
    const found = indexesForHeader(row.cells);
    if (found.size > indexes.size) {
      indexes = found;
      headerRow = row.excelRow;
    }
  }

  if (indexes.size === 0) {
    const header = rows[0];
    if (!header) {
      return {
        columnErrors: [HEADER_MISSING],
        indexes,
        headerRow: 0,
      };
    }

    HEADER_COLUMNS.forEach((column, index) => {
      if (column.key === "invoiceValueWithTax") return;
      if (index >= header.cells.length) return;
      if (!indexes.has(column.key)) indexes.set(column.key, index);
    });
    headerRow = header.excelRow;
  }

  if (indexes.size === 0) {
    return {
      columnErrors: [HEADER_MISSING],
      indexes,
      headerRow: 0,
    };
  }

  return { columnErrors: [] as string[], indexes, headerRow };
}

function withoutTaxColumn(headerRow: unknown[]) {
  let found: number | null = null;

  headerRow.forEach((cell, index) => {
    const compact = compactHeader(revenueCellText(cell));
    if (/withouttax|excludingtax|extax|beforetax|taxablevalue/.test(compact)) {
      found = index;
    }
  });

  return found;
}

function indexesForHeader(headerRow: unknown[]) {
  const indexes = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const header = revenueCellText(cell);
    if (!header) return;

    const column = columnByHeader(header);
    if (!column || indexes.has(column.key)) return;

    indexes.set(column.key, index);
  });

  return indexes;
}

export async function parseRevenueWorkbook(buffer: Buffer): Promise<ParsedRevenueWorkbook & {
  fileError?: string;
}> {
  const read = await readBestRevenueSheet(buffer);
  if (read.error) {
    return { columnErrors: [read.error], candidates: [], fileError: read.error };
  }

  return parsePositionedRows(read.rows);
}

export function buildRevenueImportContext(
  purchaseOrders: { id: string; customerPONumber?: string | null }[],
  billingCycles: {
    id: string;
    purchaseOrderId: string;
    invoiceNumber?: string | null;
  }[],
  candidates: RevenueImportCandidate[],
): RevenueImportContext {
  const wantedPurchaseOrders = new Set(
    candidates
      .map((candidate) =>
        normalizeRevenueKey(revenueCellText(candidate.customerPONumber)),
      )
      .filter(Boolean),
  );
  const wantedInvoices = new Set(
    candidates
      .map((candidate) =>
        normalizeRevenueKey(revenueCellText(candidate.invoiceNumber)),
      )
      .filter(Boolean),
  );
  const purchaseOrdersByNumber = new Map<string, string[]>();

  for (const purchaseOrder of purchaseOrders) {
    const key = normalizeRevenueKey(purchaseOrder.customerPONumber ?? "");
    if (!key || !wantedPurchaseOrders.has(key)) continue;

    const matches = purchaseOrdersByNumber.get(key) ?? [];
    matches.push(purchaseOrder.id);
    purchaseOrdersByNumber.set(key, matches);
  }

  const existingInvoices = new Map<string, RevenueExistingInvoice[]>();

  for (const cycle of billingCycles) {
    const key = normalizeRevenueKey(cycle.invoiceNumber ?? "");
    if (!key || !wantedInvoices.has(key)) continue;

    const matches = existingInvoices.get(key) ?? [];
    matches.push({ id: cycle.id, purchaseOrderId: cycle.purchaseOrderId });
    existingInvoices.set(key, matches);
  }

  return { purchaseOrdersByNumber, existingInvoices };
}

function parsePoStatus(value: unknown): "LIVE" | "CLOSED" | "invalid" | null {
  const text = revenueCellText(value).toLowerCase();
  if (!text) return null;
  if (text === "live" || text === "open") return "LIVE";
  if (text === "closed" || text === "close") return "CLOSED";
  return "invalid";
}

function parsePurchaseOrderType(
  value: unknown,
): "MAIL" | "AGREEMENT" | "NORMAL" | null {
  const text = revenueCellText(value).toUpperCase();
  if (text === "MAIL" || text === "AGREEMENT" || text === "NORMAL") return text;
  return null;
}

function usableDate(value: ParsedDate) {
  return typeof value === "string" ? value : null;
}

function usableAmount(value: ParsedAmount) {
  return typeof value === "number" && isAllowedMoneyAmount(value)
    ? roundMoney(value)
    : 0;
}

function moneyProblem(label: string, value: ParsedAmount) {
  if (typeof value !== "number" || isAllowedMoneyAmount(value)) return null;
  return `${label} must be between 0 and 9999999999.99`;
}

function readPurchaseOrderDraft(
  candidate: RevenueImportCandidate,
  customerPONumber: string,
): RevenuePurchaseOrderDraft {
  const poAmount = parseExcelAmount(candidate.poAmount);
  const status = parsePoStatus(candidate.poStatus);
  const startFrom = parseExcelDate(candidate.startFrom);
  const endDate = parseExcelDate(candidate.endDate);

  return {
    customerPONumber,
    customerName: revenueCellText(candidate.customerName),
    companyName: revenueCellText(candidate.companyName),
    vendorName: revenueCellText(candidate.vendorName),
    poAmount:
      typeof poAmount === "number" && isAllowedMoneyAmount(poAmount)
        ? roundMoney(poAmount)
        : null,
    status: status && status !== "invalid" ? status : "LIVE",
    scope: revenueCellText(candidate.scope),
    billingPlanName: revenueCellText(candidate.billingPlanName),
    serviceTypeName: revenueCellText(candidate.serviceTypeName),
    contractDurationName: revenueCellText(candidate.contractDurationName),
    contractTypeName: revenueCellText(candidate.contractTypeName),
    poOwner: revenueCellText(candidate.poOwner),
    paymentTerms: revenueCellText(candidate.paymentTerms),
    purchaseOrderType: parsePurchaseOrderType(candidate.purchaseOrderType),
    startFrom: usableDate(startFrom),
    endDate: usableDate(endDate),
    remark: remarkText(revenueCellText(candidate.remark)),
  };
}

function remarkText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text === "-" ? "" : text;
}

function mergeRemarks(left: string, right: string) {
  const notes = [...new Set(`${left}; ${right}`.split(";").map((part) => part.trim()).filter(Boolean))];
  return notes.join("; ");
}

function mergePurchaseOrderDraft(
  current: RevenuePurchaseOrderDraft,
  next: RevenuePurchaseOrderDraft,
): RevenuePurchaseOrderDraft {
  const merged = { ...current };

  for (const key of Object.keys(merged) as Array<keyof RevenuePurchaseOrderDraft>) {
    const left = key === "remark" ? remarkText(String(merged[key] ?? "")) : merged[key];
    const right = key === "remark" ? remarkText(String(next[key] ?? "")) : next[key];
    const leftEmpty = left == null || left === "";
    const rightEmpty = right == null || right === "";

    if (leftEmpty && !rightEmpty) {
      Object.assign(merged, { [key]: right });
    } else if (key === "remark" && !leftEmpty && !rightEmpty && left !== right) {
      merged.remark = mergeRemarks(String(left), String(right));
    } else if (!leftEmpty && !rightEmpty && left !== right) {
      continue;
    }
  }

  return merged;
}

export function assessRevenueImport(
  parsed: ParsedRevenueWorkbook,
  context: RevenueImportContext,
): AssessedRevenueImport {
  if (parsed.columnErrors.length > 0) {
    return {
      columnErrors: parsed.columnErrors,
      errors: [],
      rows: [],
      inserts: [],
      canCommit: false,
    };
  }

  const rows: RevenueImportPreviewRow[] = [];
  const inserts: RevenueImportInsert[] = [];
  const errors: RevenueImportRowError[] = [];
  const purchaseOrderDrafts = new Map<string, RevenuePurchaseOrderDraft>();

  for (const candidate of parsed.candidates) {
    const row = candidate.excelRow;
    const invoiceNumber =
      revenueCellText(candidate.invoiceNumber) || `ROW-${row}`;
    const customerName = revenueCellText(candidate.customerName);
    const customerPONumber =
      revenueCellText(candidate.customerPONumber) ||
      `NO-PO-${normalizeRevenueKey(customerName) || invoiceNumber}`;
    const billingRemark = revenueCellText(candidate.billingRemark);
    const paymentText = revenueCellText(candidate.paymentReceived).toUpperCase();
    const paymentReceived: "YES" | "NO" =
      paymentText === "YES" || paymentText === "NO" ? paymentText : "NO";
    const invoiceDate = usableDate(parseExcelDate(candidate.invoiceDate));
    const paymentReceivedDate = usableDate(
      parseExcelDate(candidate.paymentReceivedDate),
    );
    const paymentDueDate = usableDate(parseExcelDate(candidate.paymentDueDate));
    const billingSubmittedDate = usableDate(
      parseExcelDate(candidate.billingSubmittedDate),
    );
    const invoiceParsed = parseExcelAmount(candidate.invoiceAmount);
    const creditParsed = parseExcelAmount(candidate.creditNote);
    const collectedParsed = parseExcelAmount(candidate.collectedAmount);
    const tdsParsed = parseExcelAmount(candidate.tds);
    const poParsed = parseExcelAmount(candidate.poAmount);
    const invoiceAmount = usableAmount(invoiceParsed);
    const creditNoteProvided = creditParsed !== null;
    const creditNote = usableAmount(creditParsed);
    const collectedAmount = usableAmount(collectedParsed);
    const tds = usableAmount(tdsParsed);
    const moneyMessages = [
      moneyProblem("Invoice amount", invoiceParsed),
      moneyProblem("Credit Note", creditParsed),
      moneyProblem("Collected amount", collectedParsed),
      moneyProblem("TDS", tdsParsed),
      moneyProblem("PO amount", poParsed),
      creditNoteProvided && creditNote > invoiceAmount
        ? "Credit Note cannot exceed the invoice amount"
        : null,
    ].filter((message): message is string => Boolean(message));

    let purchaseOrderId = "";
    let billingCycleId = "";
    const matches =
      context.purchaseOrdersByNumber.get(normalizeRevenueKey(customerPONumber)) ??
      [];

    if (matches.length > 1) {
      errors.push({
        row,
        messages: ["More than one purchase order uses this PO number."],
      });
      continue;
    }

    if (matches.length === 1) purchaseOrderId = matches[0];

    const draft = readPurchaseOrderDraft(candidate, customerPONumber);
    const key = normalizeRevenueKey(customerPONumber);
    const current = purchaseOrderDrafts.get(key);
    if (!current) {
      purchaseOrderDrafts.set(key, draft);
    } else {
      Object.assign(current, mergePurchaseOrderDraft(current, draft));
    }

    if (invoiceNumber) {
      const existing =
        context.existingInvoices.get(normalizeRevenueKey(invoiceNumber)) ?? [];

      if (existing.length > 1) {
        errors.push({
          row,
          messages: ["More than one billing cycle uses this invoice number."],
        });
        continue;
      }

      if (existing.length === 1) {
        billingCycleId = existing[0].id;
        if (!purchaseOrderId) purchaseOrderId = existing[0].purchaseOrderId;
      }
    }

    const purchaseOrder = purchaseOrderDrafts.get(key) ?? null;
    const resolvedInvoiceDate = invoiceDate ?? "";
    const resolvedSubmitted = billingSubmittedDate ?? resolvedInvoiceDate;
    const resolvedDue = paymentDueDate ?? resolvedInvoiceDate;

    if (moneyMessages.length > 0) {
      errors.push({ row, messages: moneyMessages });
    }

    rows.push({
      excelRow: row,
      invoiceNumber,
      customerPONumber,
      customerName,
      invoiceDate: resolvedInvoiceDate
        ? formatImportDate(resolvedInvoiceDate)
        : "",
      invoiceAmount,
      creditNote,
      collectedAmount,
      tds,
      paymentReceived,
      paymentReceivedDate: paymentReceivedDate
        ? formatImportDate(paymentReceivedDate)
        : "",
      paymentDueDate: resolvedDue ? formatImportDate(resolvedDue) : "",
      billingSubmittedDate: resolvedSubmitted
        ? formatImportDate(resolvedSubmitted)
        : "",
      billingRemark,
    });

    if (moneyMessages.length > 0) continue;

    inserts.push({
      excelRow: row,
      purchaseOrderId,
      purchaseOrder,
      billingCycleId,
      invoiceNumber,
      invoiceDate: resolvedInvoiceDate,
      invoiceAmount,
      creditNote: creditNoteProvided ? creditNote : null,
      collectedAmount,
      tds,
      paymentReceived,
      paymentReceivedDate,
      paymentDueDate: resolvedDue,
      billingSubmittedDate: resolvedSubmitted,
      billingRemark,
    });
  }

  const savedRows = keepLatestInvoiceRows(inserts);

  return {
    columnErrors: [],
    errors,
    rows,
    inserts: savedRows,
    canCommit: savedRows.length > 0,
  };
}

function keepLatestInvoiceRows(inserts: RevenueImportInsert[]) {
  const lastIndexByInvoice = new Map<string, number>();

  inserts.forEach((row, index) => {
    const key = normalizeRevenueKey(row.invoiceNumber);
    if (!key) return;
    lastIndexByInvoice.set(key, index);
  });

  return inserts.filter((row, index) => {
    const key = normalizeRevenueKey(row.invoiceNumber);
    if (!key) return true;
    return lastIndexByInvoice.get(key) === index;
  });
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeSpreadsheetText(value: string) {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function flattenExportRows(purchaseOrders: RevenueExportPurchaseOrder[]) {
  return purchaseOrders.flatMap((purchaseOrder) => {
    const shared = {
      "Customer PO Number": purchaseOrder.customerPONumber ?? "",
      Customer: purchaseOrder.customerName ?? "",
      Company: purchaseOrder.companyName ?? "",
      Vendor: purchaseOrder.vendorName ?? "",
      "PO Amount": exportAmount(purchaseOrder.poAmount, purchaseOrder.poAmount != null),
      "PO Status": purchaseOrder.status ?? "",
      "Scope Of Work": purchaseOrder.scope ?? "",
      "Billing Plan": purchaseOrder.billingPlanName ?? "",
      "Service Type": purchaseOrder.serviceTypeName ?? "",
      "Contract Duration": purchaseOrder.contractDurationName ?? "",
      "Contract Type": purchaseOrder.contractTypeName ?? "",
      "PO Owner": purchaseOrder.poOwner ?? "",
      "Payment Terms": purchaseOrder.paymentTerms ?? "",
      "Purchase Order Type": purchaseOrder.purchaseOrderType ?? "",
      "Start Date": exportDate(purchaseOrder.startFrom),
      "End Date": exportDate(purchaseOrder.endDate),
      Remark: purchaseOrder.remark ?? "",
    };

    const cycles = [...(purchaseOrder.billingCycles ?? [])].sort((left, right) => {
      const leftTime = new Date(
        left.invoiceDate ?? left.billingSubmittedDate ?? 0,
      ).getTime();
      const rightTime = new Date(
        right.invoiceDate ?? right.billingSubmittedDate ?? 0,
      ).getTime();
      return (Number.isNaN(leftTime) ? 0 : leftTime) -
        (Number.isNaN(rightTime) ? 0 : rightTime);
    });

    if (cycles.length === 0) {
      return [
        {
          ...shared,
          "Invoice Number": "",
          "Invoice Date": "",
          "Invoice Amount": "",
          "Credit Note Amount": "",
          "Collected Amount": "",
          TDS: "",
          "Payment Received": "",
          "Payment Received Date": "",
          "Payment Due Date": "",
          "Billing Submitted Date": "",
          "Billing Remark": "",
        },
      ];
    }

    return cycles.map((cycle) => ({
      ...shared,
      "Invoice Number": cycle.invoiceNumber ?? "",
      "Invoice Date": exportDate(cycle.invoiceDate),
      "Invoice Amount": exportAmount(cycle.invoiceAmount, true),
      "Credit Note Amount": exportAmount(cycle.creditNote, true),
      "Collected Amount": exportAmount(cycle.collectedAmount, true),
      TDS: exportAmount(cycle.tds, true),
      "Payment Received": cycle.paymentReceived ?? "",
      "Payment Received Date": exportDate(cycle.paymentReceivedDate),
      "Payment Due Date": exportDate(cycle.paymentDueDate),
      "Billing Submitted Date": exportDate(cycle.billingSubmittedDate),
      "Billing Remark": cycle.billingRemark ?? "",
    }));
  });
}

export async function buildRevenueWorkbook(purchaseOrders: RevenueExportPurchaseOrder[]) {
  const headers = REVENUE_EXCEL_COLUMNS.map((column) => column.header);
  const records = flattenExportRows(purchaseOrders);
  const body = records.map((record) =>
    headers.map((header) => {
      const value = record[header as keyof typeof record] ?? "";
      return typeof value === "string" ? neutralizeSpreadsheetText(value) : value;
    }),
  );
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Revenue");
  sheet.addRow(headers);
  for (const row of body) sheet.addRow(row);
  headers.forEach((header, index) => {
    sheet.getColumn(index + 1).width = Math.max(header.length + 2, 18);
  });

  const contents = await workbook.xlsx.writeBuffer();
  return Buffer.from(contents);
}
