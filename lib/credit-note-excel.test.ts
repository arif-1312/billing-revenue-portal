import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildCreditNoteWorkbook, parseCreditNoteWorkbook } from "./credit-note-excel";

async function workbookBuffer(rows: Array<Array<string | number>>, customerHeader = "Customer Name") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Credit Notes");
  sheet.addRow([customerHeader, "Date", "Vch Type", "Vch No.", "Amount"]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("credit note excel import", () => {
  it.each(["Customer Name", "Particulars"])("reads customer names from the %s column", async (customerHeader) => {
    const parsed = await parseCreditNoteWorkbook(
      await workbookBuffer([
        ["Acme Pvt Ltd", "2026-04-15", "Credit Note", "CN-12", 2500.5],
        ["Northwind", "15/05/2026", "Credit Note", "CN-13", "1,200.00"],
      ], customerHeader),
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        excelRow: 2,
        customerName: "Acme Pvt Ltd",
        date: "2026-04-15",
        vchType: "Credit Note",
        vchNo: "CN-12",
        amount: 2500.5,
      },
      {
        excelRow: 3,
        customerName: "Northwind",
        date: "2026-05-15",
        vchType: "Credit Note",
        vchNo: "CN-13",
        amount: 1200,
      },
    ]);
  });

  it("exports Customer Name and preserves the customer when imported again", async () => {
    const note = {
      customerName: "Acme Pvt Ltd",
      date: "2026-04-15",
      vchType: "Credit Note",
      vchNo: "CN-12",
      amount: 2500.5,
    };
    const buffer = await buildCreditNoteWorkbook([note]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    expect(workbook.worksheets[0].getCell("A1").value).toBe("Customer Name");
    const parsed = await parseCreditNoteWorkbook(buffer);
    expect(parsed.error).toBeUndefined();
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([{ excelRow: 2, ...note }]);
  });

  it("rejects a bad amount and a repeated voucher on the same date", async () => {
    const parsed = await parseCreditNoteWorkbook(
      await workbookBuffer([
        ["Acme Pvt Ltd", "2026-04-15", "Credit Note", "CN-12", 0],
        ["Acme Pvt Ltd", "2026-04-15", "Credit Note", "CN-12", 100],
        ["Acme Pvt Ltd", "2026-04-15", "Credit Note", "CN-12", 200],
      ]),
    );

    expect(parsed.rows).toHaveLength(1);
    expect(parsed.errors.map((error) => error.row)).toEqual([2, 4]);
    expect(parsed.errors[1]?.message).toMatch(/repeated/);
  });
});
