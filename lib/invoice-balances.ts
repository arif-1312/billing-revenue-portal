import { calendarDaysBetween } from "@/lib/fiscal-year";

type Receipt = {
  amount?: number | null;
};

export type InvoiceReceivableInput = {
  invoiceDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  paymentReceived?: string | null;
  invoiceAmount?: number | null;
  collectedAmount?: number | null;
  payments?: Receipt[] | null;
};

export type InvoiceReceivable = {
  outstanding: number;
  overdue: number;
  notYetDue: number;
  undated: number;
};

const emptyReceivable: InvoiceReceivable = {
  outstanding: 0,
  overdue: 0,
  notYetDue: 0,
  undated: 0,
};

function asDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function collectedAgainstInvoice(invoice: InvoiceReceivableInput) {
  const payments = invoice.payments ?? [];
  if (payments.length > 0) {
    return payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  }

  return Number(invoice.collectedAmount || 0);
}

/**
 * Outstanding is the unpaid balance after the invoice date and before the due date.
 * Overdue is that balance on the due date and after it.
 * Payment received status must be No. An invoice is in one of these amounts, not both.
 */
export function classifyInvoiceReceivable(
  invoice: InvoiceReceivableInput,
  today = new Date(),
): InvoiceReceivable {
  const invoiceDate = asDate(invoice.invoiceDate);
  if (!invoiceDate || calendarDaysBetween(today, invoiceDate) < 0) return emptyReceivable;
  if (invoice.paymentReceived !== "NO") return emptyReceivable;

  const balance = Math.max(Number(invoice.invoiceAmount || 0) - collectedAgainstInvoice(invoice), 0);
  if (balance <= 0) return emptyReceivable;

  const dueDate = asDate(invoice.paymentDueDate);
  if (!dueDate) {
    return { outstanding: balance, overdue: 0, notYetDue: 0, undated: balance };
  }

  if (calendarDaysBetween(today, dueDate) >= 0) {
    return { outstanding: 0, overdue: balance, notYetDue: 0, undated: 0 };
  }

  return { outstanding: balance, overdue: 0, notYetDue: balance, undated: 0 };
}
