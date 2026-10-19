import bcrypt from "bcrypt"

import { prisma } from "@/lib/prisma"
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from "@/lib/login-throttle"
import { recordSecurityEvent } from "@/lib/security-event"
import { passwordFingerprint } from "@/lib/password"

type Credentials = {
  username?: unknown
  password?: unknown
} | null | undefined

export async function authorizeCredentials(credentials: Credentials) {
  const username =
    typeof credentials?.username === "string" ? credentials.username.trim() : ""
  const password =
    typeof credentials?.password === "string" ? credentials.password : ""

  if (!username || !password) {
    return null
  }

  if (isLoginLocked(username)) {
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

  const passwordMatches = Boolean(
    user?.password && (await bcrypt.compare(password, user.password)),
  )

  if (!user || !passwordMatches || user.status !== "ACTIVE") {
    recordLoginFailure(username)
    await recordSecurityEvent({
      event: "LOGIN_FAILURE",
      username,
      result: "failure",
    })
    return null
  }

  clearLoginFailures(username)
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
