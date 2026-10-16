"use server";

import { Role } from "@/types";
import { prisma } from "../prisma";
import { serviceTypeSchema } from "../validators";
import { formatError } from "../utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";

const revenueReaders: PermissionRule[] = [
  { route: "/admin/revenue", action: "view" },
  { route: "/admin/revenue", action: "create" },
  { route: "/admin/revenue", action: "edit" },
];

function normalizeServiceTypePayload(serviceType: {
  name?: string;
  remark?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}) {
  const name = serviceType.name?.trim();

  if (!name) {
    throw new Error("Service type name is required");
  }

  return {
    name,
    remark: serviceType.remark ?? null,
    status: serviceType.status ?? "ACTIVE",
  } as const;
}

export async function getServiceTypes() {
  const access = await requirePermission("/admin/service-type", "view", revenueReaders);
  if (!access.ok) return [];

  return await prisma.serviceType.findMany({
    orderBy: {
      createdAt: 'desc'
    },
  })
}

export async function createServiceType(data: Role) {

  try {
    const access = await requirePermission("/admin/service-type", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const serviceType = serviceTypeSchema.parse(data)
    const payload = normalizeServiceTypePayload(serviceType)

    await prisma.serviceType.create({
      data: payload
    })

    return {
      success: true,
      message: "service type created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getServiceTypeById(id: string) {
  try {
    const access = await requirePermission("/admin/service-type", "view", [
      { route: "/admin/service-type", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let serviceType = await prisma.serviceType.findFirst({
      where: { id }
    })

    if (serviceType) {
      return {
        success: true,
        data: serviceType,
        message: "Service type fetched successfully"
      }
    }

    return {
      success: false,
      message: "Service type not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function updateServiceType(data: Role, id: string) {
  try {
    const access = await requirePermission("/admin/service-type", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const serviceType = serviceTypeSchema.parse(data)
    const payload = normalizeServiceTypePayload(serviceType)

    await prisma.serviceType.update({
      where: { id },
      data: payload
    })

    return {
      success: true,
      message: "Service type updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteServiceType(id: any) {
  try {
    const access = await requirePermission("/admin/service-type", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    await prisma.serviceType.delete({
      where: { id }
    })

    return {
      success: true,
      message: "Service type deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
