import { NextResponse } from "next/server"

import { signOut } from "@/auth"

type ClearedCookie = {
  name: string
  value: string
  options?: Parameters<NextResponse["cookies"]["set"]>[2]
}

export async function GET(request: Request) {
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
