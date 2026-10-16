import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, findMany, count } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission,
}));

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
});
