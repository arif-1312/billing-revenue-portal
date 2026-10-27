export function applicationBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const raw =
    env.AUTH_URL?.trim() ||
    env.NEXT_PUBLIC_SERVER_URL?.trim() ||
    env.NEXT_APP_SERVER_URL?.trim() ||
    ""

  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.origin
  } catch {
    return ""
  }
}

export function applicationLink(
  href: string | null | undefined,
  base = applicationBaseUrl(),
) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null
  if (href.includes("\\") || href.includes("://") || /[\r\n\s]/.test(href)) return null
  if (!base) return null
  return `${base}${href}`
}
