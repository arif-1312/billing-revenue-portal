import { maskEmailAddress, normalizeEmailAddress } from "./address"

export type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromName: string
  fromAddress: string
}

export type PublicSmtpStatus = {
  configured: boolean
  host: string | null
  port: string | null
  secure: boolean
  fromName: string
  fromAddressMasked: string | null
  userConfigured: boolean
  passwordConfigured: boolean
}

function validHost(host: string) {
  return /^[a-z0-9.-]+$/i.test(host) && !host.startsWith(".") && host.includes(".")
}

export function readSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim() ?? ""
  const user = env.SMTP_USER?.trim() ?? ""
  const password = env.SMTP_PASSWORD ?? ""
  const fromAddress = normalizeEmailAddress(env.SMTP_FROM_ADDRESS?.trim() || user)
  const portValue = Number(env.SMTP_PORT || (env.SMTP_SECURE === "true" ? 465 : 587))
  const secure = env.SMTP_SECURE === "true" || portValue === 465
  const fromName = env.SMTP_FROM_NAME?.trim() || "Billing & Revenue Portal"

  if (!host || !user || !password.trim() || !fromAddress) return null
  if (!validHost(host) || !Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
    return null
  }

  return {
    host,
    port: portValue,
    secure,
    user,
    password,
    fromName: fromName.slice(0, 120),
    fromAddress,
  }
}

export function publicSmtpStatus(env: NodeJS.ProcessEnv = process.env): PublicSmtpStatus {
  const config = readSmtpConfig(env)
  const port = env.SMTP_PORT?.trim() || (config ? String(config.port) : null)

  return {
    configured: Boolean(config),
    host: env.SMTP_HOST?.trim() || null,
    port,
    secure: config?.secure ?? env.SMTP_SECURE === "true",
    fromName: env.SMTP_FROM_NAME?.trim() || "Billing & Revenue Portal",
    fromAddressMasked: config ? maskEmailAddress(config.fromAddress) : null,
    userConfigured: Boolean(env.SMTP_USER?.trim()),
    passwordConfigured: Boolean(env.SMTP_PASSWORD?.trim()),
  }
}
