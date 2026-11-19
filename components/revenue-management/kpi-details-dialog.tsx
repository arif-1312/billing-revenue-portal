"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { BillingInvoiceLine, DashboardKpiDetailRecord } from "@/lib/actions/dashboard";
import { downloadCsv, formatInr } from "@/lib/revenue-metrics";

import type { KpiDetailKey } from "./kpi-card";

type DetailRow = Omit<DashboardKpiDetailRecord, "source"> & {
  source: "invoice" | "planned" | "credit-note";
  invoiceIdentity?: string;
};

const titles: Record<KpiDetailKey, string> = {
  plannedBilling: "Planned Billing",
  billedAmount: "Billed Amount",
  netBilledAmount: "Net Billed Amount",
  creditNoteAmount: "Credit Note Amount",
  billingDone: "Billing Done",
  billingAchievement: "Billing Achievement",
  totalCollected: "Total Collected",
  totalReceivables: "Total Receivables",
  notYetDue: "Not Yet Due",
  overdueAmount: "Overdue Amount",
  collectionEfficiency: "Collection Efficiency",
  overdueInvoiceCount: "Overdue Invoice Count",
  pendingCollection: "Pending Collection",
};

function invoiceRows(lines: BillingInvoiceLine[]): DetailRow[] {
  return lines.map((line) => ({
    ...line,
    source: "invoice",
    poStatus: line.status,
  }));
}

function distinctActualInvoices(rows: DetailRow[]) {
  const unique = new Map<string, DetailRow>();
  for (const row of rows) {
    if (row.source !== "invoice" || row.invoiceNumber === "-" || !row.invoiceDate) continue;
    const key = row.invoiceIdentity || `${row.companyName}|${row.invoiceNumber}|${row.invoiceDate}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}

function rowsForKpi(
  key: KpiDetailKey,
  invoices: DetailRow[],
  planned: DashboardKpiDetailRecord[],
  creditNotes: DashboardKpiDetailRecord[],
  collectionUsesFilteredRows: boolean,
): DetailRow[] {
  const actualInvoices = distinctActualInvoices(invoices);
  switch (key) {
    case "plannedBilling":
      return planned.map((row) => ({ ...row, source: "planned" }));
    case "billedAmount":
      return invoices;
    case "netBilledAmount":
      return [...invoices, ...creditNotes.map((row) => ({ ...row, source: "credit-note" as const }))];
    case "creditNoteAmount":
      return creditNotes.map((row) => ({ ...row, source: "credit-note" }));
    case "billingDone":
      return actualInvoices;
    case "billingAchievement":
      return [
        ...planned.map((row) => ({ ...row, source: "planned" as const })),
        ...actualInvoices,
      ];
    case "totalCollected":
      return invoices.filter((row) =>
        (collectionUsesFilteredRows ? row.collectedAmount : row.collectedAsOfDate) > 0,
      );
    case "totalReceivables":
      return invoices.filter((row) =>
        row.notYetDueAmount + row.overdueAmount + row.undatedOutstanding > 0,
      );
    case "notYetDue":
      return invoices.filter((row) => row.notYetDueAmount > 0);
    case "overdueAmount":
      return invoices.filter((row) => row.overdueAmount > 0);
    case "overdueInvoiceCount": {
      const toKolkataDate = (value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date);
      };
      const today = toKolkataDate(new Date().toISOString());
      return distinctActualInvoices(invoices.filter((row) => {
        const dueDate = row.dueDate ? toKolkataDate(row.dueDate) : "";
        return dueDate !== "" && dueDate <= today &&
          row.notYetDueAmount + row.overdueAmount + row.undatedOutstanding > 0;
      }));
    }
    case "pendingCollection":
      return invoices.filter((row) => row.notYetDueAmount + row.undatedOutstanding > 0);
    case "collectionEfficiency":
      return [...invoices, ...creditNotes.map((row) => ({ ...row, source: "credit-note" as const }))];
  }
}

function dateValue(row: DetailRow) {
  return row.recordDate || row.invoiceDate || row.scheduledDate || "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

function formatMetricValue(key: KpiDetailKey, value: number) {
  if (key === "overdueInvoiceCount") return value.toLocaleString("en-IN");
  return key === "billingAchievement" || key === "collectionEfficiency"
    ? `${value.toFixed(2)}%`
    : formatInr(value);
}

function amountForKpi(row: DetailRow, key: KpiDetailKey, collectionUsesFilteredRows: boolean) {
  if (key === "totalCollected") {
    return collectionUsesFilteredRows ? row.collectedAmount : row.collectedAsOfDate;
  }
  if (key === "totalReceivables") {
    return row.notYetDueAmount + row.overdueAmount + row.undatedOutstanding;
  }
  if (key === "notYetDue") return row.notYetDueAmount;
  if (key === "overdueAmount") return row.overdueAmount;
  if (key === "pendingCollection") return row.notYetDueAmount + row.undatedOutstanding;
  if ((key === "netBilledAmount" || key === "collectionEfficiency") && row.source === "credit-note") {
    return -row.amount;
  }
  return row.amount;
}

function amountCells(row: DetailRow, key: KpiDetailKey, collectionUsesFilteredRows: boolean) {
  const amount = amountForKpi(row, key, collectionUsesFilteredRows);
  if (row.source === "credit-note") return { amount, gst: null, total: amount };
  if (key === "billingDone") return { amount: row.amount, gst: row.gst, total: row.totalAmount };
  const gst = row.amount !== 0 ? (row.gst ?? 0) * (amount / row.amount) : 0;
  return { amount, gst, total: amount + gst };
}

function detailRows(
  key: KpiDetailKey,
  invoiceLines: BillingInvoiceLine[],
  plannedRecords: DashboardKpiDetailRecord[],
  creditNoteRecords: DashboardKpiDetailRecord[],
  collectionUsesFilteredRows: boolean,
) {
  return rowsForKpi(
    key,
    invoiceRows(invoiceLines),
    plannedRecords,
    creditNoteRecords,
    collectionUsesFilteredRows,
  );
}

export function KpiDetailsDialog({
  metric,
  onOpenChange,
  invoiceLines,
  plannedRecords,
  creditNoteRecords,
  collectionUsesFilteredRows,
  currentValue,
  unavailable,
}: {
  metric: KpiDetailKey | null;
  onOpenChange: (open: boolean) => void;
  invoiceLines: BillingInvoiceLine[];
  plannedRecords: DashboardKpiDetailRecord[];
  creditNoteRecords: DashboardKpiDetailRecord[];
  collectionUsesFilteredRows: boolean;
  currentValue: number;
  unavailable: boolean;
}) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("all");
  const [customer, setCustomer] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("invoiceNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRecord, setSelectedRecord] = useState<DetailRow | null>(null);

  useEffect(() => {
    // Reset filters whenever the selected KPI opens a new record context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch("");
    setCompany("all");
    setCustomer("all");
    setPaymentStatus("all");
    setFromDate("");
    setToDate("");
    setSortBy("invoiceNumber");
    setSortDirection("asc");
    setPage(1);
    setSelectedRecord(null);
  }, [metric]);

  const allRows = useMemo(() => metric
    ? detailRows(metric, invoiceLines, plannedRecords, creditNoteRecords, collectionUsesFilteredRows)
    : [], [metric, invoiceLines, plannedRecords, creditNoteRecords, collectionUsesFilteredRows]);
  const companies = [...new Set(allRows.map((row) => row.companyName).filter((name) => name !== "-"))].sort();
  const customers = [...new Set(allRows.map((row) => row.customerName).filter((name) => name !== "-"))].sort();
  const statuses = [...new Set(allRows.map((row) => row.paymentStatus).filter(Boolean))].sort();
  const filteredRows = allRows.filter((row) => {
    if (company !== "all" && row.companyName !== company) return false;
    if (customer !== "all" && row.customerName !== customer) return false;
    if (paymentStatus !== "all" && row.paymentStatus !== paymentStatus) return false;
    const date = dateValue(row).slice(0, 10);
    if (fromDate && (!date || date < fromDate)) return false;
    if (toDate && (!date || date > toDate)) return false;
    const query = search.trim().toLocaleLowerCase();
    if (query && ![
      row.invoiceNumber,
      row.poNumber,
      row.companyName,
      row.customerName,
      row.paymentStatus,
      row.poStatus,
      row.scope,
      row.serviceType,
      row.noteDetails,
    ].some((value) => value?.toLocaleLowerCase().includes(query))) return false;
    return true;
  });
  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftValue = (left as unknown as Record<string, unknown>)[sortBy] ?? "";
    const rightValue = (right as unknown as Record<string, unknown>)[sortBy] ?? "";
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
    return sortDirection === "asc" ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetPage = () => setPage(1);
  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDirection("asc");
    }
    resetPage();
  };
  const columns: Array<{ id: string; label: string; align?: "left" | "right" }> = [
    { id: "invoiceNumber", label: "Invoice Number" },
    { id: "poNumber", label: "PO Number" },
    { id: "companyName", label: "Company Name" },
    { id: "customerName", label: "Customer Name" },
    { id: "invoiceDate", label: "Invoice Date" },
    { id: "dueDate", label: "Due Date" },
    { id: "amount", label: "Amount", align: "right" },
    { id: "gst", label: "GST", align: "right" },
    { id: "totalAmount", label: "Total Amount", align: "right" },
    { id: "paymentStatus", label: "Payment Status" },
  ];

  const rowValues = (row: DetailRow) => {
    if (!metric) return [];
    const values = amountCells(row, metric, collectionUsesFilteredRows);
    return [
      row.invoiceNumber,
      row.poNumber,
      row.companyName,
      row.customerName,
      formatDate(row.invoiceDate),
      formatDate(row.dueDate),
      formatInr(values.amount),
      values.gst == null ? "—" : formatInr(values.gst),
      values.total == null ? "—" : formatInr(values.total),
      row.paymentStatus,
    ];
  };
  const exportRows = sortedRows.map((row) => {
    const values = amountCells(row, metric!, collectionUsesFilteredRows);
    return {
      "Record Type": row.source,
      "Invoice Number": row.invoiceNumber,
      "PO Number": row.poNumber,
      "Company Name": row.companyName,
      "Customer Name": row.customerName,
      "Invoice Date": row.invoiceDate ?? "",
      "Due Date": row.dueDate ?? "",
      Amount: values.amount,
      GST: values.gst ?? "Not stored",
      "Total Amount": values.total ?? "Not stored",
      "Payment Status": row.paymentStatus,
    };
  });

  return (
    <>
      <Dialog open={Boolean(metric)} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[96vw] overflow-y-auto sm:max-w-[96vw]">
          <DialogHeader>
            <DialogTitle>{metric ? `${titles[metric]} details` : "KPI details"}</DialogTitle>
            <DialogDescription>
              {unavailable ? "This KPI is unavailable for the current selection." : `Current KPI value: ${metric ? formatMetricValue(metric, currentValue) : formatInr(currentValue)}`}
              {" · "}{allRows.length.toLocaleString("en-IN")} underlying records. Dashboard selections are applied.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Input
              placeholder="Search invoice, PO, company, customer…"
              value={search}
              onChange={(event) => { setSearch(event.target.value); resetPage(); }}
              className="sm:col-span-2 lg:col-span-2"
              aria-label="Search KPI records"
            />
            <select aria-label="Filter by company" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={company} onChange={(event) => { setCompany(event.target.value); resetPage(); }}>
              <option value="all">All companies</option>
              {companies.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select aria-label="Filter by customer" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={customer} onChange={(event) => { setCustomer(event.target.value); resetPage(); }}>
              <option value="all">All customers</option>
              {customers.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select aria-label="Filter by payment status" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); resetPage(); }}>
              <option value="all">All payment statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="flex gap-2">
              <Input type="date" aria-label="From record date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); resetPage(); }} />
              <Input type="date" aria-label="To record date" value={toDate} onChange={(event) => { setToDate(event.target.value); resetPage(); }} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!exportRows.length || !metric}
              onClick={() => {
                if (metric) {
                  downloadCsv(
                    `${titles[metric].toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-details.csv`,
                    exportRows,
                  );
                }
              }}
            >
              <Download />
              Export CSV
            </Button>
          </div>

          <div className="max-w-full overflow-auto rounded-md border">
            <table className="min-w-[1150px] border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="border-b px-3 py-2 text-xs font-semibold">Record Type</th>
                  {columns.map((column) => (
                    <th key={column.id} className={`border-b px-3 py-2 text-xs font-semibold ${column.align === "right" ? "text-right" : "text-left"}`}>
                      <button type="button" onClick={() => toggleSort(column.id)} className="whitespace-nowrap hover:text-primary">
                        {column.label}{sortBy === column.id ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-muted-foreground">No records match this KPI and its filters.</td></tr>
                ) : pageRows.map((row) => (
                  <tr key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRecord(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedRecord(row); }} tabIndex={0} aria-label={`Open ${row.invoiceNumber} record`}>
                    <td className="border-b px-3 py-2 capitalize">{row.source === "credit-note" ? "Credit note" : row.source}</td>
                    {rowValues(row).map((value, index) => (
                      <td key={index} className={`max-w-56 truncate border-b px-3 py-2 ${columns[index]?.align === "right" ? "text-right font-mono tabular-nums" : ""}`} title={String(value)}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">{sortedRows.length ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedRows.length)} of ${sortedRows.length}` : "0 records"}</p>
            <div className="flex items-center gap-2">
              <label htmlFor="kpi-page-size" className="text-muted-foreground">Rows</label>
              <select id="kpi-page-size" className="h-9 rounded-md border border-input bg-background px-2" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetPage(); }}>
                {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>Previous</Button>
              <span aria-live="polite">Page {currentPage} of {pageCount}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>Next</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record details</DialogTitle>
            <DialogDescription>{selectedRecord?.source === "credit-note" ? selectedRecord.noteDetails : `${selectedRecord?.invoiceNumber} · ${selectedRecord?.poNumber}`}</DialogDescription>
          </DialogHeader>
          {selectedRecord ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Record type", selectedRecord.source],
                ["Invoice number", selectedRecord.invoiceNumber],
                ["PO number", selectedRecord.poNumber],
                ["Company", selectedRecord.companyName],
                ["Customer", selectedRecord.customerName],
                ["Invoice date", formatDate(selectedRecord.invoiceDate)],
                ["Scheduled date", formatDate(selectedRecord.scheduledDate)],
                ["Due date", formatDate(selectedRecord.dueDate)],
                ["Amount before GST", formatInr(selectedRecord.amount)],
                ["GST", selectedRecord.gst == null ? "Not stored" : formatInr(selectedRecord.gst)],
                ["Total amount", selectedRecord.totalAmount == null ? "Not stored" : formatInr(selectedRecord.totalAmount)],
                ["Payment status", selectedRecord.paymentStatus],
                ["Payment received flag", selectedRecord.paymentReceived],
                ["Collected", formatInr(selectedRecord.collectedAmount)],
                ["Outstanding", formatInr(selectedRecord.outstanding)],
                ["Overdue", formatInr(selectedRecord.overdueAmount)],
                ["Purchase order status", selectedRecord.poStatus],
                ["Scope", selectedRecord.scope],
                ["Service type", selectedRecord.serviceType],
                ["Billing plan", selectedRecord.billingPlan],
                ["Contract duration", selectedRecord.contractDuration],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 border-b pb-2">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 break-words text-sm">{value}</p>
                </div>
              ))}
              {selectedRecord.payments.length ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <h3 className="mb-2 text-sm font-semibold">Payment receipts</h3>
                  <ul className="divide-y rounded-md border">
                    {selectedRecord.payments.map((payment, index) => (
                      <li key={`${payment.receivedDate}-${index}`} className="flex justify-between gap-4 px-3 py-2 text-sm">
                        <span>{formatDate(payment.receivedDate)}</span>
                        <span className="font-mono tabular-nums">{formatInr(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selectedRecord.noteDetails ? <p className="sm:col-span-2 lg:col-span-3 text-sm text-muted-foreground">{selectedRecord.noteDetails}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
