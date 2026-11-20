"use server";

import { prisma } from "../prisma";
import { formatError } from "../utils";
import { moduleSchema } from "../validators";
import { Module } from "@/types";
import { requirePermission } from "@/lib/rbac";

type ActionResponse = {
  success: boolean;
  message: string;
};

type PrismaModule = Awaited<ReturnType<typeof prisma.module.findFirst>>;

function mapModule(m: NonNullable<PrismaModule>): Module {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    route: m.route,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt?.toISOString(),
  };
}

function normalizeModulePayload(module: Module) {
  const name = module.name?.trim();
  const description = module.description?.trim();

  if (!name) {
    throw new Error("Module name is required");
  }

  if (!description) {
    throw new Error("Module description is required");
  }

  return {
    name,
    description,
    route: `/admin/${name.toLowerCase().replace(/\s+/g, "-").replace("&", "")}`,
    status: module.status ?? "ACTIVE",
  } as const;
}

export async function getModules(): Promise<Module[]> {
  const access = await requirePermission("/admin/module", "view", [
    { route: "/admin/roles", action: "create" },
    { route: "/admin/roles", action: "edit" },
  ]);
  if (!access.ok) return [];

  const modules = await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
  });

  return modules.map(mapModule);
}

export async function createModule(data: unknown): Promise<ActionResponse> {
  try {
    const access = await requirePermission("/admin/module", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const parsedModule = moduleSchema.parse(data);
    const payload = normalizeModulePayload(parsedModule);

    await prisma.module.create({
      data: payload,
    });

    return {
      success: true,
      message: "Module created successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function getModuleById(id: string) {
  try {
    const access = await requirePermission("/admin/module", "view", [
      { route: "/admin/module", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const foundModule = await prisma.module.findUnique({
      where: { id },
    });

    if (!foundModule) {
      return {
        success: false,
        message: "Module not found",
      };
    }

    return {
      success: true,
      data: mapModule(foundModule),
      message: "Module fetched successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function updateModule(
  data: unknown,
  id: string,
): Promise<ActionResponse> {
  try {
    const access = await requirePermission("/admin/module", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const parsedModule = moduleSchema.parse(data);
    const payload = normalizeModulePayload(parsedModule);

    await prisma.module.update({
      where: { id },
      data: { name: payload.name, description: payload.description, status: payload.status },
    });

    return {
      success: true,
      message: "Module updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function deleteModule(id: string): Promise<ActionResponse> {
  try {
    const access = await requirePermission("/admin/module", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const foundModule = await prisma.module.findUnique({
      where: { id },
    });

    if (!foundModule) {
      return {
        success: false,
        message: "Module not found",
      };
    }

    if (foundModule.route === "/admin") {
      return {
        success: false,
        message: "Core module cannot be deleted",
      };
    }

    await prisma.module.delete({
      where: { id },
    });

    return {
      success: true,
      message: "Module deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}
