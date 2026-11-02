import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { parse } from "dotenv"
import { Pool } from "pg"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { database } = vi.hoisted(() => ({ database: { run: vi.fn() } }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => database.run(strings, values, true),
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => database.run(strings, values, false),
    // Avoid global housekeeping in a test that owns only its fixture rows.
    rateLimitBucket: { deleteMany: async () => ({ count: 0 }) },
  },
}))

import { claimActiveLogin, releaseActiveLogin, touchActiveLogin } from "./active-login"
import { loginLimitState, recordSharedLoginFailure, resetLoginRateLimitForTests } from "./login-rate-limit"
import { IDLE_TIMEOUT_MS, SESSION_MAX_AGE_SECONDS } from "./session-decision"

// Explicit opt-in; the guard below permits only the project's local dev DB.
describe.skipIf(process.env.RUN_AUTH_DATABASE_TESTS !== "1")("PostgreSQL login enforcement", () => {
  let pool: Pool
  const userId = randomUUID()
  const roleId = randomUUID()
  const username = `auth-test-${randomUUID()}`
  const now = Date.UTC(2026, 9, 30, 10)

  beforeAll(async () => {
    const env = parse(readFileSync(".env.local"))
    const url = new URL(env.DATABASE_URL)
    if (env.APP_ENV !== "development" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/billing_revenue_dev") {
      throw new Error("Authentication integration tests require the local development database")
    }
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 })
    database.run.mockImplementation(async (strings: TemplateStringsArray, values: unknown[], rows: boolean) => {
      const sql = strings.reduce((result, part, index) => result + (index ? `$${index}` : "") + part, "")
      const result = await pool.query(sql, values)
      return rows ? result.rows : result.rowCount
    })
    await pool.query('INSERT INTO "Role" (id, name, "updatedAt") VALUES ($1, $2, NOW())', [roleId, username])
    await pool.query('INSERT INTO "User" (id, username, password, "firstName", "lastName", email, "roleId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
      [userId, username, "integration-test-no-login", "Auth", "Test", `${username}@example.invalid`, roleId])
  })

  beforeEach(async () => {
    vi.stubEnv("APP_ENV", "production") // Exercise the actual database limiter SQL.
    resetLoginRateLimitForTests()
    await pool.query('DELETE FROM "ActiveLogin" WHERE "userId" = $1', [userId])
    await pool.query('DELETE FROM "RateLimitBucket" WHERE key = $1', [`login:account:${username}`])
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    if (!pool) return
    try {
      await pool.query('DELETE FROM "RateLimitBucket" WHERE key = $1', [`login:account:${username}`])
      await pool.query('DELETE FROM "User" WHERE id = $1', [userId])
      await pool.query('DELETE FROM "Role" WHERE id = $1', [roleId])
    } finally {
      await pool.end()
    }
  })

  it("permits exactly one of several concurrent devices to claim an account", async () => {
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimActiveLogin(userId, "version-1", now)))
    const winners = claims.filter((value): value is string => value !== null)
    expect(winners).toHaveLength(1)
    expect(await touchActiveLogin(userId, winners[0], "version-1", now + 1)).toBe(true)
    const stored = await pool.query('SELECT "sessionHash" FROM "ActiveLogin" WHERE "userId" = $1', [userId])
    expect(stored.rows[0].sessionHash).not.toBe(winners[0])
  })

  it("allows login after logout and prevents an old device from releasing the new session", async () => {
    const first = await claimActiveLogin(userId, "version-1", now)
    expect(first).toBeTruthy()
    expect(await claimActiveLogin(userId, "version-1", now + 1)).toBeNull()
    await releaseActiveLogin(userId, first!)
    const second = await claimActiveLogin(userId, "version-1", now + 2)
    expect(second).toBeTruthy()
    await releaseActiveLogin(userId, first!)
    expect(await touchActiveLogin(userId, second!, "version-1", now + 3)).toBe(true)
    expect(await touchActiveLogin(userId, first!, "version-1", now + 3)).toBe(false)
  })

  it("allows a new device after idle expiry, but an expired token cannot renew itself", async () => {
    const first = await claimActiveLogin(userId, "version-1", now)
    expect(await touchActiveLogin(userId, first!, "version-1", now + IDLE_TIMEOUT_MS)).toBe(false)
    const second = await claimActiveLogin(userId, "version-1", now + IDLE_TIMEOUT_MS)
    expect(second).toBeTruthy()
    expect(await touchActiveLogin(userId, first!, "version-1", now + IDLE_TIMEOUT_MS + 1)).toBe(false)
  })

  it("replaces a session after a password change and rejects the old credential version", async () => {
    const first = await claimActiveLogin(userId, "version-1", now)
    const second = await claimActiveLogin(userId, "version-2", now + 1)
    expect(second).toBeTruthy()
    expect(await touchActiveLogin(userId, first!, "version-1", now + 2)).toBe(false)
    expect(await touchActiveLogin(userId, second!, "version-2", now + 2)).toBe(true)
  })

  it("enforces absolute session expiry even when the session was recently active", async () => {
    const first = await claimActiveLogin(userId, "version-1", now)
    const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000
    await pool.query('UPDATE "ActiveLogin" SET "lastActiveAt" = $1 WHERE "userId" = $2', [new Date(expiresAt - 1), userId])
    expect(await touchActiveLogin(userId, first!, "version-1", expiresAt)).toBe(false)
    expect(await claimActiveLogin(userId, "version-1", expiresAt)).toBeTruthy()
  })

  it("starts the database lock at the fifth failure and unlocks after exactly 30 minutes", async () => {
    expect((await recordSharedLoginFailure(username, "", now)).attemptsRemaining).toBe(4)
    const fifthAt = now + 14 * 60 * 1000
    for (let failure = 0; failure < 4; failure += 1) await recordSharedLoginFailure(username, "", fifthAt)
    expect(await loginLimitState(username, "", fifthAt)).toEqual({ locked: true, attemptsRemaining: 0, retryAfterSeconds: 1800 })
    const expiresAt = fifthAt + 30 * 60 * 1000
    await recordSharedLoginFailure(username, "", expiresAt - 1)
    expect((await loginLimitState(username, "", expiresAt - 1)).locked).toBe(true)
    expect(await loginLimitState(username, "", expiresAt)).toEqual({ locked: false, attemptsRemaining: 5, retryAfterSeconds: 0 })
  })

  it("records concurrent failures atomically without extending the initial lock", async () => {
    await Promise.all(Array.from({ length: 7 }, () => recordSharedLoginFailure(username, "", now)))
    expect(await loginLimitState(username, "", now)).toEqual({ locked: true, attemptsRemaining: 0, retryAfterSeconds: 1800 })
  })
})
