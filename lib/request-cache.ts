import * as React from "react"

type Cache = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
) => (...args: Args) => Result

const reactCache = (React as { cache?: Cache }).cache

/**
 * Deduplicate a function for the current server request when React's
 * request cache is active. Outside a request, including unit tests, the
 * function runs normally.
 */
export function requestCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  if (!reactCache) return fn
  return reactCache(fn)
}
