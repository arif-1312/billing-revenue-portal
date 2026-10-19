export function isAllowedMutationOrigin(
  origin: string | null,
  host: string | null,
) {
  if (!origin || origin === "null" || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
