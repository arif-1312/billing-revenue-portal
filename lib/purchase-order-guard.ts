import { moneyEquals } from "./money"

export function purchaseOrderUpdateBlock(input: {
  status: string
  actorIsSystem: boolean
  expectedUpdatedAt?: string | Date | null
  currentUpdatedAt: Date
}) {
  if (input.status === "CLOSED" && !input.actorIsSystem) {
    return "Closed purchase orders cannot be changed."
  }

  if (input.expectedUpdatedAt) {
    const expected = new Date(input.expectedUpdatedAt).getTime()
    if (
      Number.isFinite(expected) &&
      expected !== input.currentUpdatedAt.getTime()
    ) {
      return "This purchase order was updated by someone else. Reload it and try again."
    }
  }

  return null
}

export function cycleIsPaid(input: {
  paymentCount: number
  paymentReceived?: string | null
}) {
  return input.paymentCount > 0 || input.paymentReceived === "YES"
}

export function purchaseOrderDeleteBlock(input: {
  status: string
  actorIsSystem: boolean
  hasPaidCycle: boolean
}) {
  const closed = purchaseOrderUpdateBlock({
    status: input.status,
    actorIsSystem: input.actorIsSystem,
    currentUpdatedAt: new Date(0),
  })
  if (closed) return closed

  if (input.hasPaidCycle && !input.actorIsSystem) {
    return "Paid billing history cannot be removed."
  }

  return null
}

export function paidCycleChangeBlock(input: {
  paid: boolean
  actorIsSystem: boolean
  invoiceAmountChanged: boolean
  creditNoteChanged: boolean
}) {
  if (
    input.paid &&
    !input.actorIsSystem &&
    (input.invoiceAmountChanged || input.creditNoteChanged)
  ) {
    return "Paid billing cycles cannot be changed."
  }

  return null
}

export function paidCycleRemovalBlock(input: {
  paid: boolean
  actorIsSystem: boolean
  canDelete: boolean
}) {
  if (input.paid && !input.actorIsSystem) {
    return "Paid billing history cannot be removed."
  }

  if (!input.canDelete && !input.actorIsSystem) {
    return "Delete permission is required to remove a billing cycle."
  }

  return null
}

export function paymentRemovalBlock(input: {
  actorIsSystem: boolean
  canDelete: boolean
}) {
  if (!input.canDelete && !input.actorIsSystem) {
    return "Delete permission is required to remove a payment."
  }

  return null
}

export function importPaymentReplacementBlock(input: {
  paymentCount: number
  paymentTotal: unknown
  incomingCollected: unknown
}) {
  if (input.paymentCount === 0) return null
  if (moneyEquals(input.paymentTotal, input.incomingCollected)) return null

  return "Existing payment history cannot be replaced."
}
