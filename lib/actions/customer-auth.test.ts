import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, findUnique, deleteCustomerRecord } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findUnique: vi.fn(),
  deleteCustomerRecord: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique,
      delete: deleteCustomerRecord,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { deleteCustomer } from "./customer";

beforeEach(() => {
  requirePermission.mockReset();
  findUnique.mockReset();
  deleteCustomerRecord.mockReset();
});

describe("deleteCustomer", () => {
  it("does not delete when the caller is not allowed", async () => {
    requirePermission.mockResolvedValue({
      ok: false,
      message: "Unauthorized",
    });

    await expect(deleteCustomer("customer-1")).resolves.toEqual({
      success: false,
      message: "Unauthorized",
    });
    expect(deleteCustomerRecord).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("keeps a customer that is linked to purchase orders", async () => {
    requirePermission.mockResolvedValue({ ok: true });
    findUnique.mockResolvedValue({
      id: "customer-1",
      _count: { purchaseOrders: 2 },
    });

    await expect(deleteCustomer("customer-1")).resolves.toEqual({
      success: false,
      message: "Customer cannot be deleted because it is linked to purchase orders.",
    });
    expect(deleteCustomerRecord).not.toHaveBeenCalled();
  });
});
