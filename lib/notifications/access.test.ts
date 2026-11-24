import { beforeEach, describe, expect, it, vi } from "vitest";

const { canAccess, getUserPermissions, count } = vi.hoisted(() => ({
  canAccess: vi.fn(), getUserPermissions: vi.fn(), count: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({ canAccess, getUserPermissions }));
vi.mock("@/lib/prisma", () => ({ prisma: { notificationReceipt: { count } } }));
vi.mock("@/lib/email/queue", () => ({ enqueueNotificationEmails: vi.fn(), scheduleEmailDrain: vi.fn() }));

import { getNotificationCentre, getNotificationPreview, getUnreadNotificationCount, markAllNotificationReceiptsRead } from "./store";

beforeEach(() => {
  vi.resetAllMocks();
  getUserPermissions.mockResolvedValue({ id: "user", activeCompanyId: "company-a" });
  canAccess.mockResolvedValue(false);
});

describe("notification module access", () => {
  it("denies notification data and actions without view permission", async () => {
    for (const result of await Promise.all([
      getNotificationCentre({}), getNotificationPreview("all"),
      getUnreadNotificationCount(), markAllNotificationReceiptsRead(),
    ])) {
      expect(result).toMatchObject({ ok: false });
    }
    expect(canAccess).toHaveBeenCalledWith("/admin/notifications", "view");
    expect(count).not.toHaveBeenCalled();
  });

  it("counts notifications only for the active company", async () => {
    canAccess.mockResolvedValue(true);
    count.mockResolvedValue(0);

    await expect(getUnreadNotificationCount()).resolves.toEqual({ ok: true, unreadCount: 0 });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        notification: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ companyId: "company-a" })]),
        }),
      }),
    }));
  });
});
