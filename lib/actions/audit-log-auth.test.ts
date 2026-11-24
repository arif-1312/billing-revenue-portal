import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, getActiveCompanyContext, findMany, count } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getActiveCompanyContext: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission,
}));
vi.mock("@/lib/company-context", () => ({ getActiveCompanyContext }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany,
      count,
    },
  },
}));

import { getAuditLogs } from "./audit-log";

beforeEach(() => {
  requirePermission.mockReset();
  findMany.mockReset();
  count.mockReset();
  getActiveCompanyContext.mockReset();
});

describe("getAuditLogs", () => {
  it("does not query audit history without activity-log view permission", async () => {
    requirePermission.mockResolvedValue({
      ok: false,
      message: "Unauthorized",
    });

    await expect(getAuditLogs({})).resolves.toMatchObject({
      rows: [],
      total: 0,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it("limits audit history to the active company", async () => {
    requirePermission.mockResolvedValue({ ok: true });
    getActiveCompanyContext.mockResolvedValue({ companyId: "company-a" });
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await getAuditLogs({});

    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ companyId: "company-a" });
    expect(count.mock.calls[0]?.[0].where).toMatchObject({ companyId: "company-a" });
  });
});
