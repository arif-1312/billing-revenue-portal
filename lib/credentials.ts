import bcrypt from "bcrypt"

import { prisma } from "@/lib/prisma"
import {
  clearSharedLoginFailures,
  loginIsLimited,
  recordSharedLoginFailure,
} from "@/lib/login-rate-limit"
import { recordSecurityEvent } from "@/lib/security-event"
import { passwordFingerprint } from "@/lib/password"

type Credentials = {
  username?: unknown
  password?: unknown
} | null | undefined

const DUMMY_PASSWORD_HASH =
  "$2b$12$fhISTPUZkdjPrgA9UY6Ux.sRWDp9AjSK8s/eJMrMOnLC3R0oQ9xbS"

export async function authorizeCredentials(
  credentials: Credentials,
  ip = "unknown",
) {
  const username =
    typeof credentials?.username === "string" ? credentials.username.trim() : ""
  const password =
    typeof credentials?.password === "string" ? credentials.password : ""

  if (!username || !password) {
    return null
  }

  if (await loginIsLimited(username, ip)) {
    await recordSecurityEvent({
      event: "LOGIN_FAILURE",
      username,
      result: "failure",
    })
    return null
  }

  const user = await prisma.user.findFirst({
    where: { username },
    include: { role: true },
  })

  const passwordMatches = await bcrypt.compare(
    password,
    user?.password || DUMMY_PASSWORD_HASH,
  )

  if (!user || !passwordMatches || user.status !== "ACTIVE") {
    await recordSharedLoginFailure(username, ip)
    await recordSecurityEvent({
      event: "LOGIN_FAILURE",
      username,
      result: "failure",
    })
    return null
  }

  await clearSharedLoginFailures(username, ip)
  await recordSecurityEvent({
    event: "LOGIN_SUCCESS",
    username: user.username,
    userId: user.id,
    result: "success",
  })

  return {
    id: user.id,
    username: user.username ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email ?? "",
    role: user.role?.name ?? "USER",
    credentialVersion: passwordFingerprint(user.password),
  }
}
