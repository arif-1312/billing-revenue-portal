const BRANDING_PATH = /^\/uploads\/[A-Za-z0-9._-]+$/

export function safeBrandingPath(value: unknown) {
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (
    trimmed.includes("..") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.startsWith("//") ||
    !BRANDING_PATH.test(trimmed)
  ) {
    throw new Error("Branding image path is not valid")
  }

  return trimmed
}
