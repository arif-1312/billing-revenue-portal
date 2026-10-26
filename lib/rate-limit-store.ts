export type RateLimitStore = {
  hit(key: string, limit: number, windowMs: number, now?: number): Promise<boolean>
  count(key: string, now?: number): Promise<number>
  increment(key: string, windowMs: number, now?: number): Promise<number>
}

type Bucket = {
  count: number
  resetAt: number
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>()

  async hit(key: string, limit: number, windowMs: number, now = Date.now()) {
    const bucket = this.buckets.get(key)

    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    if (bucket.count >= limit) return false

    bucket.count += 1
    return true
  }

  async count(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key)
    if (!bucket || now > bucket.resetAt) return 0
    return bucket.count
  }

  async increment(key: string, windowMs: number, now = Date.now()) {
    const bucket = this.buckets.get(key)
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return 1
    }
    bucket.count += 1
    return bucket.count
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
