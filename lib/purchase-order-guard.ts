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
