import type { NextAuthConfig } from "next-auth"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { captured, readSessionDecision, releaseActiveLogin } = vi.hoisted(() => ({
  captured: { config: null as NextAuthConfig | null },
  readSessionDecision: vi.fn(),
  releaseActiveLogin: vi.fn(),
}))
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => {
  captured.config = config
  return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }
} }))
vi.mock("@/lib/credentials", () => ({ authorizeCredentials: vi.fn() }))
vi.mock("@/lib/session-revocation", () => ({ readSessionDecision }))
vi.mock("@/lib/active-login", () => ({ releaseActiveLogin }))

import "../auth"

type JwtCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>

beforeEach(() => {
  vi.resetAllMocks()
  readSessionDecision.mockResolvedValue("valid")
})

describe("Auth.js session integration", () => {
  it("copies the server-issued session identifier into the JWT", async () => {
    const jwt = captured.config!.callbacks!.jwt!
    const result = await jwt({
      token: {},
      user: { id: "user-1", role: "Finance", sessionId: "owned-session", credentialVersion: "version-1" },
      trigger: "signIn",
    } as Parameters<JwtCallback>[0])
    expect(result).toMatchObject({ role: "Finance", sessionId: "owned-session", credentialVersion: "version-1", invalid: false })
  })

  it("rejects legacy JWTs without a registered session", async () => {
    const jwt = captured.config!.callbacks!.jwt!
    const result = await jwt({ token: { id: "user-1", iat: 1, lastActive: Date.now() } } as unknown as Parameters<JwtCallback>[0])
    expect(result).toMatchObject({ invalid: true })
    expect(readSessionDecision).not.toHaveBeenCalled()
  })

  it("checks session ownership when renewing a JWT and fails closed on a database error", async () => {
    readSessionDecision.mockRejectedValue(new Error("database unavailable"))
    const jwt = captured.config!.callbacks!.jwt!
    const result = await jwt({ token: {
      id: "user-1", iat: 1, lastActive: Date.now(), sessionId: "owned-session", credentialVersion: "version-1",
    } } as unknown as Parameters<JwtCallback>[0])
    expect(readSessionDecision).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", sessionId: "owned-session" }))
    expect(result).toMatchObject({ invalid: true })
  })

})
