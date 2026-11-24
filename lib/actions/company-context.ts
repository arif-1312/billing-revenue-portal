"use server";

import { unstable_update } from "@/auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCompanyMembership } from "@/lib/company-context";

export async function getMyCompanies() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.userCompany.findMany({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      company: { status: "ACTIVE", isActive: true },
      role: { status: "ACTIVE" },
    },
    select: {
      company: { select: { id: true, name: true, logo: true } },
    },
    orderBy: { company: { name: "asc" } },
  }).then((memberships) => memberships.map(({ company }) => company));
}

export async function switchActiveCompany(companyId: string) {
  const session = await auth();
  if (!session?.user?.id || !companyId) {
    return { success: false, message: "Unauthorized" };
  }

  const membership = await prisma.userCompany.findFirst({
    where: {
      userId: session.user.id,
      companyId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      company: { status: "ACTIVE", isActive: true },
      role: { status: "ACTIVE" },
    },
    select: { companyId: true },
  });
  if (!membership) return { success: false, message: "Unauthorized" };

  await unstable_update({ user: { activeCompanyId: membership.companyId } });
  return { success: true };
}

export async function getCurrentCompany() {
  const membership = await getActiveCompanyMembership();
  if (!membership) return null;
  return {
    id: membership.company.id,
    name: membership.company.name,
    logo: membership.company.logo,
    memberships: await getMyCompanies(),
  };
}
