import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, updateUser, createAuditLog, claimActiveLogin } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateUser: vi.fn(),
  createAuditLog: vi.fn(),
  claimActiveLogin: vi.fn(),
}));

vi.mock("@/lib/active-login", () => ({ claimActiveLogin }));

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
import { resetLoginRateLimitForTests } from "./login-rate-limit";

const password = "correct-horse";
const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "development");
  resetLoginThrottleForTests();
  resetLoginRateLimitForTests();
  findFirst.mockReset();
  updateUser.mockReset();
  createAuditLog.mockReset();
  createAuditLog.mockResolvedValue({ id: userId });
  claimActiveLogin.mockReset();
  claimActiveLogin.mockResolvedValue("test-session-id");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it("allows the correct password after a single wrong password", async () => {
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });

    expect(await authorizeCredentials({ username: "ada", password: "wrong-password" }, "")).toBeNull();
    expect(await authorizeCredentials({ username: "ada", password }, "")).toMatchObject({ id: userId });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("blocks correct passwords for 30 minutes and unlocks exactly when the lock expires", async () => {
    const startedAt = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(startedAt);
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await authorizeCredentials({ username: "ada", password: "wrong-password" }, "203.0.113.4")).toBeNull();
    }
    const lookupsBeforeLockCheck = findFirst.mock.calls.length;
    clock.mockReturnValue(startedAt + 15 * 60 * 1000 - 1);
    expect(await authorizeCredentials({ username: "ada", password }, "203.0.113.4")).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(lookupsBeforeLockCheck);

    clock.mockReturnValue(startedAt + 30 * 60 * 1000 - 1);
    expect(await authorizeCredentials({ username: "ada", password }, "203.0.113.4")).toBeNull();
    clock.mockReturnValue(startedAt + 30 * 60 * 1000);
    expect(await authorizeCredentials({ username: "ada", password }, "203.0.113.4")).toMatchObject({ id: userId });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("starts the full 30-minute lock at the fifth failure rather than the first", async () => {
    const startedAt = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(startedAt);
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });

    await authorizeCredentials({ username: "ada", password: "wrong-password" }, "");
    clock.mockReturnValue(startedAt + 14 * 60 * 1000);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await authorizeCredentials({ username: "ada", password: "wrong-password" }, "");
    }
    expect(await authorizeCredentials({ username: "ada", password }, "")).toBeNull();
    clock.mockReturnValue(startedAt + 15 * 60 * 1000 + 1);
    expect(await authorizeCredentials({ username: "ada", password }, "")).toBeNull();
    clock.mockReturnValue(startedAt + 44 * 60 * 1000 - 1);
    expect(await authorizeCredentials({ username: "ada", password }, "")).toBeNull();
    clock.mockReturnValue(startedAt + 44 * 60 * 1000);
    expect(await authorizeCredentials({ username: "ada", password }, "")).toMatchObject({ id: userId });
  });

  it("keeps the account locked when the same user switches IP addresses", async () => {
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authorizeCredentials({ username: "ada", password: "wrong-password" }, "203.0.113.4");
    }
    expect(await authorizeCredentials({ username: "ada", password }, "203.0.113.9")).toBeNull();
  });

  it("resets the failure count after a successful login", async () => {
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });
    for (let round = 0; round < 2; round += 1) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await authorizeCredentials({ username: "ada", password: "wrong-password" }, "");
      }
      expect(await authorizeCredentials({ username: "ada", password }, "")).toMatchObject({ id: userId });
    }
  });

  it("allows separate sessions after validating the password", async () => {
    findFirst.mockResolvedValue({
      id: userId, username: "ada", status: "ACTIVE",
      password: await bcrypt.hash(password, 4), role: { name: "Finance" },
    });
    expect(await authorizeCredentials({ username: "ada", password: "wrong-password" }, "")).toBeNull();
    const first = await authorizeCredentials({ username: "ada", password }, "");
    const second = await authorizeCredentials({ username: "ada", password }, "");
    expect(first?.sessionId).toBeTruthy();
    expect(second?.sessionId).toBeTruthy();
    expect(first?.sessionId).not.toBe(second?.sessionId);
    expect(claimActiveLogin).not.toHaveBeenCalled();
  });
});
