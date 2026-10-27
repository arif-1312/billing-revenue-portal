type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false

  bucket.count += 1
  return true
}

export function resetRateLimitsForTests() {
  buckets.clear()
}

export async function consumeActionRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  if (process.env.APP_ENV !== "production") {
    return consumeRateLimit(key, limit, windowMs, now)
  }

  const { reserveSharedRateLimit } = await import("@/lib/login-rate-limit")
  return reserveSharedRateLimit(`action:${key}`, limit, windowMs, now)
}
