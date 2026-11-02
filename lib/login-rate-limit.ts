import { prisma } from "@/lib/prisma"
import {
  loginKeys,
  MemoryRateLimitStore,
  type RateLimitStore,
  type RateLimitState,
} from "@/lib/rate-limit-store"

const LIMIT = 5
const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 30 * 60 * 1000

export type LoginLimitState = {
  locked: boolean
  attemptsRemaining: number
  retryAfterSeconds: number
}

const memoryStore = new MemoryRateLimitStore()
let store: RateLimitStore = memoryStore
let lastPurgeAt = 0

async function purgeExpiredBuckets(now: number) {
  if (now - lastPurgeAt < 5 * 60 * 1000) return
  lastPurgeAt = now

  try {
    await prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(now) } },
    })
  } catch {
    console.error("Failed to purge expired rate limit buckets")
  }
}

export function useLoginRateLimitStore(next: RateLimitStore) {
  store = next
}

export function resetLoginRateLimitForTests() {
  memoryStore.clear()
  store = memoryStore
}

async function databaseCount(key: string, now = Date.now()) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT "count"
    FROM "RateLimitBucket"
    WHERE "key" = ${key} AND "resetAt" > ${new Date(now)}
  `
  return rows[0]?.count ?? 0
}

async function databaseIncrement(key: string, windowMs: number, now = Date.now()) {
  await purgeExpiredBuckets(now)
  const resetAt = new Date(now + windowMs)
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${new Date(now)} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${new Date(now)} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END
    RETURNING "count"
  `
  return rows[0]?.count ?? 1
}

function databaseStore(): RateLimitStore {
  return {
    async hit(key, limit, windowMs, now = Date.now()) {
      const count = await databaseIncrement(key, windowMs, now)
      return count <= limit
    },
    count: databaseCount,
    increment: databaseIncrement,
    async state(key, now = Date.now()) {
      const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
        SELECT "count", "resetAt" FROM "RateLimitBucket"
        WHERE "key" = ${key} AND "resetAt" > ${new Date(now)}
      `
      return rows[0] ? { count: rows[0].count, resetAt: rows[0].resetAt.getTime() } : null
    },
    async failure(key, limit, windowMs, lockMs, now = Date.now()) {
      await purgeExpiredBuckets(now)
      const at = new Date(now)
      const windowEnd = new Date(now + windowMs)
      const lockEnd = new Date(now + lockMs)
      const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
        INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
        VALUES (${key}, 1, ${windowEnd})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${at} THEN 1
            WHEN "RateLimitBucket"."count" >= ${limit} THEN "RateLimitBucket"."count"
            ELSE "RateLimitBucket"."count" + 1 END,
          "resetAt" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${at} THEN ${windowEnd}
            WHEN "RateLimitBucket"."count" = ${limit - 1} THEN ${lockEnd}
            ELSE "RateLimitBucket"."resetAt" END
        RETURNING "count", "resetAt"
      `
      if (!rows[0]) throw new Error("Login limit could not be recorded")
      return { count: rows[0].count, resetAt: rows[0].resetAt.getTime() }
    },
  }
}

async function activeStore() {
  if (process.env.APP_ENV !== "production") return store

  if (store !== memoryStore) return store
  store = databaseStore()
  return store
}

export async function reserveSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const count = await databaseIncrement(key, windowMs, now)
  return count <= limit
}

export async function loginIsLimited(username: string, ip: string, now = Date.now()) {
  return (await loginLimitState(username, ip, now)).locked
}

function limitState(buckets: Array<RateLimitState | null>, now: number): LoginLimitState {
  const count = Math.max(0, ...buckets.map((bucket) => bucket?.count ?? 0))
  const lockedUntil = Math.max(0, ...buckets.map((bucket) =>
    bucket && bucket.count >= LIMIT ? bucket.resetAt : 0,
  ))
  return {
    locked: lockedUntil > now,
    attemptsRemaining: Math.max(0, LIMIT - count),
    retryAfterSeconds: Math.max(0, Math.ceil((lockedUntil - now) / 1000)),
  }
}

export async function loginLimitState(username: string, ip: string, now = Date.now()): Promise<LoginLimitState> {
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  const buckets = await Promise.all([
    limiter.state(keys.account, now),
    ...(ip.trim() ? [limiter.state(keys.source, now)] : []),
  ])
  return limitState(buckets, now)
}

export async function recordSharedLoginFailure(
  username: string,
  ip: string,
  now = Date.now(),
) {
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  const writes = [limiter.failure(keys.account, LIMIT, WINDOW_MS, LOCK_MS, now)]
  if (ip.trim()) writes.push(limiter.failure(keys.source, LIMIT, WINDOW_MS, LOCK_MS, now))
  return limitState(await Promise.all(writes), now)
}

export async function clearSharedLoginFailures(username: string, ip: string) {
  const keys = loginKeys(username, ip)

  if (process.env.APP_ENV === "production") {
    const keysToClear = ip.trim()
      ? [keys.account, keys.source]
      : [keys.account]
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { in: keysToClear } },
    })
    return
  }

  memoryStore.clearKey(keys.account)
  if (ip.trim()) memoryStore.clearKey(keys.source)
  if (store instanceof MemoryRateLimitStore) {
    store.clearKey(keys.account)
    if (ip.trim()) store.clearKey(keys.source)
  }
}
