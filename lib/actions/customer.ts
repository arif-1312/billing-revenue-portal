"use server";

import { revalidatePath } from "next/cache";
import { Customer } from "@/types";
import { prisma } from "../prisma";
import { customerSchema } from "../validators";
import { formatError } from "../utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";

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

    await prisma.customer.create({
      data: payload
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
