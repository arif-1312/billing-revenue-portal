"use server";

import { Role } from "@/types";
import { prisma } from "../prisma";
import { roleSchema } from "../validators";
import { formatError } from "../utils";
import { requirePermission } from "@/lib/rbac";

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

    await prisma.role.create({
      data: {
        ...payload,
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
    await prisma.role.update({
      where: { id },
      data: {
        ...payload,
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

    await prisma.role.delete({
      where: { id }
    })

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
