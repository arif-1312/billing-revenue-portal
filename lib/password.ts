import { createHash } from "node:crypto"

import bcrypt from "bcrypt"

export const BCRYPT_COST = 12

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST)
}

export function passwordFingerprint(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex")
}
