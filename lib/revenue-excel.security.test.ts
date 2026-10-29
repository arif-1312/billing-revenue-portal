import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  assessRevenueImport,
  buildRevenueWorkbook,
  parseRevenueWorkbook,
  type RevenueExportPurchaseOrder,
  type RevenueImportCandidate,
} from "./revenue-excel";

const context = {
  purchaseOrdersByNumber: new Map<string, string[]>(),
  existingInvoices: new Map<string, { id: string; purchaseOrderId: string }[]>(),
};

function candidate(
  invoiceAmount: number,
): RevenueImportCandidate {
  return {
    excelRow: 2,
    invoiceNumber: "INV-1",
    customerPONumber: "PO-1",
    customerName: "Northwind",
    companyName: "Northwind",
    vendorName: "",
    invoiceDate: "2026-04-01",
    invoiceAmount,
    creditNote: null,
    collectedAmount: 10,
    tds: 0,
    paymentReceived: "NO",
    paymentReceivedDate: "",
    paymentDueDate: "",
    billingSubmittedDate: "",
    billingRemark: "",
    poAmount: 100,
    poStatus: "LIVE",
    scope: "",
    billingPlanName: "",
    serviceTypeName: "",
    contractDurationName: "",
    contractTypeName: "",
    poOwner: "",
    paymentTerms: "",
    purchaseOrderType: "",
    startFrom: "",
    endDate: "",
    remark: "",
  };
}

describe("revenue spreadsheet safety", () => {
  it("does not insert a negative invoice amount", () => {
    const assessed = assessRevenueImport(
      { columnErrors: [], candidates: [candidate(-5)] },
      context,
    );

    expect(assessed.inserts).toHaveLength(0);
    expect(assessed.canCommit).toBe(false);
    expect(assessed.errors[0]?.messages.join(" ")).toContain("Invoice amount");
  });

  it("keeps the latest row when one invoice number is repeated in the file", () => {
    const first = candidate(100);
    const second = { ...candidate(250), excelRow: 3 };
    const assessed = assessRevenueImport(
      { columnErrors: [], candidates: [first, second] },
      context,
    );

    expect(assessed.inserts).toHaveLength(1);
    expect(assessed.inserts[0]?.excelRow).toBe(3);
    expect(assessed.inserts[0]?.invoiceAmount).toBe(250);
    expect(assessed.canCommit).toBe(true);
  });

  it("keeps an Excel date as the invoice date", () => {
    const row = candidate(100);
    row.invoiceDate = new Date(2025, 3, 15);
    const assessed = assessRevenueImport(
      { columnErrors: [], candidates: [row] },
      context,
    );

    expect(assessed.inserts[0]?.invoiceDate).toBe("2025-04-15");
  });

  it("still inserts an ordinary positive invoice amount", () => {
    const assessed = assessRevenueImport(
      { columnErrors: [], candidates: [candidate(500)] },
      context,
    );

    expect(assessed.errors).toHaveLength(0);
    expect(assessed.inserts).toHaveLength(1);
    expect(assessed.inserts[0]?.invoiceAmount).toBe(500);
  });

  it("prefixes formula-like text and keeps invoice amounts numeric", async () => {
    const purchaseOrder: RevenueExportPurchaseOrder = {
      customerPONumber: "PO-1",
      poAmount: 1000,
      remark: "=SUM(A1)",
      customerName: "Northwind",
      companyName: "Northwind",
      vendorName: "Vendor",
      billingPlanName: "Monthly",
      serviceTypeName: "Support",
      contractDurationName: "12",
      contractTypeName: "AMC",
      scope: "+cmd",
      billingCycles: [
        {
          invoiceNumber: "INV-1",
          invoiceAmount: 500,
          collectedAmount: 100,
          tds: 0,
          paymentReceived: "NO",
          billingRemark: "@note",
        },
      ],
    };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await buildRevenueWorkbook([purchaseOrder])) as unknown as ExcelJS.Buffer,
    );
    const sheet = workbook.getWorksheet("Revenue");
    const header = sheet?.getRow(1).values;
    const first = sheet?.getRow(2).values;
    const rows = [
      Object.fromEntries(
        (Array.isArray(header) ? header.slice(1) : []).map((name, index) => [
          String(name),
          Array.isArray(first) ? first[index + 1] : undefined,
        ]),
      ),
    ];

    expect(rows[0]?.Remark).toBe("'=SUM(A1)");
    expect(rows[0]?.["Scope Of Work"]).toBe("'+cmd");
    expect(rows[0]?.["Billing Remark"]).toBe("'@note");
    expect(rows[0]?.["Invoice Amount"]).toBe(500);
    expect(rows[0]?.["Collected Amount"]).toBe(100);
    expect(typeof rows[0]?.["Invoice Amount"]).toBe("number");
  });
});

const UPLOADED_HEADERS = [
  "Invoice Number",
  "Customer PO Number",
  "Customer",
  "Company",
  "Vendor",
  "Invoice Date",
  "Invoice Amount",
  "Collected Amount",
  "TDS",
  "Payment Received",
  "Payment Received Date",
  "Payment Due Date",
  "Billing Submitted Date",
  "Billing Remark",
  "PO Amount",
  "PO Status",
  "Scope Of Work",
  "Billing Plan",
  "Service Type",
  "Contract Duration",
  "Contract Type",
  "PO Owner",
  "Payment Terms",
  "Purchase Order Type",
  "Start Date",
  "End Date",
  "Remark",
  "Invoice Value (With Tax)",
];

describe("uploaded revenue headers", () => {
  it("reads this header row from a later sheet, including a repeated heading", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Cover").addRow(["Notes"]);
    workbook.addWorksheet("Lookup").addRow(["Date", "Status"]);
    workbook.addWorksheet("Archive").addRow(["Old"]);
    const sheet = workbook.addWorksheet("Revenue");
    sheet.addRow(["Revenue export"]);
    sheet.mergeCells("A1:C1");
    sheet.addRow(UPLOADED_HEADERS);
    const header = sheet.getRow(2);
    header.getCell(1).value = { richText: [{ text: "Invoice Number" }] };
    header.getCell(UPLOADED_HEADERS.length + 1).value = "Customer";
    header.getCell(50).value = "extra";

    const data = UPLOADED_HEADERS.map((name) => {
      if (name === "Invoice Number") return "INV-9";
      if (name === "Customer PO Number") return "PO-9";
      if (name === "Customer") return "Acme";
      if (name === "Company") return "Acme Co";
      if (name === "Invoice Amount") return 1500;
      if (name === "Invoice Value (With Tax)") return 1770;
      return "";
    });
    sheet.addRow(data);
    sheet.getRow(3).getCell(50).value = "wide";

    const parsed = await parseRevenueWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.columnErrors).toEqual([]);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]?.excelRow).toBe(3);
    expect(parsed.candidates[0]?.invoiceNumber).toBe("INV-9");
    expect(parsed.candidates[0]?.customerName).toBe("Acme");
    expect(parsed.candidates[0]?.invoiceAmount).toBe(1500);
  });

  it("uses Invoice Value (With Tax) when Invoice Amount is blank", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Revenue");
    sheet.addRow(UPLOADED_HEADERS);
    const data = UPLOADED_HEADERS.map((name) => {
      if (name === "Invoice Number") return "INV-10";
      if (name === "Customer") return "Acme";
      if (name === "Invoice Value (With Tax)") return 1770;
      return "";
    });
    sheet.addRow(data);

    const parsed = await parseRevenueWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.columnErrors).toEqual([]);
    expect(parsed.candidates[0]?.invoiceAmount).toBe(1770);
  });

  it("uploads a sheet when most columns and cells are empty", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Revenue");
    sheet.addRow(["Customer", "Invoice Value (Without Tax)", "Remark"]);
    sheet.addRow(["Acme", 900, ""]);
    sheet.addRow(["", "", ""]);

    const parsed = await parseRevenueWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.columnErrors).toEqual([]);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]?.customerName).toBe("Acme");
    expect(parsed.candidates[0]?.invoiceAmount).toBe(900);
    expect(parsed.candidates[0]?.invoiceNumber).toBeNull();
  });

  it("uploads the only matching column from a later sheet", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Cover").addRow(["Notes"]);
    const sheet = workbook.addWorksheet("Revenue");
    sheet.addRow(["Client reference", "Customer"]);
    sheet.addRow(["ignored", "Northwind"]);

    const parsed = await parseRevenueWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(parsed.columnErrors).toEqual([]);
    expect(parsed.candidates).toHaveLength(1);
    expect(parsed.candidates[0]?.customerName).toBe("Northwind");
    expect(parsed.candidates[0]?.companyName).toBeNull();
  });
});
