import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { IDLE_TIMEOUT_MS, SESSION_MAX_AGE_SECONDS } from "@/lib/session-decision"

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex")
}

/** Claim the account's single active session, replacing only an expired session. */
export async function claimActiveLogin(userId: string, credentialVersion: string, now = Date.now()) {
  const sessionId = randomBytes(32).toString("hex")
  const hash = sessionHash(sessionId)
  const at = new Date(now)
  const idleCutoff = new Date(now - IDLE_TIMEOUT_MS)
  const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000)
  const claimed = await prisma.$queryRaw<Array<{ userId: string }>>`
    INSERT INTO "ActiveLogin" ("userId", "sessionHash", "credentialVersion", "lastActiveAt", "expiresAt")
    VALUES (CAST(${userId} AS uuid), ${hash}, ${credentialVersion}, ${at}, ${expiresAt})
    ON CONFLICT ("userId") DO UPDATE SET
      "sessionHash" = EXCLUDED."sessionHash",
      "credentialVersion" = EXCLUDED."credentialVersion",
      "createdAt" = ${at},
      "lastActiveAt" = EXCLUDED."lastActiveAt",
      "expiresAt" = EXCLUDED."expiresAt"
    WHERE "ActiveLogin"."expiresAt" <= ${at}
       OR "ActiveLogin"."lastActiveAt" <= ${idleCutoff}
       OR "ActiveLogin"."credentialVersion" <> EXCLUDED."credentialVersion"
    RETURNING "userId"
  `
  return claimed.length === 1 ? sessionId : null
}

/** Old or replaced tokens can neither renew nor release the current session. */
export async function touchActiveLogin(userId: string, sessionId: string, credentialVersion: string, now = Date.now()) {
  if (!sessionId || !credentialVersion) return false
  const changed = await prisma.$executeRaw`
    UPDATE "ActiveLogin" SET "lastActiveAt" = ${new Date(now)}
    WHERE "userId" = CAST(${userId} AS uuid)
      AND "sessionHash" = ${sessionHash(sessionId)}
      AND "credentialVersion" = ${credentialVersion}
      AND "expiresAt" > ${new Date(now)}
      AND "lastActiveAt" > ${new Date(now - IDLE_TIMEOUT_MS)}
  `
  return changed === 1
}

export async function releaseActiveLogin(userId: string, sessionId: string) {
  if (!userId || !sessionId) return
  await prisma.$executeRaw`
    DELETE FROM "ActiveLogin"
    WHERE "userId" = CAST(${userId} AS uuid)
      AND "sessionHash" = ${sessionHash(sessionId)}
  `
}
