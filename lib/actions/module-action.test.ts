import { beforeEach, describe, expect, it, vi } from "vitest";

const { update, requirePermission } = vi.hoisted(() => ({
  update: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { module: { update } } }));
vi.mock("@/lib/rbac", () => ({ requirePermission }));

import { updateModule } from "./module-action";

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({ ok: true });
});

describe("module permissions", () => {
  it("preserves the route that role permissions use when a module is renamed", async () => {
    await expect(updateModule({ name: "Profit and Loss", description: "P&L" }, "module-id"))
      .resolves.toMatchObject({ success: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "module-id" },
      data: { name: "Profit and Loss", description: "P&L", status: "ACTIVE" },
    });
  });

  it("rejects module updates without edit permission", async () => {
    requirePermission.mockResolvedValue({ ok: false, message: "Unauthorized" });
    await expect(updateModule({ name: "P&L", description: "P&L" }, "module-id"))
      .resolves.toEqual({ success: false, message: "Unauthorized" });
    expect(update).not.toHaveBeenCalled();
  });
});
