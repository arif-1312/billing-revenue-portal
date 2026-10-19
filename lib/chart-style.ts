export function cssIdentifier(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : null
}

export function cssColor(value: string) {
  return /^[#(),.%\sA-Za-z0-9_-]+$/.test(value) ? value : null
}
