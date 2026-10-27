type HeaderSource = {
  get(name: string): string | null
}

/**
 * The first X-Forwarded-For value is chosen by the caller.
 * IP limits are used only when TRUST_PROXY=true, and then the last hop is
 * the address appended by the proxy.
 */
export function clientAddress(
  headers?: HeaderSource | null,
  trustProxy = process.env.TRUST_PROXY === "true",
) {
  if (!trustProxy || !headers) return ""

  const forwarded = headers.get("x-forwarded-for")
  if (!forwarded) return ""

  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean)
  const last = hops[hops.length - 1] ?? ""

  if (!last || last.length > 80 || /[\s/]/.test(last)) return ""
  return last
}
