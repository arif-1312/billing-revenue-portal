"use server";

import { ContractDuration } from "@/types";
import { prisma } from "../prisma";
import { contractDurationSchema } from "../validators";
import { formatError } from "../utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";
import { getActiveCompanyContext } from "@/lib/company-context";

const revenueReaders: PermissionRule[] = [
  { route: "/admin/revenue", action: "view" },
  { route: "/admin/revenue", action: "create" },
  { route: "/admin/revenue", action: "edit" },
];

function normalizeContractDurationPayload(contractDuration: ContractDuration) {
  const name = contractDuration.name?.trim();

  if (!name) {
    throw new Error("Contract Duration name is required");
  }

  return {
    name,
    totalNumberOfMonths: Number(contractDuration.totalNumberOfMonths ?? 0),
    remark: contractDuration.remark ?? null,
    status: contractDuration.status ?? "ACTIVE",
  } as const;
}

export async function getContractDurations() {
  const access = await requirePermission("/admin/contract-duration", "view", revenueReaders);
  if (!access.ok) return [];
  const company = await getActiveCompanyContext();
  if (!company) return [];

  return await prisma.contractDuration.findMany({
    where: { companyId: company.companyId },
    orderBy: {
      createdAt: 'desc'
    },
  })
}

export async function createContractDuration(data: ContractDuration) {

  try {
    const access = await requirePermission("/admin/contract-duration", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const contractDuration = contractDurationSchema.parse(data)
    const payload = normalizeContractDurationPayload(contractDuration)
    const company = await getActiveCompanyContext();
    if (!company) return { success: false, message: "Unauthorized" };

    await prisma.contractDuration.create({
      data: { ...payload, companyId: company.companyId }
    })

    return {
      success: true,
      message: "Contract Duration created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getContractDurationById(id: string) {
  try {
    const access = await requirePermission("/admin/contract-duration", "view", [
      { route: "/admin/contract-duration", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }
    const company = await getActiveCompanyContext();
    if (!company) return { success: false, message: "Unauthorized" };

    const contractDuration = await prisma.contractDuration.findFirst({
      where: { id, companyId: company.companyId }
    })

    if (contractDuration) {
      return {
        success: true,
        data: contractDuration,
        message: "Contract Duration fetched successfully"
      }
    }

    return {
      success: false,
      message: "Contract Duration not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function updateContractDuration(data: ContractDuration, id: string) {
  try {
    const access = await requirePermission("/admin/contract-duration", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

  const contractDuration = contractDurationSchema.parse(data)
  const payload = normalizeContractDurationPayload(contractDuration)
    const company = await getActiveCompanyContext();
    if (!company) return { success: false, message: "Unauthorized" };

    const result = await prisma.contractDuration.updateMany({
      where: { id, companyId: company.companyId },
      data: payload
    })
    if (!result.count) return { success: false, message: "Contract Duration not found" };

    return {
      success: true,
      message: "Contract Duration updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteContractDuration(id: string) {
  try {
    const access = await requirePermission("/admin/contract-duration", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }
    const company = await getActiveCompanyContext();
    if (!company) return { success: false, message: "Unauthorized" };

    const result = await prisma.contractDuration.deleteMany({ where: { id, companyId: company.companyId } });
    if (!result.count) return { success: false, message: "Contract Duration not found" };

    return {
      success: true,
      message: "Contract Duration deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
