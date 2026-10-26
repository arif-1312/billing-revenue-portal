import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  assessRevenueImport,
  buildRevenueWorkbook,
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
