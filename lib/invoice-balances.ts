import { calendarDaysBetween } from "@/lib/fiscal-year";
import { addMoney, money, moneyToNumber, subtractMoney } from "@/lib/money";

type Receipt = {
  amount?: unknown;
};

export type InvoiceReceivableInput = {
  invoiceDate?: Date | string | null;
  paymentDueDate?: Date | string | null;
  paymentReceived?: string | null;
  invoiceAmount?: unknown;
  creditNote?: unknown;
  collectedAmount?: unknown;
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

/**
 * Final billed amount. The stored invoice amount stays unchanged.
 * Blank and zero credit notes leave it as entered. A positive credit note is subtracted once.
 */
export function netInvoiceAmount(invoiceAmount: unknown, creditNote?: unknown) {
  const note = money(creditNote);
  if (!note.greaterThan(0)) return money(invoiceAmount);

  const net = subtractMoney(invoiceAmount, note);
  return net.isNegative() ? money(0) : net;
}

export function billedInvoiceAmount(invoice: {
  invoiceAmount?: unknown;
  creditNote?: unknown;
}) {
  return moneyToNumber(netInvoiceAmount(invoice.invoiceAmount, invoice.creditNote));
}

function collectedAgainstInvoice(invoice: InvoiceReceivableInput) {
  const payments = invoice.payments ?? [];
  if (payments.length > 0) {
    return payments.reduce((total, payment) => addMoney(total, payment.amount), money(0));
  }

  return money(invoice.collectedAmount);
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

  const remaining = subtractMoney(
    netInvoiceAmount(invoice.invoiceAmount, invoice.creditNote),
    collectedAgainstInvoice(invoice),
  );
  const balance = moneyToNumber(remaining.isNegative() ? 0 : remaining);
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
