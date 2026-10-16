import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, findFirst, findMany } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission,
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/security-event", () => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst,
      findMany,
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getUserById, getUsers } from "./users";

beforeEach(() => {
  requirePermission.mockReset();
  findFirst.mockReset();
  findMany.mockReset();
  requirePermission.mockResolvedValue({ ok: true });
});

describe("user lookups", () => {
  it("requests a user without the password hash", async () => {
    findFirst.mockResolvedValue({
      id: "user-1",
      username: "ada",
      email: "ada@example.com",
    });

    const result = await getUserById("user-1");

    expect(findFirst.mock.calls[0]?.[0].select).not.toHaveProperty("password");
    expect(result.data).not.toHaveProperty("password");
  });

  it("requests the user list without password hashes", async () => {
    findMany.mockResolvedValue([{ id: "user-1", username: "ada" }]);

    const users = await getUsers();

    expect(findMany.mock.calls[0]?.[0].select).not.toHaveProperty("password");
    expect(users[0]).not.toHaveProperty("password");
  });

  it("does not query users when the caller is not allowed", async () => {
    requirePermission.mockResolvedValue({
      ok: false,
      message: "Unauthorized",
    });

    await expect(getUsers()).resolves.toEqual([]);
    await expect(getUserById("user-1")).resolves.toEqual({
      success: false,
      message: "Unauthorized",
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
