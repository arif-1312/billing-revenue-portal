import { AsyncLocalStorage } from "node:async_hooks"

import { AuditAction, Prisma, PrismaClient } from "@prisma/client"

const UNAUDITED_MODELS = new Set([
  "AuditLog",
  "Notification",
  "NotificationReceipt",
  "EmailJob",
])

const CRITICAL_AUDIT_MODELS = new Set([
  "PurchaseOrder",
  "BillingCycle",
  "BillingCyclePayment",
  "Vendor",
])

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
])

const SINGLE_RECORD_OPERATIONS = new Set([
  "create",
  "update",
  "upsert",
  "delete",
])

const TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt"])

const CHILD_RELATIONS: Record<string, { model: string; foreignKey: string }[]> = {
  PurchaseOrder: [{ model: "BillingCycle", foreignKey: "purchaseOrderId" }],
  BillingCycle: [{ model: "BillingCyclePayment", foreignKey: "billingCycleId" }],
  Role: [{ model: "RoleModule", foreignKey: "roleId" }],
  Module: [{ model: "RoleModule", foreignKey: "moduleId" }],
  Project: [{ model: "ProjectMonthlyPL", foreignKey: "projectId" }],
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Row = Record<string, unknown>

type WriteArgs = {
  where?: Row
  data?: unknown
}

type Actor = {
  userId: string | null
  userName: string | null
}

type AuditDraft = {
  userId: string | null
  userName: string | null
  action: AuditAction
  model: string
  recordId: string | null
  before: Prisma.InputJsonValue | typeof Prisma.DbNull
  after: Prisma.InputJsonValue | typeof Prisma.DbNull
  changes: Prisma.InputJsonValue | typeof Prisma.DbNull
}

type ChildSnapshot = {
  model: string
  rows: Row[]
}

type BufferState = {
  events: AuditDraft[]
  actor?: Actor
  reader?: PrismaClient
}

type FinancialTransaction = <T>(
  fn: (tx: PrismaClient) => Promise<T>,
) => Promise<T>

let financialTransaction: FinancialTransaction | null = null

export function registerFinancialTransaction(run: FinancialTransaction) {
  financialTransaction = run
}

export function bindAuditReader(reader: PrismaClient | null) {
  const state = bufferStore.getStore()
  if (!state) return
  state.reader = reader ?? undefined
}

function auditReader(base: PrismaClient) {
  return bufferStore.getStore()?.reader ?? base
}

type AuditWriter = {
  auditLog: {
    createMany: (args: {
      data: Prisma.AuditLogCreateManyInput[]
    }) => Promise<unknown>
  }
}

export async function flushAuditEvents(writer: AuditWriter) {
  const state = bufferStore.getStore()
  if (!state || state.events.length === 0) return

  const events = state.events.splice(0, state.events.length)
  await persistEvents(writer, events)
}

export function stageFinancialAuditForTests() {
  const state = bufferStore.getStore()
  if (!state) throw new Error("Audit buffer is not open")

  state.events.push({
    userId: null,
    userName: "auditor",
    action: "UPDATE",
    model: "PurchaseOrder",
    recordId: "po-1",
    before: { status: "LIVE" },
    after: { status: "CLOSED" },
    changes: { status: { from: "LIVE", to: "CLOSED" } },
  })
}

type ModelDelegate = {
  findUnique: (args: { where: Row }) => Promise<Row | null>
  findMany: (args: { where?: Row }) => Promise<Row[]>
}

const bufferStore = new AsyncLocalStorage<BufferState>()
const actorLookup = new AsyncLocalStorage<true>()

const EMPTY_ACTOR: Actor = { userId: null, userName: null }

export async function runInAuditBuffer<T>(
  base: PrismaClient,
  fn: () => Promise<T>,
): Promise<T> {
  if (bufferStore.getStore()) {
    return fn()
  }

  const state: BufferState = { events: [] }

  const result = await bufferStore.run(state, fn)

  if (state.events.length === 0) return result

  try {
    await persistEvents(base, state.events)
  } catch (error) {
    console.error("Failed to record audit log", error)
    if (state.events.some((event) => CRITICAL_AUDIT_MODELS.has(event.model))) {
      throw error
    }
  }

  return result
}

export async function auditQuery({
  base,
  model,
  operation,
  args,
  query,
}: {
  base: PrismaClient
  model?: string
  operation: string
  args: unknown
  query: (args: unknown) => Promise<unknown>
}) {
  if (!model || UNAUDITED_MODELS.has(model) || !WRITE_OPERATIONS.has(operation)) {
    return query(args)
  }

  if (
    CRITICAL_AUDIT_MODELS.has(model) &&
    !bufferStore.getStore() &&
    financialTransaction
  ) {
    return financialTransaction(async (tx) => {
      const delegates = tx as unknown as Record<
        string,
        Record<string, (value: unknown) => Promise<unknown>> | undefined
      >
      const delegate = delegates[delegateName(model)]
      const method = delegate?.[operation]
      if (!delegate || typeof method !== "function") {
        throw new Error(`Cannot audit ${model}.${operation} inside a transaction.`)
      }
      return method.call(delegate, args)
    })
  }

  const writeArgs = (args ?? {}) as WriteArgs
  const inBuffer = Boolean(bufferStore.getStore())
  const expandChildren =
    SINGLE_RECORD_OPERATIONS.has(operation) &&
    !inBuffer &&
    Boolean(CHILD_RELATIONS[model])

  let beforeRows: Row[] = []
  let childBefore: ChildSnapshot[] = []

  try {
    beforeRows = await readBefore(auditReader(base), model, operation, writeArgs)

    if (expandChildren) {
      childBefore = await readChildren(
        auditReader(base),
        model,
        recordIdOf(null, writeArgs.where),
      )
    }
  } catch (error) {
    console.error("Failed to snapshot records for audit log", error)
    if (CRITICAL_AUDIT_MODELS.has(model)) throw error
  }

  const result = await query(args)

  try {
    const actor = await currentActor()
    let childAfter: ChildSnapshot[] = []

    if (expandChildren) {
      childAfter = await readChildren(
        auditReader(base),
        model,
        recordIdOf(result, writeArgs.where),
      )
    }

    const events = [
      ...eventsForOperation({
        model,
        operation,
        args: writeArgs,
        beforeRows,
        result,
        actor,
        includeNestedOnParent: !expandChildren,
      }),
      ...childEvents(actor, childBefore, childAfter),
    ]

    await enqueue(base, events)
  } catch (error) {
    console.error("Failed to record audit log", error)
    if (model && CRITICAL_AUDIT_MODELS.has(model)) {
      throw error
    }
  }

  return result
}

async function readBefore(
  base: PrismaClient,
  model: string,
  operation: string,
  args: WriteArgs,
) {
  const needsPrevious =
    operation === "update" ||
    operation === "updateMany" ||
    operation === "updateManyAndReturn" ||
    operation === "upsert" ||
    operation === "delete" ||
    operation === "deleteMany"

  if (!needsPrevious) return []

  const delegate = delegateFor(base, model)
  if (!delegate) return []

  if (
    operation === "updateMany" ||
    operation === "updateManyAndReturn" ||
    operation === "deleteMany"
  ) {
    return delegate.findMany({ where: args.where ?? {} })
  }

  if (!args.where) return []

  try {
    const row = await delegate.findUnique({ where: args.where })
    return row ? [row] : []
  } catch {
    return delegate.findMany({ where: args.where })
  }
}

async function readChildren(
  base: PrismaClient,
  model: string,
  parentId: string | null,
) {
  if (!parentId) return []

  const relations = CHILD_RELATIONS[model] ?? []
  const snapshots: ChildSnapshot[] = []

  for (const relation of relations) {
    const delegate = delegateFor(base, relation.model)
    if (!delegate) continue

    const rows = await delegate.findMany({
      where: { [relation.foreignKey]: parentId },
    })

    snapshots.push({ model: relation.model, rows })
  }

  return snapshots
}

function eventsForOperation({
  model,
  operation,
  args,
  beforeRows,
  result,
  actor,
  includeNestedOnParent,
}: {
  model: string
  operation: string
  args: WriteArgs
  beforeRows: Row[]
  result: unknown
  actor: Actor
  includeNestedOnParent: boolean
}) {
  const data = args.data

  if (operation === "createMany") {
    const count = affectedCount(result)
    if (count === 0) return []

    const items = Array.isArray(data) ? data : data == null ? [] : [data]
    return items.map((item) =>
      makeEvent({
        actor,
        action: AuditAction.CREATE,
        model,
        recordId: recordIdOf(item),
        before: null,
        after: item,
      }),
    )
  }

  if (operation === "createManyAndReturn" && Array.isArray(result)) {
    return result.map((row) =>
      makeEvent({
        actor,
        action: AuditAction.CREATE,
        model,
        recordId: recordIdOf(row),
        before: null,
        after: row,
      }),
    )
  }

  if (operation === "updateMany" || operation === "updateManyAndReturn") {
    const count = affectedCount(result)
    if (count === 0) return []

    if (operation === "updateManyAndReturn" && Array.isArray(result)) {
      return result.map((row) => {
        const before =
          beforeRows.find((item) => item.id != null && item.id === (row as Row).id) ??
          null

        return makeEvent({
          actor,
          action: AuditAction.UPDATE,
          model,
          recordId: recordIdOf(row),
          before,
          after: row,
        })
      })
    }

    if (beforeRows.length === 0) {
      return [
        makeEvent({
          actor,
          action: AuditAction.UPDATE,
          model,
          recordId: null,
          before: null,
          after: data,
        }),
      ]
    }

    return beforeRows.map((row) =>
      makeEvent({
        actor,
        action: AuditAction.UPDATE,
        model,
        recordId: recordIdOf(row),
        before: row,
        after: applyWriteData(asRow(toPlain(row)), data),
      }),
    )
  }

  if (operation === "deleteMany") {
    const count = affectedCount(result)
    if (count === 0) return []

    if (beforeRows.length === 0) {
      return [
        makeEvent({
          actor,
          action: AuditAction.DELETE,
          model,
          recordId: null,
          before: args.where ?? null,
          after: null,
        }),
      ]
    }

    return beforeRows.map((row) =>
      makeEvent({
        actor,
        action: AuditAction.DELETE,
        model,
        recordId: recordIdOf(row),
        before: row,
        after: null,
      }),
    )
  }

  if (operation === "delete") {
    const before = beforeRows[0] ?? (isRow(result) ? result : null)

    return [
      makeEvent({
        actor,
        action: AuditAction.DELETE,
        model,
        recordId: recordIdOf(before, args.where),
        before,
        after: null,
      }),
    ]
  }

  if (operation === "create" || operation === "update" || operation === "upsert") {
    const before = beforeRows[0] ?? null
    const action =
      operation === "update" || (operation === "upsert" && before)
        ? AuditAction.UPDATE
        : AuditAction.CREATE

    let after: unknown = isRow(result) ? result : data
    if (includeNestedOnParent) {
      after = withNestedWrites(after, data)
    }

    return [
      makeEvent({
        actor,
        action,
        model,
        recordId: recordIdOf(result, args.where) ?? recordIdOf(before),
        before: action === AuditAction.CREATE ? null : before,
        after,
      }),
    ]
  }

  return []
}

function childEvents(
  actor: Actor,
  beforeSnapshots: ChildSnapshot[],
  afterSnapshots: ChildSnapshot[],
) {
  const models = new Set([
    ...beforeSnapshots.map((snapshot) => snapshot.model),
    ...afterSnapshots.map((snapshot) => snapshot.model),
  ])

  const events: AuditDraft[] = []

  for (const model of models) {
    const before =
      beforeSnapshots.find((snapshot) => snapshot.model === model)?.rows ?? []
    const after =
      afterSnapshots.find((snapshot) => snapshot.model === model)?.rows ?? []

    events.push(...diffChildRows(actor, model, before, after))
  }

  return events
}

function diffChildRows(
  actor: Actor,
  model: string,
  beforeRows: Row[],
  afterRows: Row[],
) {
  const beforeById = new Map(beforeRows.map((row) => [rowKey(row), row]))
  const afterById = new Map(afterRows.map((row) => [rowKey(row), row]))
  const events: AuditDraft[] = []

  for (const [key, before] of beforeById) {
    const after = afterById.get(key)

    if (!after) {
      events.push(
        makeEvent({
          actor,
          action: AuditAction.DELETE,
          model,
          recordId: recordIdOf(before),
          before,
          after: null,
        }),
      )
      continue
    }

    const changes = diffChanges(toPlain(before), toPlain(after))
    if (Object.keys(changes).length === 0) continue

    events.push(
      makeEvent({
        actor,
        action: AuditAction.UPDATE,
        model,
        recordId: recordIdOf(after),
        before,
        after,
      }),
    )
  }

  for (const [key, after] of afterById) {
    if (beforeById.has(key)) continue

    events.push(
      makeEvent({
        actor,
        action: AuditAction.CREATE,
        model,
        recordId: recordIdOf(after),
        before: null,
        after,
      }),
    )
  }

  return events
}

function makeEvent({
  actor,
  action,
  model,
  recordId,
  before,
  after,
}: {
  actor: Actor
  action: AuditAction
  model: string
  recordId: string | null
  before: unknown
  after: unknown
}): AuditDraft {
  const beforePlain = before == null ? null : toPlain(before)
  const afterPlain = after == null ? null : toPlain(after)

  return {
    userId: actor.userId,
    userName: actor.userName,
    action,
    model,
    recordId,
    before: asJson(redactTree(beforePlain)),
    after: asJson(redactTree(afterPlain)),
    changes: asJson(diffChanges(beforePlain, afterPlain)),
  }
}

async function enqueue(base: PrismaClient, events: AuditDraft[]) {
  if (events.length === 0) return

  const state = bufferStore.getStore()
  if (state) {
    state.events.push(...events)
    return
  }

  await persistEvents(base, events)
}

async function persistEvents(writer: AuditWriter, events: AuditDraft[]) {
  const chunkSize = 100

  for (let index = 0; index < events.length; index += chunkSize) {
    await writer.auditLog.createMany({
      data: events.slice(index, index + chunkSize),
    })
  }
}

async function currentActor(): Promise<Actor> {
  const state = bufferStore.getStore()
  if (state?.actor) return state.actor

  const actor = actorLookup.getStore()
    ? EMPTY_ACTOR
    : await actorLookup.run(true, resolveActor)

  if (state) state.actor = actor
  return actor
}

async function resolveActor(): Promise<Actor> {
  try {
    const { auth } = await import("@/auth")
    const session = await auth()
    const user = session?.user as
      | { id?: string; name?: string | null; email?: string | null }
      | undefined

    return {
      userId: user?.id && UUID_PATTERN.test(user.id) ? user.id : null,
      userName: user?.name?.trim() || user?.email?.trim() || null,
    }
  } catch {
    return EMPTY_ACTOR
  }
}

function delegateName(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function delegateFor(base: PrismaClient, model: string) {
  const delegate = (base as unknown as Record<string, ModelDelegate | undefined>)[
    delegateName(model)
  ]

  if (!delegate?.findMany || !delegate.findUnique) return null
  return delegate
}

function applyWriteData(before: Row, data: unknown) {
  const next = { ...before }
  if (!isRow(data)) return next

  for (const [key, value] of Object.entries(data)) {
    next[key] = toPlain(value)
  }

  return next
}

function withNestedWrites(after: unknown, data: unknown) {
  const row = isRow(after) ? { ...asRow(toPlain(after)) } : {}
  if (!isRow(data)) return isRow(after) ? after : null

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object") {
      row[key] = toPlain(value)
    }
  }

  return row
}

function affectedCount(result: unknown) {
  if (!isRow(result) || result.count == null) return null
  const count = result.count
  if (typeof count === "number") return count
  if (typeof count === "bigint") return Number(count)
  return null
}

function recordIdOf(value: unknown, where?: unknown) {
  if (isRow(value) && isScalarId(value.id)) return String(value.id)
  if (isRow(where) && isScalarId(where.id)) return String(where.id)
  return null
}

function isScalarId(value: unknown) {
  return typeof value === "string" || typeof value === "number"
}

function rowKey(row: Row) {
  if (isScalarId(row.id)) return String(row.id)
  return JSON.stringify(sortKeys(toPlain(row)))
}

function diffChanges(before: unknown, after: unknown) {
  const left = isRow(before) ? before : null
  const right = isRow(after) ? after : null
  const keys = new Set([
    ...Object.keys(left ?? {}),
    ...Object.keys(right ?? {}),
  ])
  const changes: Row = {}

  for (const key of keys) {
    if (TIMESTAMP_FIELDS.has(key)) continue

    const from = left?.[key] ?? null
    const to = right?.[key] ?? null
    if (stable(from) === stable(to)) continue

    const secret = key.toLowerCase() === "password"
    changes[key] = {
      from: secret ? "[redacted]" : redactTree(from),
      to: secret ? "[redacted]" : redactTree(to),
    }
  }

  return changes
}

function asJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value == null) return Prisma.DbNull
  return value as Prisma.InputJsonValue
}

function redactTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactTree(item))
  if (!isRow(value)) return value

  const redacted: Row = {}

  for (const [key, child] of Object.entries(value)) {
    redacted[key] =
      key.toLowerCase() === "password" ? "[redacted]" : redactTree(child)
  }

  return redacted
}

function toPlain(value: unknown): unknown {
  if (value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (Prisma.Decimal.isDecimal(value)) return value.toString()
  if (Array.isArray(value)) return value.map((item) => toPlain(item))

  if (isRow(value)) {
    const plain: Row = {}

    for (const [key, child] of Object.entries(value)) {
      plain[key] = toPlain(child)
    }

    return plain
  }

  return value
}

function stable(value: unknown) {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item))
  if (!isRow(value)) return value

  const sorted: Row = {}

  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeys(value[key])
  }

  return sorted
}

function asRow(value: unknown) {
  return isRow(value) ? value : {}
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
