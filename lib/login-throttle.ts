const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000

type AttemptBucket = {
  count: number
  resetAt: number
}

const attempts = new Map<string, AttemptBucket>()

function attemptKey(username: string) {
  return username.trim().toLowerCase()
}

export function isLoginLocked(username: string, now = Date.now()) {
  const key = attemptKey(username)
  const bucket = attempts.get(key)

  if (!bucket) return false

  if (now > bucket.resetAt) {
    attempts.delete(key)
    return false
  }

  return bucket.count >= MAX_FAILURES
}

export function recordLoginFailure(username: string, now = Date.now()) {
  const key = attemptKey(username)
  const bucket = attempts.get(key)

  if (!bucket || now > bucket.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  bucket.count += 1
}

export function clearLoginFailures(username: string) {
  attempts.delete(attemptKey(username))
}

export function resetLoginThrottleForTests() {
  attempts.clear()
}
