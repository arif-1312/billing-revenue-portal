const CANONICAL_CUSTOMER_NAMES: Record<string, string> = {
  shofu: "SHOFU DENTAL INDIA PVT LTD",
  sofu: "SHOFU DENTAL INDIA PVT LTD",
  "shofu dental india pvt ltd": "SHOFU DENTAL INDIA PVT LTD",
  hitachi: "Hitachi systems India Pvt Ltd",
  "hitach advanced payment ntpc": "Hitachi systems India Pvt Ltd",
  "hitachi systems india pvt ltd": "Hitachi systems India Pvt Ltd",
  "niveshan technologies": "Niveshan Technologies India Pvt Ltd",
  "niveshan technologies india pvt ltd": "Niveshan Technologies India Pvt Ltd",
  identiqa: "Identiqa Consulting Private Limited",
  "identiqa consulting private limited": "Identiqa Consulting Private Limited",
  quess: "Quess Corp Ltd",
  "quess corp ltd": "Quess Corp Ltd",
  "quess crop ltd": "Quess Corp Ltd",
  savex: "SAVEX TECHNOLOGIES PRIVATE LIMITED",
  "savex .technogies(p)": "SAVEX TECHNOLOGIES PRIVATE LIMITED",
  "savex technologies private limited": "SAVEX TECHNOLOGIES PRIVATE LIMITED",
  acument: "Acumant Technologies Private Limited",
  "acumant technologies private limited": "Acumant Technologies Private Limited",
  exato: "Exato",
  "exato technologies private limited": "Exato",
  "exato technologies pvt ltd": "Exato",
  "exato-sy": "Exato",
  "exato- sy": "Exato",
  "exato- technosysy": "Exato",
  glorich: "Glorich India Private Limited",
  "glorich india private limited": "Glorich India Private Limited",
  inflow: "Inflow Technologies Private Limited",
  "inflow technologies private limited": "Inflow Technologies Private Limited",
  biztec: "BizTech Solutions Inc",
  "biztech solutions inc": "BizTech Solutions Inc",
  "bizbiztech solutions inc": "BizTech Solutions Inc",
  "metaco intelligence private limited": "Metaco Intelligence Private Limited",
  "metaco intelligence private limited((zoth)": "Metaco Intelligence Private Limited",
  "metaco intelligence corporation": "Metaco Intelligence Private Limited",
  "technosys lab uk": "Technosys Labs UK Limited",
  "technosys labs uk limited": "Technosys Labs UK Limited",
  nec: "NEC Corporation India Pvt Ltd",
  "nec corporation india pvt ltd": "NEC Corporation India Pvt Ltd",
  tasl: "TATA ADVANCED SYSTEMS LIMITED",
  "tata advance systems limited": "TATA ADVANCED SYSTEMS LIMITED",
  "tata advanced systems limited": "TATA ADVANCED SYSTEMS LIMITED",
  iex: "INDIAN ENERGY EXCHANGE LIMITED",
  "indian energy exchange limited": "INDIAN ENERGY EXCHANGE LIMITED",
  "simultaneous geographical reality labs pvt ltd":
    "Simultaneous Geographical Reality Labs Private Limited",
  "simultaneous geographical reality labs private limited":
    "Simultaneous Geographical Reality Labs Private Limited",
}

export function normalizeCustomerKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

export function canonicalCustomerName(name: string) {
  const key = normalizeCustomerKey(name)
  if (!key) return ""
  return CANONICAL_CUSTOMER_NAMES[key] ?? name.trim().replace(/\s+/g, " ")
}

export function isMappedCustomerName(name: string) {
  return normalizeCustomerKey(name) in CANONICAL_CUSTOMER_NAMES
}
