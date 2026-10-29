import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseCreditNoteWorkbook } from "./credit-note-excel";

async function workbookBuffer(rows: Array<Array<string | number>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Credit Notes");
  sheet.addRow(["Particulars", "Date", "Vch Type", "Vch No.", "Amount"]);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("credit note excel import", () => {
  it("reads particulars, date, voucher type, voucher number, and amount", async () => {
    const parsed = await parseCreditNoteWorkbook(
      await workbookBuffer([
        ["Acme Pvt Ltd", "2026-04-15", "Credit Note", "CN-12", 2500.5],
        ["Northwind", "15/05/2026", "Credit Note", "CN-13", "1,200.00"],
      ]),
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      {
        excelRow: 2,
        particulars: "Acme Pvt Ltd",
        date: "2026-04-15",
        vchType: "Credit Note",
        vchNo: "CN-12",
        amount: 2500.5,
      },
      {
        excelRow: 3,
        particulars: "Northwind",
        date: "2026-05-15",
        vchType: "Credit Note",
        vchNo: "CN-13",
        amount: 1200,
      },
    ]);
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
