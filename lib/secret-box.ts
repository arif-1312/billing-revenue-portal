import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

const PREFIX = "enc:v1:"

let cachedKey: { material: string; key: Buffer } | null = null

export function secretKeyMaterial() {
  const raw =
    process.env.CONFIG_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    ""

  if (raw.length < 16) {
    throw new Error("CONFIG_ENCRYPTION_KEY or AUTH_SECRET must be at least 16 characters.")
  }

  if (cachedKey?.material === raw) return cachedKey.key

  const key = scryptSync(raw, "billing-config-v1", 32)
  cachedKey = { material: raw, key }
  return key
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", secretKeyMaterial(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`
}

export function decryptSecret(stored: string) {
  if (!stored.startsWith(PREFIX)) {
    throw new Error("Secret is not in the current encrypted format.")
  }

  const body = stored.slice(PREFIX.length)
  const [ivPart, tagPart, dataPart] = body.split(".")
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Secret is not in the current encrypted format.")
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    secretKeyMaterial(),
    Buffer.from(ivPart, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export function isSecretConfigured(stored?: string | null) {
  return Boolean(stored?.trim())
}
