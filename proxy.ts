import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { isAllowedMutationOrigin } from "@/lib/origin-check"

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

export function proxy(request: NextRequest) {
  if (!MUTATING.has(request.method)) return NextResponse.next()

  const allowed = isAllowedMutationOrigin(
    request.headers.get("origin"),
    request.headers.get("host"),
  )

  if (allowed) return NextResponse.next()

  return NextResponse.json(
    { success: false, message: "Unauthorized" },
    { status: 403 },
  )
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
