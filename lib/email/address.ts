const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function normalizeEmailAddress(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? ""
  if (
    email.length < 3 ||
    email.length > 254 ||
    email.includes("..") ||
    /[\r\n\s]/.test(email) ||
    !EMAIL_PATTERN.test(email)
  ) {
    return null
  }
  return email
}

export function normalizeEmailList(values: Array<string | null | undefined>) {
  const unique = new Set<string>()
  for (const value of values) {
    const email = normalizeEmailAddress(value)
    if (email) unique.add(email)
  }
  return [...unique]
}

export function maskEmailAddress(value: string) {
  const email = normalizeEmailAddress(value)
  if (!email) return "Configured"
  const [local, domain] = email.split("@")
  return `${local.slice(0, 1)}***@${domain}`
}
