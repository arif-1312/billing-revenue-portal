import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, updateUser, createAuditLog } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateUser: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst,
      update: updateUser,
    },
    auditLog: {
      create: createAuditLog,
    },
  },
}));

import { authorizeCredentials } from "./credentials";
import { resetLoginThrottleForTests } from "./login-throttle";

const password = "correct-horse";
const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  resetLoginThrottleForTests();
  findFirst.mockReset();
  updateUser.mockReset();
  createAuditLog.mockReset();
  createAuditLog.mockResolvedValue({ id: userId });
});

describe("credential authorization", () => {
  it("returns an active user without the password hash", async () => {
    findFirst.mockResolvedValue({
      id: userId,
      username: "ada",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      status: "ACTIVE",
      password: await bcrypt.hash(password, 4),
      role: { name: "Admin" },
    });

    const result = await authorizeCredentials({
      username: "ada",
      password,
    });

    expect(result).toMatchObject({
      id: userId,
      username: "ada",
      role: "Admin",
      firstName: "Ada",
    });
    expect(result).not.toHaveProperty("password");
    expect(updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify(createAuditLog.mock.calls)).not.toContain(password);
  });

  it("rejects an inactive account with the same result as a bad password", async () => {
    findFirst.mockResolvedValue({
      id: userId,
      username: "ada",
      status: "INACTIVE",
      password: await bcrypt.hash(password, 4),
      role: { name: "Admin" },
    });

    await expect(
      authorizeCredentials({ username: "ada", password }),
    ).resolves.toBeNull();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a correct password after five failures", async () => {
    findFirst.mockResolvedValue({
      id: userId,
      username: "ada",
      status: "ACTIVE",
      password: await bcrypt.hash(password, 4),
      role: { name: "Finance" },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        authorizeCredentials({ username: "ada", password: "wrong-password" }),
      ).resolves.toBeNull();
    }

    await expect(
      authorizeCredentials({ username: "ada", password }),
    ).resolves.toBeNull();
  });
});
