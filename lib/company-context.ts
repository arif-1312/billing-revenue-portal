import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requestCache } from "@/lib/request-cache";

const loadActiveCompanyMembership = requestCache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = session?.user?.activeCompanyId;
  if (!userId || !companyId) return null;

  return prisma.userCompany.findFirst({
    where: {
      userId,
      companyId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      company: { status: "ACTIVE", isActive: true },
      role: { status: "ACTIVE" },
    },
    include: {
      user: true,
      company: true,
      role: {
        include: {
          roleModules: { include: { module: true } },
        },
      },
    },
  });
});

export type ActiveCompanyMembership = NonNullable<
  Awaited<ReturnType<typeof loadActiveCompanyMembership>>
>;

export async function getActiveCompanyMembership() {
  return loadActiveCompanyMembership();
}

export async function getActiveCompanyContext() {
  const membership = await getActiveCompanyMembership();
  if (!membership) return null;

  return {
    userId: membership.userId,
    companyId: membership.companyId,
    company: membership.company,
    role: membership.role,
    isSystem: membership.role.isSystem,
  };
}
