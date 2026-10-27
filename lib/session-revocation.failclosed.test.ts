import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, findFirst } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique },
    auditLog: { findFirst },
  },
}));

import { readSessionDecision } from "./session-revocation";

describe("session revocation lookup", () => {
  beforeEach(() => {
    findUnique.mockReset();
    findFirst.mockReset();
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
});
