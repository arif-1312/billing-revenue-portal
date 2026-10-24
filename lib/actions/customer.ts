"use server";

import { revalidatePath } from "next/cache";
import { Customer } from "@/types";
import { prisma } from "../prisma";
import { customerSchema } from "../validators";
import { formatError } from "../utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

const customerReaders: PermissionRule[] = [
  { route: "/admin/revenue", action: "view" },
  { route: "/admin/revenue", action: "create" },
  { route: "/admin/revenue", action: "edit" },
  { route: "/admin/dashboard", action: "view" },
];

function normalizeCustomerPayload(customer: Customer) {
  const customerCode = customer.customerCode?.trim();
  const firstName = customer.firstName?.trim();
  const phone = customer.phone?.trim();

  if (!customerCode) {
    throw new Error("Customer code is required");
  }

  if (!firstName) {
    throw new Error("Customer first name is required");
  }

  if (!phone) {
    throw new Error("Customer phone is required");
  }

  return {
    customerCode,
    phone,
    email: customer.email?.trim() || null,
    firstName,
    lastName: customer.lastName?.trim() || null,
    companyName: customer.companyName?.trim() || null,
    alternatePhone: customer.alternatePhone?.trim() || null,
    addressLine1: customer.addressLine1?.trim() || null,
    addressLine2: customer.addressLine2?.trim() || null,
    city: customer.city?.trim() || null,
    state: customer.state?.trim() || null,
    country: customer.country?.trim() || null,
    postalCode: customer.postalCode?.trim() || null,
    gstNumber: customer.gstNumber?.trim() || null,
    panNumber: customer.panNumber?.trim() || null,
    website: customer.website?.trim() || null,
    remark: customer.remark ?? null,
    status: customer.status ?? "ACTIVE",
  } as const;
}

function customerLabel(customer: {
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return (
    customer.companyName?.trim() ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    "A customer"
  );
}

export async function getCustomers() {
  const access = await requirePermission("/admin/customer", "view", customerReaders);
  if (!access.ok) return [];

  return await prisma.customer.findMany({
    orderBy: {
      createdAt: 'desc'
    },
  })
}

export async function createCustomer(data: Customer) {

  try {
    const access = await requirePermission("/admin/customer", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const customer = customerSchema.parse(data)
    const payload = normalizeCustomerPayload(customer)

    const created = await prisma.customer.create({
      data: payload,
      select: { id: true },
    })

    await safePublishSystem({
      eventType: "SYSTEM_RECORD_CHANGE",
      entityType: "Customer",
      entityId: created.id,
      title: "Customer created",
      body: `${customerLabel(payload)} was added.`,
      href: "/admin/customer",
      customerName: customerLabel(payload),
      fingerprint: fingerprint([
        "created",
        payload.customerCode,
        payload.companyName,
        payload.email,
      ]),
    })

    revalidatePath("/admin/customer");
    revalidatePath("/admin/customer/create");

    return {
      success: true,
      message: "Customer created successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
export async function getCustomerById(id: string) {
  try {
    const access = await requirePermission("/admin/customer", "view", [
      { route: "/admin/customer", action: "edit" },
    ]);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let customer = await prisma.customer.findFirst({
      where: { id }
    })

    if (customer) {
      return {
        success: true,
        data: customer,
        message: "Customer fetched successfully"
      }
    }

    return {
      success: false,
      message: "Customer not found"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function updateCustomer(data: Customer, id: string) {
  try {
    const access = await requirePermission("/admin/customer", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const customer = customerSchema.parse(data)
    const payload = normalizeCustomerPayload(customer)

    await prisma.customer.update({
      where: { id },
      data: payload
    })

    await safePublishSystem({
      eventType: "SYSTEM_RECORD_CHANGE",
      entityType: "Customer",
      entityId: id,
      title: "Customer updated",
      body: `${customerLabel(payload)} was updated.`,
      href: "/admin/customer",
      customerName: customerLabel(payload),
      fingerprint: fingerprint([
        "updated",
        payload.companyName,
        payload.firstName,
        payload.lastName,
        payload.email,
        payload.phone,
        payload.status,
        payload.gstNumber,
      ]),
    })

    revalidatePath("/admin/customer");
    revalidatePath("/admin/customer/create");
    revalidatePath(`/admin/customer/edit/${id}`);

    return {
      success: true,
      message: "Customer updated successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}

export async function deleteCustomer(id: string) {
  try {
    const access = await requirePermission("/admin/customer", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        firstName: true,
        lastName: true,
        _count: {
          select: {
            purchaseOrders: true
          }
        }
      }
    })

    if (!customer) {
      return {
        success: false,
        message: "Customer not found"
      }
    }

    if (customer._count.purchaseOrders > 0) {
      return {
        success: false,
        message: "Customer cannot be deleted because it is linked to purchase orders."
      }
    }

    await prisma.customer.delete({
      where: { id }
    })

    await safePublishSystem({
      eventType: "SYSTEM_RECORD_CHANGE",
      entityType: "Customer",
      entityId: customer.id,
      title: "Customer removed",
      body: `${customerLabel(customer)} was removed.`,
      href: "/admin/customer",
      customerName: customerLabel(customer),
      fingerprint: "deleted",
      priority: "HIGH",
    })

    revalidatePath("/admin/customer");
    revalidatePath("/admin/customer/create");
    revalidatePath(`/admin/customer/edit/${id}`);

    return {
      success: true,
      message: "Customer deleted successfully"
    }

  } catch (error) {
    return {
      success: false,
      message: formatError(error)
    }
  }
}
