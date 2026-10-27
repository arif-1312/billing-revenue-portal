import { prisma } from "@/lib/prisma"
import {
  loginKeys,
  MemoryRateLimitStore,
  type RateLimitStore,
} from "@/lib/rate-limit-store"

const LIMIT = 5
const WINDOW_MS = 15 * 60 * 1000

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
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  const account = await limiter.count(keys.account, now)
  if (account >= LIMIT) return true
  if (!ip.trim()) return false

  const source = await limiter.count(keys.source, now)
  return source >= LIMIT
}

export async function recordSharedLoginFailure(
  username: string,
  ip: string,
  now = Date.now(),
) {
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  const writes = [limiter.increment(keys.account, WINDOW_MS, now)]
  if (ip.trim()) writes.push(limiter.increment(keys.source, WINDOW_MS, now))
  await Promise.all(writes)
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
