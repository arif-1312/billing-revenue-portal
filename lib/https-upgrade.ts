export function httpsUpgradeUrl(input: {
  appEnv?: string | null
  proto?: string | null
  host?: string | null
  path?: string | null
}) {
  if (input.appEnv !== "production") return null
  if (input.proto !== "http") return null

  const host = input.host?.trim() ?? ""
  if (!host || host.includes("/") || /[\r\n]/.test(host)) return null
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return null

  const path = input.path && input.path.startsWith("/") ? input.path : "/"
  return `https://${host}${path}`
}
