import { describe, expect, it } from "vitest"

import { passwordMeetsPolicy } from "./validators"
import {
  RESET_REQUEST_MESSAGE,
  hashResetToken,
  resetExpiry,
  resetPasswordUrl,
  tokenIsUsable,
} from "./password-reset"

describe("password reset tokens", () => {
  it("stores a hash instead of the raw token and expires in 15 minutes", () => {
    const now = new Date("2026-10-27T08:00:00.000Z")
    const token = "a".repeat(43)
    const hash = hashResetToken(token)

    expect(hash).not.toContain(token)
    expect(hash).toHaveLength(64)
    expect(resetExpiry(now).getTime() - now.getTime()).toBe(15 * 60 * 1000)
  })

  it("rejects expired and used tokens", () => {
    const now = new Date("2026-10-27T08:00:00.000Z")
    expect(tokenIsUsable({
      usedAt: null,
      expiresAt: new Date(now.getTime() + 1000),
      now,
    })).toBe(true)
    expect(tokenIsUsable({
      usedAt: now,
      expiresAt: new Date(now.getTime() + 1000),
      now,
    })).toBe(false)
    expect(tokenIsUsable({
      usedAt: null,
      expiresAt: now,
      now,
    })).toBe(false)
  })

  it("builds only an application reset link", () => {
    const token = "abc".repeat(16)
    expect(resetPasswordUrl("http://localhost:3000", token)).toBe(
      `http://localhost:3000/reset-password?token=${encodeURIComponent(token)}`,
    )
    expect(resetPasswordUrl("javascript:alert(1)", token)).toBeNull()
    expect(resetPasswordUrl("", token)).toBeNull()
  })

  it("uses one generic response for every reset request", () => {
    expect(RESET_REQUEST_MESSAGE).not.toMatch(/not found|does not exist|unknown/i)
  })

  it("blocks common passwords that otherwise meet the length rule", () => {
    expect(passwordMeetsPolicy("Welcome12345")).toBe(false)
    expect(passwordMeetsPolicy("Harbor-Light-42")).toBe(true)
  })
})
