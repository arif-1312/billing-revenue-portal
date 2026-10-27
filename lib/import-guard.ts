export function importRowBlockReason(
  row: { purchaseOrderId?: string; billingCycleId?: string },
  permissions: { canEdit: boolean; canDelete: boolean },
) {
  if ((row.purchaseOrderId || row.billingCycleId) && !permissions.canEdit) {
    return "Update permission is required to change an existing purchase order or invoice."
  }

  return null
}
