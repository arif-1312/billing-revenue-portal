import { NextResponse } from "next/server"

import { auth, signOut } from "@/auth"
import { isSignedInSession } from "@/lib/session-decision"

type ClearedCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse["cookies"]["set"]>[2]
}

export async function GET(request: Request) {
  const session = await auth()
  if (isSignedInSession(session)) {
    return NextResponse.redirect(new URL("/admin/home", request.url))
  }

  const result = await signOut({ redirect: false })
  const response = NextResponse.redirect(new URL("/login", request.url))
  const clearedCookies =
    result && typeof result === "object" && "cookies" in result
      ? (result.cookies as ClearedCookie[] | undefined)
      : undefined

  for (const cookie of clearedCookies ?? []) {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  }

  return response
}
