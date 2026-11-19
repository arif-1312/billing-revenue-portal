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

  it("allows a session without a single-device registry entry", async () => {
    expect(await readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "old-session-id",
    })).toBe("valid");
    expect(touchActiveLogin).not.toHaveBeenCalled();
  });

  it("fails closed when the user lookup fails", async () => {
    findUnique.mockRejectedValue(new Error("database unavailable"));
    await expect(readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "session-id",
    })).rejects.toThrow("database unavailable");
  });

  it("keeps independently identified sessions valid", async () => {
    expect(await readSessionDecision({
      userId: "11111111-1111-4111-8111-111111111111",
      issuedAt: new Date(),
      tokenFingerprint: passwordFingerprint("$2b$12$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghij"),
      sessionId: "new-session-id",
    })).toBe("valid");
    expect(findFirst).not.toHaveBeenCalled();
  });
});
