"use server";

import { revalidatePath } from "next/cache";

import { Vendor } from "@/types";

import { prisma } from "../prisma";
import { formatError } from "../utils";
import { vendorSchema } from "../validators";
import { requirePermission, type PermissionRule } from "@/lib/rbac";

const vendorReaders: PermissionRule[] = [
  { route: "/admin/revenue", action: "view" },
  { route: "/admin/revenue", action: "create" },
  { route: "/admin/revenue", action: "edit" },
];

type VendorPayload = ReturnType<typeof normalizeVendorPayload>;

type VendorRecord = {
  id: string;
  vendorCode: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string;
  alternatePhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  website: string | null;
  status: string;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VendorCountRecord = {
  id: string;
  purchaseOrderCount: number;
};

type VendorDelegate = {
  findMany(args: {
    orderBy: { createdAt: "desc" };
  }): Promise<VendorRecord[]>;
  create(args: {
    data: VendorPayload;
  }): Promise<unknown>;
  findFirst(args: {
    where: { id: string };
  }): Promise<VendorRecord | null>;
  update(args: {
    where: { id: string };
    data: VendorPayload;
  }): Promise<unknown>;
  findUnique(args: {
    where: { id: string };
    select: {
      id: true;
      _count: {
        select: {
          purchaseOrders: true;
        };
      };
    };
  }): Promise<{ id: string; _count: { purchaseOrders: number } } | null>;
  delete(args: {
    where: { id: string };
  }): Promise<unknown>;
};

type PrismaWithVendorDelegate = typeof prisma & {
  vendor?: VendorDelegate;
};

function getVendorDelegate() {
  return (prisma as PrismaWithVendorDelegate).vendor;
}

function mapVendorRecord(record: VendorRecord): Vendor {
  return {
    id: record.id,
    vendorCode: record.vendorCode,
    firstName: record.firstName,
    lastName: record.lastName ?? undefined,
    companyName: record.companyName ?? undefined,
    email: record.email ?? undefined,
    phone: record.phone,
    alternatePhone: record.alternatePhone ?? undefined,
    addressLine1: record.addressLine1 ?? undefined,
    addressLine2: record.addressLine2 ?? undefined,
    city: record.city ?? undefined,
    state: record.state ?? undefined,
    country: record.country ?? undefined,
    postalCode: record.postalCode ?? undefined,
    gstNumber: record.gstNumber ?? undefined,
    panNumber: record.panNumber ?? undefined,
    website: record.website ?? undefined,
    status: record.status as Vendor["status"],
    remark: record.remark ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeVendorPayload(vendor: Vendor) {
  const vendorCode = vendor.vendorCode?.trim();
  const firstName = vendor.firstName?.trim();
  const phone = vendor.phone?.trim();

  if (!vendorCode) {
    throw new Error("Vendor code is required");
  }

  if (!firstName) {
    throw new Error("Vendor first name is required");
  }

  if (!phone) {
    throw new Error("Vendor phone is required");
  }

  return {
    vendorCode,
    phone,
    email: vendor.email?.trim() || null,
    firstName,
    lastName: vendor.lastName?.trim() || null,
    companyName: vendor.companyName?.trim() || null,
    alternatePhone: vendor.alternatePhone?.trim() || null,
    addressLine1: vendor.addressLine1?.trim() || null,
    addressLine2: vendor.addressLine2?.trim() || null,
    city: vendor.city?.trim() || null,
    state: vendor.state?.trim() || null,
    country: vendor.country?.trim() || null,
    postalCode: vendor.postalCode?.trim() || null,
    gstNumber: vendor.gstNumber?.trim() || null,
    panNumber: vendor.panNumber?.trim() || null,
    website: vendor.website?.trim() || null,
    remark: vendor.remark ?? null,
    status: vendor.status ?? "ACTIVE",
  } as const;
}

function getVendorRuntimeMessage(error: unknown) {
  const message = formatError(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("cannot read properties of undefined") ||
    normalized.includes("reading 'findmany'")
  ) {
    return "Vendor model is not available in the current Prisma client. Restart the dev server after running `npx prisma generate`.";
  }

  if (
    normalized.includes("relation \"vendor\" does not exist") ||
    normalized.includes("relation 'vendor' does not exist") ||
    normalized.includes("vendor table is not available")
  ) {
    return "Vendor table is not available yet. Run the latest Prisma migration and restart the dev server.";
  }

  return message;
}

async function findVendorsWithSql() {
  return prisma.$queryRaw<VendorRecord[]>`
    SELECT
      "id",
      "vendorCode",
      "firstName",
      "lastName",
      "companyName",
      "email",
      "phone",
      "alternatePhone",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "country",
      "postalCode",
      "gstNumber",
      "panNumber",
      "website",
      "status"::text AS "status",
      "remark",
      "createdAt",
      "updatedAt"
    FROM "Vendor"
    ORDER BY "createdAt" DESC
  `;
}

async function findVendorByIdWithSql(id: string) {
  const vendors = await prisma.$queryRaw<VendorRecord[]>`
    SELECT
      "id",
      "vendorCode",
      "firstName",
      "lastName",
      "companyName",
      "email",
      "phone",
      "alternatePhone",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "country",
      "postalCode",
      "gstNumber",
      "panNumber",
      "website",
      "status"::text AS "status",
      "remark",
      "createdAt",
      "updatedAt"
    FROM "Vendor"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return vendors[0] ?? null;
}

async function createVendorWithSql(payload: VendorPayload) {
  await prisma.$executeRaw`
    INSERT INTO "Vendor" (
      "vendorCode",
      "firstName",
      "lastName",
      "companyName",
      "email",
      "phone",
      "alternatePhone",
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "country",
      "postalCode",
      "gstNumber",
      "panNumber",
      "website",
      "status",
      "remark",
      "updatedAt"
    ) VALUES (
      ${payload.vendorCode},
      ${payload.firstName},
      ${payload.lastName},
      ${payload.companyName},
      ${payload.email},
      ${payload.phone},
      ${payload.alternatePhone},
      ${payload.addressLine1},
      ${payload.addressLine2},
      ${payload.city},
      ${payload.state},
      ${payload.country},
      ${payload.postalCode},
      ${payload.gstNumber},
      ${payload.panNumber},
      ${payload.website},
      ${payload.status}::"Status",
      ${payload.remark},
      NOW()
    )
  `;
}

async function updateVendorWithSql(payload: VendorPayload, id: string) {
  return prisma.$executeRaw`
    UPDATE "Vendor"
    SET
      "vendorCode" = ${payload.vendorCode},
      "firstName" = ${payload.firstName},
      "lastName" = ${payload.lastName},
      "companyName" = ${payload.companyName},
      "email" = ${payload.email},
      "phone" = ${payload.phone},
      "alternatePhone" = ${payload.alternatePhone},
      "addressLine1" = ${payload.addressLine1},
      "addressLine2" = ${payload.addressLine2},
      "city" = ${payload.city},
      "state" = ${payload.state},
      "country" = ${payload.country},
      "postalCode" = ${payload.postalCode},
      "gstNumber" = ${payload.gstNumber},
      "panNumber" = ${payload.panNumber},
      "website" = ${payload.website},
      "status" = ${payload.status}::"Status",
      "remark" = ${payload.remark},
      "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

async function getVendorDeleteMetaWithSql(id: string) {
  const vendors = await prisma.$queryRaw<VendorCountRecord[]>`
    SELECT
      v."id",
      COUNT(po."id")::int AS "purchaseOrderCount"
    FROM "Vendor" v
    LEFT JOIN "PurchaseOrder" po
      ON po."vendorId" = v."id"
    WHERE v."id" = ${id}
    GROUP BY v."id"
  `;

  return vendors[0] ?? null;
}

async function deleteVendorWithSql(id: string) {
  return prisma.$executeRaw`
    DELETE FROM "Vendor"
    WHERE "id" = ${id}
  `;
}

function revalidateVendorPaths(id?: string) {
  revalidatePath("/admin/vendor");
  revalidatePath("/admin/vendor/create");

  if (id) {
    revalidatePath(`/admin/vendor/edit/${id}`);
  }
}

export async function getVendors() {
  const access = await requirePermission("/admin/vendor", "view", vendorReaders);
  if (!access.ok) return [];

  const vendorDelegate = getVendorDelegate();

  if (vendorDelegate) {
    const records = await vendorDelegate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map(mapVendorRecord);
  }

  try {
    const records = await findVendorsWithSql();

    return records.map(mapVendorRecord);
  } catch (error) {
    console.error("getVendors fallback failed:", getVendorRuntimeMessage(error));
    return [];
  }
}

export async function createVendor(data: Vendor) {
  try {
    const access = await requirePermission("/admin/vendor", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const vendor = vendorSchema.parse(data);
    const payload = normalizeVendorPayload(vendor);
    const vendorDelegate = getVendorDelegate();

    if (vendorDelegate) {
      await vendorDelegate.create({
        data: payload,
      });
    } else {
      await createVendorWithSql(payload);
    }

    revalidateVendorPaths();

    return {
      success: true,
      message: "Vendor created successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: getVendorRuntimeMessage(error),
    };
  }
}

export async function getVendorById(id: string) {
  try {
    const access = await requirePermission("/admin/vendor", "view", [
      { route: "/admin/vendor", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const vendorDelegate = getVendorDelegate();
    const vendor = vendorDelegate
      ? await vendorDelegate.findFirst({
          where: { id },
        })
      : await findVendorByIdWithSql(id);

    if (vendor) {
      return {
        success: true,
        data: mapVendorRecord(vendor),
        message: "Vendor fetched successfully",
      };
    }

    return {
      success: false,
      message: "Vendor not found",
    };
  } catch (error) {
    return {
      success: false,
      message: getVendorRuntimeMessage(error),
    };
  }
}

export async function updateVendor(data: Vendor, id: string) {
  try {
    const access = await requirePermission("/admin/vendor", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const vendor = vendorSchema.parse(data);
    const payload = normalizeVendorPayload(vendor);
    const vendorDelegate = getVendorDelegate();

    if (vendorDelegate) {
      const existingVendor = await vendorDelegate.findFirst({
        where: { id },
      });

      if (!existingVendor) {
        return {
          success: false,
          message: "Vendor not found",
        };
      }

      await vendorDelegate.update({
        where: { id },
        data: payload,
      });
    } else {
      const affectedRows = await updateVendorWithSql(payload, id);

      if (Number(affectedRows) === 0) {
        return {
          success: false,
          message: "Vendor not found",
        };
      }
    }

    revalidateVendorPaths(id);

    return {
      success: true,
      message: "Vendor updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: getVendorRuntimeMessage(error),
    };
  }
}

export async function deleteVendor(id: string) {
  try {
    const access = await requirePermission("/admin/vendor", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const vendorDelegate = getVendorDelegate();

    if (vendorDelegate) {
      const vendor = await vendorDelegate.findUnique({
        where: { id },
        select: {
          id: true,
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
      });

      if (!vendor) {
        return {
          success: false,
          message: "Vendor not found",
        };
      }

      if (vendor._count.purchaseOrders > 0) {
        return {
          success: false,
          message: "Vendor cannot be deleted because it is linked to purchase orders.",
        };
      }

      await vendorDelegate.delete({
        where: { id },
      });
    } else {
      const vendor = await getVendorDeleteMetaWithSql(id);

      if (!vendor) {
        return {
          success: false,
          message: "Vendor not found",
        };
      }

      if (vendor.purchaseOrderCount > 0) {
        return {
          success: false,
          message: "Vendor cannot be deleted because it is linked to purchase orders.",
        };
      }

      const affectedRows = await deleteVendorWithSql(id);

      if (Number(affectedRows) === 0) {
        return {
          success: false,
          message: "Vendor not found",
        };
      }
    }

    revalidateVendorPaths(id);

    return {
      success: true,
      message: "Vendor deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: getVendorRuntimeMessage(error),
    };
  }
}
