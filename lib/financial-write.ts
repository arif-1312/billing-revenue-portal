import { Prisma } from "@prisma/client"

import { addMoney, moneyEquals } from "@/lib/money"
import {
  cycleIsPaid,
  importPaymentReplacementBlock,
  paidCycleChangeBlock,
  purchaseOrderUpdateBlock,
} from "@/lib/purchase-order-guard"

type WriteDb = Prisma.TransactionClient

export function normalizeInvoiceNumber(value?: string | null) {
  return (value ?? "").trim()
}

export function invoiceNumberKey(value?: string | null) {
  const normalized = normalizeInvoiceNumber(value)
  return normalized ? normalized.toLocaleLowerCase() : ""
}

/**
 * Lock purchase orders in a stable order so overlapping transactions wait
 * instead of racing past the closed-order check.
 */
export async function lockPurchaseOrders(db: WriteDb, ids: string[]) {
  const ordered = [...new Set(ids.filter(Boolean))].sort()

  for (const id of ordered) {
    await db.$queryRaw`
      SELECT "id"
      FROM "PurchaseOrder"
      WHERE "id" = CAST(${id} AS uuid)
      FOR UPDATE
    `
  }
}

type InvoiceClaim = {
  invoiceNumber?: string | null
  exceptId?: string | null
}

export async function assertInvoiceNumbersAvailable(
  db: WriteDb,
  claims: InvoiceClaim[],
) {
  const normalized = claims
    .map((claim) => ({
      exceptId: claim.exceptId || undefined,
      display: normalizeInvoiceNumber(claim.invoiceNumber),
      key: invoiceNumberKey(claim.invoiceNumber),
    }))
    .filter((claim) => claim.key)

  const exceptIds = normalized.flatMap((claim) =>
    claim.exceptId ? [claim.exceptId] : [],
  )

  const lockOrder = [...normalized].sort((left, right) =>
    left.key.localeCompare(right.key),
  )
  for (const claim of lockOrder) {
    await db.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${claim.key}))
    `
  }

  if (normalized.length === 0) return

  const found = await db.billingCycle.findMany({
    where: {
      OR: [
        ...normalized.map((claim) => ({
          invoiceNumber: { equals: claim.display, mode: "insensitive" as const },
        })),
        ...(exceptIds.length > 0 ? [{ id: { in: exceptIds } }] : []),
      ],
    },
    select: { id: true, invoiceNumber: true },
  })

  const currentKey = new Map(
    found.map((row) => [row.id, invoiceNumberKey(row.invoiceNumber)] as const),
  )
  const nextKeyById = new Map(
    normalized.flatMap((claim) =>
      claim.exceptId ? [[claim.exceptId, claim.key] as const] : [],
    ),
  )
  const introduces = (claim: (typeof normalized)[number]) => {
    if (!claim.exceptId) return true
    return currentKey.get(claim.exceptId) !== claim.key
  }
  const introducing = normalized.filter(introduces)

  const seen = new Set<string>()
  for (const claim of introducing) {
    if (seen.has(claim.key)) {
      throw new Error(`Invoice number ${claim.display} is repeated`)
    }
    seen.add(claim.key)
  }

  for (const claim of introducing) {
    const holders = found.filter(
      (row) => invoiceNumberKey(row.invoiceNumber) === claim.key,
    )

    for (const holder of holders) {
      if (holder.id === claim.exceptId) continue

      const holderNext = nextKeyById.get(holder.id)
      if (holderNext && holderNext !== claim.key) continue

      throw new Error(`Invoice number ${claim.display} already exists`)
    }
  }
}

type ImportRow = {
  excelRow: number
  purchaseOrderId: string
  billingCycleId: string
  invoiceNumber: string
  invoiceAmount: unknown
  creditNote: number | null
  collectedAmount: unknown
}

export async function guardRevenueImportWrite(
  db: WriteDb,
  rows: ImportRow[],
  actorIsSystem: boolean,
) {
  const hintedPurchaseOrderIds = rows.flatMap((row) =>
    row.purchaseOrderId ? [row.purchaseOrderId] : [],
  )
  const cycleIds = rows.flatMap((row) =>
    row.billingCycleId ? [row.billingCycleId] : [],
  )
  const linkedPurchaseOrders =
    cycleIds.length > 0
      ? await db.billingCycle.findMany({
          where: { id: { in: cycleIds } },
          select: { purchaseOrderId: true },
        })
      : []

  await lockPurchaseOrders(db, [
    ...hintedPurchaseOrderIds,
    ...linkedPurchaseOrders.map((cycle) => cycle.purchaseOrderId),
  ])

  const purchaseOrderIds = [
    ...new Set([
      ...hintedPurchaseOrderIds,
      ...linkedPurchaseOrders.map((cycle) => cycle.purchaseOrderId),
    ]),
  ]

  if (purchaseOrderIds.length > 0) {
    const orders = await db.purchaseOrder.findMany({
      where: { id: { in: [...new Set(purchaseOrderIds)] } },
      select: { id: true, status: true, updatedAt: true },
    })

    for (const order of orders) {
      const blocked = purchaseOrderUpdateBlock({
        status: order.status,
        actorIsSystem,
        currentUpdatedAt: order.updatedAt,
      })
      if (blocked) throw new Error(blocked)
    }
  }

  const cycles =
    cycleIds.length > 0
      ? await db.billingCycle.findMany({
          where: { id: { in: cycleIds } },
          include: { payments: true },
        })
      : []
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]))

  for (const cycle of cycles) {
    if (!purchaseOrderIds.includes(cycle.purchaseOrderId)) {
      throw new Error(
        "This purchase order was updated by someone else. Reload it and try again.",
      )
    }
  }

  for (const row of rows) {
    if (!row.billingCycleId) continue

    const cycle = cyclesById.get(row.billingCycleId)
    if (!cycle) {
      throw new Error(`Invoice on row ${row.excelRow} no longer exists`)
    }

    const paid = cycleIsPaid({
      paymentCount: cycle.payments.length,
      paymentReceived: cycle.paymentReceived,
    })
    if (
      paid &&
      !actorIsSystem &&
      row.purchaseOrderId &&
      row.purchaseOrderId !== cycle.purchaseOrderId
    ) {
      throw new Error("Paid billing cycles cannot be changed.")
    }
    const blocked = paidCycleChangeBlock({
      paid,
      actorIsSystem,
      invoiceAmountChanged: !moneyEquals(cycle.invoiceAmount, row.invoiceAmount),
      creditNoteChanged:
        row.creditNote != null && !moneyEquals(cycle.creditNote, row.creditNote),
    })
    if (blocked) throw new Error(blocked)

    const paymentTotal = cycle.payments.reduce(
      (total, payment) => addMoney(total, payment.amount),
      addMoney(0, 0),
    )
    const paymentBlock = importPaymentReplacementBlock({
      paymentCount: cycle.payments.length,
      paymentTotal,
      incomingCollected: row.collectedAmount,
    })
    if (paymentBlock) throw new Error(paymentBlock)
  }

  await assertInvoiceNumbersAvailable(
    db,
    rows.map((row) => ({
      invoiceNumber: row.invoiceNumber,
      exceptId: row.billingCycleId || undefined,
    })),
  )
}
