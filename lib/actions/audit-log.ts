import { AuditAction, Prisma } from "@prisma/client"

import {
  auditChanges,
  summarizeAuditChanges,
  type ActivityLogRow,
} from "../audit-format"
import { prisma } from "../prisma"
import { requirePermission } from "@/lib/rbac"

export const AUDIT_PAGE_SIZE = 20

export const AUDIT_MODELS = [
  "BillingCycle",
  "BillingPlan",
  "Company",
  "Configuration",
  "ContractDuration",
  "ContractType",
  "Customer",
  "Module",
  "Project",
  "ProjectMonthlyPL",
  "PurchaseOrder",
  "Role",
  "RoleModule",
  "ServiceType",
  "User",
  "Vendor",
]

type AuditLogQuery = {
  q?: string
  model?: string
  action?: string
  page?: string
}

export async function getAuditLogs(query: AuditLogQuery) {
  const access = await requirePermission("/admin/activity-log", "view")
  if (!access.ok) {
    return {
      rows: [],
      total: 0,
      page: 1,
      pageSize: AUDIT_PAGE_SIZE,
      q: "",
      model: "",
      action: "",
      models: AUDIT_MODELS,
    }
  }

  const q = query.q?.trim().slice(0, 100) || ""
  const model = query.model?.trim().slice(0, 64) || ""
  const action = isAuditAction(query.action) ? query.action : ""
  const requestedPage = Number.parseInt(query.page || "1", 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  const where: Prisma.AuditLogWhereInput = {}

  if (model) where.model = model
  if (action) where.action = action

  if (q) {
    where.OR = [
      { userName: { contains: q, mode: "insensitive" } },
      { recordId: { contains: q, mode: "insensitive" } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    rows: rows.map(serializeAuditLog),
    total,
    page,
    pageSize: AUDIT_PAGE_SIZE,
    q,
    model,
    action,
    models: AUDIT_MODELS,
  }
}

function serializeAuditLog(row: {
  id: string
  createdAt: Date
  userName: string | null
  action: AuditAction
  model: string
  recordId: string | null
  before: Prisma.JsonValue
  after: Prisma.JsonValue
  changes: Prisma.JsonValue
}): ActivityLogRow {
  const changes = auditChanges(row.changes)

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userName: row.userName,
    action: row.action,
    model: row.model,
    recordId: row.recordId,
    summary: summarizeAuditChanges(row.action, changes),
    before: row.before,
    after: row.after,
    changes,
  }
}

function isAuditAction(value: string | undefined): value is AuditAction {
  return value === "CREATE" || value === "UPDATE" || value === "DELETE"
}
