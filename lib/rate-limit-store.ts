export type RateLimitStore = {
  hit(key: string, limit: number, windowMs: number, now?: number): Promise<boolean>
  count(key: string, now?: number): Promise<number>
  increment(key: string, windowMs: number, now?: number): Promise<number>
  state(key: string, now?: number): Promise<RateLimitState | null>
  failure(key: string, limit: number, windowMs: number, lockMs: number, now?: number): Promise<RateLimitState>
}

export type RateLimitState = {
  count: number
  resetAt: number
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, RateLimitState>()

  async hit(key: string, limit: number, windowMs: number, now = Date.now()) {
    const bucket = this.buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    if (bucket.count >= limit) return false

    bucket.count += 1
    return true
  }

  async count(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key)
    if (!bucket || now >= bucket.resetAt) return 0
    return bucket.count
  }

  async increment(key: string, windowMs: number, now = Date.now()) {
    const bucket = this.buckets.get(key)
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return 1
    }
    bucket.count += 1
    return bucket.count
  }

  async state(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key)
    return bucket && bucket.resetAt > now ? { ...bucket } : null
  }

  async failure(key: string, limit: number, windowMs: number, lockMs: number, now = Date.now()) {
    let bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      this.buckets.set(key, bucket)
    }
    if (bucket.count < limit) {
      bucket.count += 1
      if (bucket.count === limit) bucket.resetAt = now + lockMs
    }
    return { ...bucket }
  }

  clear() {
    this.buckets.clear()
  }

  clearKey(key: string) {
    this.buckets.delete(key)
  }
}

export function loginKeys(username: string, ip: string) {
  const account = username.trim().toLowerCase()
  const source = ip.trim().toLowerCase() || "unknown"
  return {
    account: `login:account:${account}`,
    source: `login:ip:${source}`,
  }
}
