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

export async function loginIsLimited(username: string, ip: string, now = Date.now()) {
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  const [account, source] = await Promise.all([
    limiter.count(keys.account, now),
    limiter.count(keys.source, now),
  ])

  return account >= LIMIT || source >= LIMIT
}

export async function recordSharedLoginFailure(
  username: string,
  ip: string,
  now = Date.now(),
) {
  const keys = loginKeys(username, ip)
  const limiter = await activeStore()
  await Promise.all([
    limiter.increment(keys.account, WINDOW_MS, now),
    limiter.increment(keys.source, WINDOW_MS, now),
  ])
}

export async function clearSharedLoginFailures(username: string, ip: string) {
  const keys = loginKeys(username, ip)

  if (process.env.APP_ENV === "production") {
    await prisma.rateLimitBucket.deleteMany({
      where: { key: { in: [keys.account, keys.source] } },
    })
    return
  }

  memoryStore.clearKey(keys.account)
  memoryStore.clearKey(keys.source)
  if (store instanceof MemoryRateLimitStore) {
    store.clearKey(keys.account)
    store.clearKey(keys.source)
  }
}
