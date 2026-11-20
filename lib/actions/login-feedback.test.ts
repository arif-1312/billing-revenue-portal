import { CredentialsSignin } from "@auth/core/errors"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { signIn, signOut, state } = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), state: vi.fn() }))
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn, signOut }))
vi.mock("@/lib/security-event", () => ({ recordSecurityEvent: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/rbac", () => ({ requirePermission: vi.fn(), getUserPermissions: vi.fn() }))
vi.mock("@/lib/login-rate-limit", () => ({ loginLimitState: state }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import { loginFormUser, logoutUser } from "./users"

beforeEach(() => vi.resetAllMocks())

function form() {
  const data = new FormData()
  data.set("username", "ada")
  data.set("password", "test-password")
  return data
}

describe("login form feedback", () => {
  it("sends users to the root login page after logout", async () => {
    await logoutUser()
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" })
  })

  it("opens the PO renewal dialog after a successful login", async () => {
    signIn.mockResolvedValue(undefined)

    await loginFormUser(null, form())

    expect(signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({
      username: "ada",
      redirectTo: "/admin/home?showPoRenewals=1",
    }))
  })

  it.each([4, 3, 2, 1])("shows %i attempts remaining after a wrong password", async (attemptsRemaining) => {
    signIn.mockRejectedValue(new CredentialsSignin())
    state.mockResolvedValue({ locked: false, attemptsRemaining, retryAfterSeconds: 0 })
    expect(await loginFormUser(null, form())).toMatchObject({
      success: false, attemptsRemaining,
      message: expect.stringContaining(`${attemptsRemaining} attempt`),
    })
  })

  it("shows a 30-minute lock warning on the fifth failure", async () => {
    signIn.mockRejectedValue(new CredentialsSignin())
    state.mockResolvedValue({ locked: true, attemptsRemaining: 0, retryAfterSeconds: 1800 })
    expect(await loginFormUser(null, form())).toMatchObject({
      success: false, attemptsRemaining: 0,
      message: "Too many failed attempts. Login is blocked. Try again in 30 minutes.",
    })
  })

  it("returns a recoverable error if the limiter database lookup fails", async () => {
    signIn.mockRejectedValue(new CredentialsSignin())
    state.mockRejectedValue(new Error("database unavailable"))
    expect(await loginFormUser(null, form())).toEqual({
      success: false, message: "Login could not be completed. Please try again.",
    })
  })
})
