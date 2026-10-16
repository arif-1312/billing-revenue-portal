import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, findUnique, recordSecurityEvent } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findUnique: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

vi.mock("@/lib/security-event", () => ({
  recordSecurityEvent,
}));

import { canAccess, requirePermission } from "./rbac";

const email = "person@example.com";

function permissionUser({
  roleName = "Finance",
  status = "ACTIVE",
  canDelete = false,
}: {
  roleName?: string;
  status?: "ACTIVE" | "INACTIVE";
  canDelete?: boolean;
} = {}) {
  return {
    email,
    status,
    role: {
      name: roleName,
      roleModules: [
        {
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete,
          module: { route: "/admin/customer" },
        },
      ],
    },
  };
}

beforeEach(() => {
  authMock.mockReset();
  findUnique.mockReset();
  recordSecurityEvent.mockReset();
  authMock.mockResolvedValue({ user: { email } });
});

describe("permission checks", () => {
  it("rejects a request with no session and does not read the user", async () => {
    authMock.mockResolvedValue(null);

    const decision = await requirePermission("/admin/customer", "delete");

    expect(decision).toEqual({ ok: false, message: "Unauthorized" });
    expect(findUnique).not.toHaveBeenCalled();
    expect(recordSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PERMISSION_DENIED",
        result: "failure",
        route: "/admin/customer",
        action: "delete",
      }),
    );
  });

  it("rejects an active user who does not have the action", async () => {
    findUnique.mockResolvedValue(permissionUser());

    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(false);
    await expect(requirePermission("/admin/customer", "delete")).resolves.toEqual({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("rejects an inactive account", async () => {
    findUnique.mockResolvedValue(permissionUser({ status: "INACTIVE", canDelete: true }));

    await expect(canAccess("/admin/customer", "view")).resolves.toBe(false);
    await expect(requirePermission("/admin/customer", "view")).resolves.toEqual({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("allows only the exact admin role to bypass module permissions", async () => {
    findUnique.mockResolvedValue(permissionUser({ roleName: "Admin", canDelete: false }));
    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(true);

    findUnique.mockResolvedValue(
      permissionUser({ roleName: "Finance Admin", canDelete: false }),
    );
    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(false);

    findUnique.mockResolvedValue(permissionUser({ canDelete: true }));
    await expect(requirePermission("/admin/customer", "delete")).resolves.toEqual({
      ok: true,
    });
  });
});
