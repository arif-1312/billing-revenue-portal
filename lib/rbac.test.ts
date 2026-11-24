import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, getMembership, recordSecurityEvent } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getMembership: vi.fn(),
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/company-context", () => ({ getActiveCompanyMembership: getMembership }));

vi.mock("@/lib/security-event", () => ({
  recordSecurityEvent,
}));

import { canAccess, getAllowedRoute, requirePermission } from "./rbac";

const email = "person@example.com";

function permissionUser({
  roleName = "Finance",
  status = "ACTIVE",
  roleStatus = "ACTIVE",
  moduleStatus = "ACTIVE",
  canDelete = false,
}: {
  roleName?: string;
  status?: "ACTIVE" | "INACTIVE";
  roleStatus?: "ACTIVE" | "INACTIVE";
  moduleStatus?: "ACTIVE" | "INACTIVE";
  canDelete?: boolean;
} = {}) {
  return {
    email,
    status,
    role: {
      name: roleName,
      status: roleStatus,
      isSystem: false,
      roleModules: [
        {
          canView: true,
          canCreate: false,
          canEdit: false,
          canDelete,
          module: { route: "/admin/customer", status: moduleStatus },
        },
      ],
    },
  };
}

beforeEach(() => {
  authMock.mockReset();
  getMembership.mockReset();
  recordSecurityEvent.mockReset();
  authMock.mockResolvedValue({ user: { id: "user-1", email, activeCompanyId: "company-1" } });
});

describe("permission checks", () => {
  it("rejects a request with no session and does not read the user", async () => {
    authMock.mockResolvedValue(null);

    const decision = await requirePermission("/admin/customer", "delete");

    expect(decision).toEqual({ ok: false, message: "Unauthorized" });
    expect(getMembership).not.toHaveBeenCalled();
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
    getMembership.mockResolvedValue({ user: permissionUser(), role: permissionUser().role, company: { id: "company-1" }, companyId: "company-1" });

    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(false);
    await expect(requirePermission("/admin/customer", "delete")).resolves.toEqual({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("rejects an inactive account", async () => {
    getMembership.mockResolvedValue({ user: permissionUser({ status: "INACTIVE", canDelete: true }), role: permissionUser({ status: "INACTIVE", canDelete: true }).role, company: { id: "company-1" }, companyId: "company-1" });

    await expect(canAccess("/admin/customer", "view")).resolves.toBe(false);
    await expect(requirePermission("/admin/customer", "view")).resolves.toEqual({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("does not grant access because a role is named Admin", async () => {
    getMembership.mockResolvedValue({ user: permissionUser({ roleName: "Admin", canDelete: false }), role: permissionUser({ roleName: "Admin", canDelete: false }).role, company: { id: "company-1" }, companyId: "company-1" });
    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(false);

    getMembership.mockResolvedValue({ user: permissionUser({ roleName: "admin", canDelete: false }), role: permissionUser({ roleName: "admin", canDelete: false }).role, company: { id: "company-1" }, companyId: "company-1" });
    await expect(canAccess("/admin/customer", "delete")).resolves.toBe(false);

    const user = permissionUser({ canDelete: true });
    getMembership.mockResolvedValue({ user, role: user.role, company: { id: "company-1" }, companyId: "company-1" });
    await expect(requirePermission("/admin/customer", "delete")).resolves.toEqual({
      ok: true,
    });
  });

  it("denies a disabled role and a disabled module", async () => {
    const inactiveRole = permissionUser({ roleStatus: "INACTIVE", canDelete: true });
    getMembership.mockResolvedValue({ user: inactiveRole, role: inactiveRole.role, company: { id: "company-1" }, companyId: "company-1" });
    await expect(canAccess("/admin/customer", "view")).resolves.toBe(false);

    const inactiveModule = permissionUser({ moduleStatus: "INACTIVE", canDelete: true });
    getMembership.mockResolvedValue({ user: inactiveModule, role: inactiveModule.role, company: { id: "company-1" }, companyId: "company-1" });
    await expect(requirePermission("/admin/customer", "delete")).resolves.toEqual({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("loads the permission record once for every action on a route", async () => {
    const user = permissionUser({ canDelete: true });
    getMembership.mockResolvedValue({ user, role: user.role, company: { id: "company-1" }, companyId: "company-1" });

    await expect(getAllowedRoute("/admin/customer")).resolves.toBe("/admin/customer");
    expect(getMembership).toHaveBeenCalledTimes(1);
  });
});
