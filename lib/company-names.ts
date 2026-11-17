const CANONICAL_COMPANY_NAMES: Record<string, string> = {
  sy: "SY Associates",
  "s.y": "SY Associates",
  "s.y.": "SY Associates",
  "s y": "SY Associates",
  "sy associate": "SY Associates",
  "sy associates": "SY Associates",
  "s.y. associates": "SY Associates",
  "s y associates": "SY Associates",
  technosys: "Technosys",
  "techno sys": "Technosys",
  "technosys labs": "Technosys",
  "technosys lab": "Technosys",
  "technosyslabs": "Technosys",
}

export function normalizeCompanyKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export function canonicalCompanyName(name: string) {
  const key = normalizeCompanyKey(name)
  if (!key) return ""
  return CANONICAL_COMPANY_NAMES[key] ?? name.trim().replace(/\s+/g, " ")
}

export function isMappedCompanyName(name: string) {
  return normalizeCompanyKey(name) in CANONICAL_COMPANY_NAMES
}

export function isAllowedCompanyName(name: string) {
  return isMappedCompanyName(name)
}
