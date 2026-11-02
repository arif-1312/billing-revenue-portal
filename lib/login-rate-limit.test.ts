import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { loginIsLimited, loginLimitState, recordSharedLoginFailure, resetLoginRateLimitForTests } from "./login-rate-limit"

beforeEach(() => {
  vi.stubEnv("APP_ENV", "development")
  resetLoginRateLimitForTests()
})
afterEach(() => vi.unstubAllEnvs())

describe("login failure policy", () => {
  it("reports the remaining attempts and locks on the fifth failure", async () => {
    for (let failure = 1; failure <= 5; failure += 1) {
      const result = await recordSharedLoginFailure(" Ada ", "", 1000)
      expect(result.attemptsRemaining).toBe(5 - failure)
      expect(result.locked).toBe(failure === 5)
    }
    expect(await loginLimitState("ada", "", 1000)).toEqual({
      locked: true, attemptsRemaining: 0, retryAfterSeconds: 1800,
    })
  })

  it("starts lockout at the fifth failure and does not extend it for blocked requests", async () => {
    await recordSharedLoginFailure("ada", "", 1000)
    const fifthAt = 1000 + 14 * 60 * 1000
    for (let failure = 0; failure < 4; failure += 1) await recordSharedLoginFailure("ada", "", fifthAt)
    const expiresAt = fifthAt + 30 * 60 * 1000
    await recordSharedLoginFailure("ada", "", expiresAt - 1)
    expect(await loginIsLimited("ada", "", expiresAt - 1)).toBe(true)
    expect(await loginLimitState("ada", "", expiresAt)).toEqual({
      locked: false, attemptsRemaining: 5, retryAfterSeconds: 0,
    })
  })

  it("resets sub-threshold failures after the 15-minute observation window", async () => {
    for (let failure = 0; failure < 4; failure += 1) await recordSharedLoginFailure("ada", "", 1000)
    expect((await recordSharedLoginFailure("ada", "", 1000 + 15 * 60 * 1000)).attemptsRemaining).toBe(4)
  })
})
