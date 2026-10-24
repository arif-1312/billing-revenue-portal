type ReceiptAmount = {
  amount?: number | null
}

function money(value: number | null | undefined) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric * 100) / 100
}

/**
 * Outstanding balance for notification decisions.
 * Successfully recorded payments are positive BillingCyclePayment amounts.
 * A zero or negative result means the invoice is settled or overpaid.
 */
export function outstandingBalance(
  invoiceAmount: number | null | undefined,
  receipts: ReceiptAmount[] | null | undefined,
) {
  const invoiced = money(invoiceAmount)
  const paid = (receipts ?? []).reduce((total, receipt) => {
    const amount = Number(receipt.amount ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) return total
    return total + amount
  }, 0)

  return money(invoiced - paid)
}

export function rupees(value: number) {
  const amount = money(value)
  return `Rs.${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
