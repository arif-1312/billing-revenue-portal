import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findFirst, touchActiveLogin } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  touchActiveLogin: vi.fn(),
}));

vi.mock("@/lib/active-login", () => ({ touchActiveLogin }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique },
    auditLog: { findFirst },
  },
}));

import { readSessionDecision } from "./session-revocation";
import { passwordFingerprint } from "./password";

describe("session revocation lookup", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
    touchActiveLogin.mockReset();
    findUnique.mockResolvedValue({
      status: "ACTIVE",
      password: "$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij",
    });
  });

  it("does not keep a session when the logout lookup fails", async () => {
    findFirst.mockRejectedValue(new Error("database unavailable"));

    await expect(readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date("2026-10-26T00:00:00.000Z"),
      tokenFingerprint: "abc",
    })).rejects.toThrow(/database unavailable/);
  });

  it("invalidates a disabled account", async () => {
    findUnique.mockResolvedValue({ status: "INACTIVE", password: "hash" });
    findFirst.mockResolvedValue(null);

    await expect(readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date("2026-10-26T00:00:00.000Z"),
      tokenFingerprint: "abc",
    })).resolves.toBe("invalid");
  });

  it("rejects a missing, expired, or replaced active-login record", async () => {
    touchActiveLogin.mockResolvedValue(false);
    expect(await readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "old-session-id",
    })).toBe("invalid");
  });

  it("fails closed when the active-login database lookup fails", async () => {
    touchActiveLogin.mockRejectedValue(new Error("database unavailable"));
    await expect(readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "session-id",
    })).rejects.toThrow("database unavailable");
  });

  it("uses session ownership for logout, permitting a fresh login in the same second", async () => {
    touchActiveLogin.mockResolvedValue(true);
    expect(await readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "new-session-id",
    })).toBe("valid");
    expect(findFirst).not.toHaveBeenCalled();
  });
});
