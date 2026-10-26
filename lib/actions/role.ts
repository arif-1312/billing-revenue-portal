"use server";

import { Role } from "@/types";
import { prisma } from "../prisma";
import { roleSchema } from "../validators";
import { formatError } from "../utils";
import { getUserPermissions, requirePermission } from "@/lib/rbac";
import {
  roleChangeDecision,
  unauthorizedGrant,
  type PermissionFlags,
  type RequestedModuleGrant,
} from "@/lib/privilege";
import { recordSecurityEvent } from "@/lib/security-event";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

function permissionFingerprint(
  modules: Array<{
    moduleId?: string;
    canView?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  }> | undefined,
) {
  return (modules ?? [])
    .map((module) =>
      [
        module.moduleId,
        module.canView,
        module.canCreate,
        module.canEdit,
        module.canDelete,
      ].join(":"),
    )
    .sort()
    .join(",");
}

function actorGrantMap(user: Awaited<ReturnType<typeof getUserPermissions>>) {
  const grants = new Map<string, PermissionFlags>();

  if (!user?.role || user.role.status !== "ACTIVE") return grants;

  for (const roleModule of user.role.roleModules) {
    if (roleModule.module.status !== "ACTIVE") continue;
    grants.set(roleModule.moduleId, {
      canView: roleModule.canView,
      canCreate: roleModule.canCreate,
      canEdit: roleModule.canEdit,
      canDelete: roleModule.canDelete,
    });
  }

  return grants;
}

function requestedGrants(modules: unknown): RequestedModuleGrant[] {
  if (!Array.isArray(modules)) return [];

  return modules.flatMap((module) => {
    if (!module || typeof module !== "object") return [];
    const record = module as Record<string, unknown>;
    const moduleId = typeof record.moduleId === "string" ? record.moduleId : "";
    if (!moduleId) return [];

    return [{
      moduleId,
      canView: Boolean(record.canView),
      canCreate: Boolean(record.canCreate),
      canEdit: Boolean(record.canEdit),
      canDelete: Boolean(record.canDelete),
    }];
  });
}

async function privilegeEvent(
  eventAction: string,
  result: "success" | "failure",
) {
  const actor = await getUserPermissions();
  await recordSecurityEvent({
    event: "PRIVILEGE_CHANGE",
    username: actor?.email,
    userId: actor?.id,
    result,
    route: "/admin/roles",
    action: eventAction,
  });
}

function normalizeRolePayload(role: Role) {
  const name = role.name?.trim();

  if (!name) {
    throw new Error("Role name is required");
  }

  return {
    name,
    remark: role.remark ?? null,
    status: role.status ?? "ACTIVE",
  } as const;
}

export async function getRoles() {
  const access = await requirePermission("/admin/roles", "view", [
    { route: "/admin/users", action: "create" },
    { route: "/admin/users", action: "edit" },
  ]);
  if (!access.ok) return [];

  return await prisma.role.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      roleModules: true
    }
  })
}

export async function createRole(data: any) {

  try {
    const access = await requirePermission("/admin/roles", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const role = roleSchema.parse(data)
    const payload = normalizeRolePayload(role)
    const actor = await getUserPermissions()
    const actorIsSystem = Boolean(
      actor?.role?.isSystem && actor.role.status === "ACTIVE",
    )
    const grants = requestedGrants(data.modules)
    const decision = roleChangeDecision({
      actorIsSystem,
      targetIsSystem: false,
      nextStatus: payload.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      renamesRole: false,
      grantsExceedActor:
        !actorIsSystem &&
        Boolean(unauthorizedGrant(actorGrantMap(actor), grants)),
    })

    if (!decision.ok) {
      await privilegeEvent("create", "failure")
      return { success: false, message: decision.message }
    }

    const created = await prisma.role.create({
      data: {
        ...payload,
        isSystem: false,
        roleModules: {
          create: data.modules.map((m: any) => ({
            moduleId: m.moduleId,
            canView: m.canView,
            canCreate: m.canCreate,
            canEdit: m.canEdit,
            canDelete: m.canDelete,
          })),
        },
      },
    });

    await safePublishSystem({
      eventType: "SYSTEM_USER_ACTIVITY",
      entityType: "Role",
      entityId: created.id,
      title: "Role created",
      body: `Role ${payload.name} was created.`,
      href: "/admin/roles",
      fingerprint: fingerprint([
        "created",
        payload.name,
        permissionFingerprint(data.modules),
      ]),
    });

    await privilegeEvent("create", "success")

    return {
      success: true,
      message: "role created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getRoleById(id: string) {
  try {
    const access = await requirePermission("/admin/roles", "view", [
      { route: "/admin/roles", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let role = await prisma.role.findFirst({
      where: { id },
      include: {
        roleModules: true
      }
    })

    if (role) {
      return {
        success: true,
        data: role,
        message: "Role fetched successfully"
      }
    }

    return {
      success: false,
      message: "Role not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}


export async function updateRole(data: any, id: string) {
  try {
    const access = await requirePermission("/admin/roles", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const role = roleSchema.parse(data)
    const payload = normalizeRolePayload(role)
    const [actor, existing] = await Promise.all([
      getUserPermissions(),
      prisma.role.findUnique({
        where: { id },
        select: { id: true, name: true, isSystem: true, status: true },
      }),
    ])

    if (!existing) {
      return { success: false, message: "Role not found" }
    }

    const actorIsSystem = Boolean(
      actor?.role?.isSystem && actor.role.status === "ACTIVE",
    )
    const decision = roleChangeDecision({
      actorIsSystem,
      targetIsSystem: existing.isSystem,
      nextStatus: payload.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      renamesRole: existing.name !== payload.name,
      grantsExceedActor:
        !actorIsSystem &&
        Boolean(unauthorizedGrant(actorGrantMap(actor), requestedGrants(data.modules))),
    })

    if (!decision.ok) {
      await privilegeEvent("edit", "failure")
      return { success: false, message: decision.message }
    }

    await prisma.role.update({
      where: { id },
      data: {
        ...payload,
        isSystem: existing.isSystem,
        roleModules: {
          deleteMany: {}, // deletes all existing roleModules for this role
          create: data.modules.map((m: any) => ({
            moduleId: m.moduleId,
            canView: m.canView,
            canCreate: m.canCreate,
            canEdit: m.canEdit,
            canDelete: m.canDelete,
          })),
        },
      },
    });

    await safePublishSystem({
      eventType: "SYSTEM_USER_ACTIVITY",
      entityType: "Role",
      entityId: id,
      title: "Role permissions updated",
      body: `Role ${payload.name} permissions were updated.`,
      href: "/admin/roles",
      fingerprint: fingerprint([
        "updated",
        payload.name,
        payload.status,
        permissionFingerprint(data.modules),
      ]),
    });

    await privilegeEvent("edit", "success")

    return {
      success: true,
      message: "Role updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteRole(id: any) {
  try {
    const access = await requirePermission("/admin/roles", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const existing = await prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true, isSystem: true },
    });

    if (existing?.isSystem) {
      await privilegeEvent("delete", "failure")
      return {
        success: false,
        message: "The system administrator role cannot be changed.",
      }
    }

    await prisma.role.delete({
      where: { id }
    })

    if (existing) {
      await safePublishSystem({
        eventType: "SYSTEM_USER_ACTIVITY",
        entityType: "Role",
        entityId: existing.id,
        title: "Role removed",
        body: `Role ${existing.name} was removed.`,
        href: "/admin/roles",
        fingerprint: "deleted",
        priority: "HIGH",
      });
    }

    await privilegeEvent("delete", "success")

    return {
      success: true,
      message: "Role deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
