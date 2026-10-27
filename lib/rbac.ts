import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { requestCache } from "@/lib/request-cache"
import { recordSecurityEvent } from "@/lib/security-event"

export type PermissionAction = "view" | "create" | "edit" | "delete"

export type PermissionRule = {
  route: string
  action: PermissionAction
}

export const UNAUTHORIZED_MESSAGE = "Unauthorized"

type PermissionUser = NonNullable<Awaited<ReturnType<typeof loadPermissionUser>>>

async function readPermissionUser() {
  const session = await auth()
  const email = session?.user?.email

  if (!email) return

  return loadPermissionUser(email)
}

export const getUserPermissions = requestCache(readPermissionUser)

async function loadPermissionUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          roleModules: {
            include: {
              module: true,
            },
          },
        },
      },
    },
  })

  if (!user || user.status !== "ACTIVE") return

  return user
}

export async function canAccess(route: string, action: string) {
  const user = await getUserPermissions()
  return userCan(user, route, action)
}

export async function requirePermission(
  route: string,
  action: PermissionAction,
  also: PermissionRule[] = [],
) {
  const session = await auth()
  const email = session?.user?.email

  if (!email) {
    await recordSecurityEvent({
      event: "PERMISSION_DENIED",
      result: "failure",
      route,
      action,
    })
    return { ok: false as const, message: UNAUTHORIZED_MESSAGE }
  }

  const user = await getUserPermissions()
  const allowed = [{ route, action }, ...also].some((rule) =>
    userCan(user, rule.route, rule.action),
  )

  if (!allowed) {
    await recordSecurityEvent({
      event: "PERMISSION_DENIED",
      username: email,
      result: "failure",
      route,
      action,
    })
    return { ok: false as const, message: UNAUTHORIZED_MESSAGE }
  }

  return { ok: true as const }
}

export function visibleRoute(
  user: PermissionUser | null | undefined,
  route: string,
) {
  if (
    userCan(user, route, "view") ||
    userCan(user, route, "create") ||
    userCan(user, route, "edit") ||
    userCan(user, route, "delete")
  ) {
    return route
  }

  return ""
}

export async function getAllowedRoute(route: string) {
  return visibleRoute(await getUserPermissions(), route)
}

function userCan(
  user: PermissionUser | null | undefined,
  route: string,
  action: string,
) {
  if (!user || user.status !== "ACTIVE") return false
  if (!user.role || user.role.status !== "ACTIVE") return false

  const permission = user.role.roleModules?.find(
    (roleModule) =>
      roleModule.module.route === route && roleModule.module.status === "ACTIVE",
  )

  if (!permission) return false

  if (action === "view") return !!permission.canView
  if (action === "create") return !!permission.canCreate
  if (action === "edit") return !!permission.canEdit
  if (action === "delete") return !!permission.canDelete

  return false
}
