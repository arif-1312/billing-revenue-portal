"use server";

import { Company, } from "@/types";
import { prisma } from "../prisma";
import { companySchema } from "../validators";
import { formatError, incrementCode } from "../utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

const companyReaders: PermissionRule[] = [
  { route: "/admin/revenue", action: "view" },
  { route: "/admin/revenue", action: "create" },
  { route: "/admin/revenue", action: "edit" },
  { route: "/admin/pl", action: "view" },
  { route: "/admin/pl", action: "create" },
  { route: "/admin/pl", action: "edit" },
  { route: "/admin/dashboard", action: "view" },
];

function normalizeCompanyPayload(company: Company) {
  const name = company.name?.trim();

  if (!name) {
    throw new Error("Company name is required");
  }

  return {
    name,
    email: company.email?.trim() || null,
    phone: company.phone?.trim() || null,
    alternatePhone: company.alternatePhone?.trim() || null,
    addressLine1: company.addressLine1?.trim() || null,
    addressLine2: company.addressLine2?.trim() || null,
    city: company.city?.trim() || null,
    state: company.state?.trim() || null,
    country: company.country?.trim() || null,
    pincode: company.pincode?.trim() || null,
    gstNumber: company.gstNumber?.trim() || null,
    panNumber: company.panNumber?.trim() || null,
    cinNumber: company.cinNumber?.trim() || null,
    status: company.status ?? "ACTIVE",
  } as const;
}

export async function getCompanys() {
  const access = await requirePermission("/admin/company", "view", companyReaders);
  if (!access.ok) return [];

  return await prisma.company.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
}

export async function createCompany(data: Company) {

  try {
    const access = await requirePermission("/admin/company", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const totalCompanies = await prisma.company.count()

    const companyCode = "COMP-" + incrementCode(String(totalCompanies)) 

    const company = companySchema.parse(data)
    const payload = normalizeCompanyPayload(company)

    const created = await prisma.company.create({
      data: {
        ...payload,
        companyCode: companyCode,
      },
      select: { id: true },
    })

    await safePublishSystem({
      eventType: "SYSTEM_RECORD_CHANGE",
      entityType: "Company",
      entityId: created.id,
      title: "Company created",
      body: `${payload.name} was added.`,
      href: "/admin/company",
      companyName: payload.name,
      fingerprint: fingerprint(["created", companyCode, payload.name]),
    })

    return {
      success: true,
      message: "company created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getcompanyById(id: string) {
  try {
    const access = await requirePermission("/admin/company", "view", [
      { route: "/admin/company", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let company = await prisma.company.findFirst({
      where: { id }
    })

    if (company) {
      return {
        success: true,
        data: company,
        message: "company fetched successfully"
      }
    }

    return {
      success: false,
      message: "company not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function updateCompany(data: Company, id: string) {
  try {
    const access = await requirePermission("/admin/company", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const company = companySchema.parse(data)
    const payload = normalizeCompanyPayload(company)

    await prisma.company.update({
      where: { id },
      data: payload
    })

    await safePublishSystem({
      eventType: "SYSTEM_RECORD_CHANGE",
      entityType: "Company",
      entityId: id,
      title: "Company updated",
      body: `${payload.name} was updated.`,
      href: "/admin/company",
      companyName: payload.name,
      fingerprint: fingerprint([
        "updated",
        payload.name,
        payload.email,
        payload.phone,
        payload.status,
        payload.gstNumber,
      ]),
    })

    return {
      success: true,
      message: "company updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteCompany(id: any) {
  try {
    const access = await requirePermission("/admin/company", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const existing = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    await prisma.company.delete({
      where: { id }
    })

    if (existing) {
      await safePublishSystem({
        eventType: "SYSTEM_RECORD_CHANGE",
        entityType: "Company",
        entityId: existing.id,
        title: "Company removed",
        body: `${existing.name} was removed.`,
        href: "/admin/company",
        companyName: existing.name,
        fingerprint: "deleted",
        priority: "HIGH",
      })
    }

    return {
      success: true,
      message: "company deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
