import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, findFirst } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuration: {
      findFirst,
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

import { getConfiguration, getConfigurationSettings } from "./configuration";

beforeEach(() => {
  requirePermission.mockReset();
  findFirst.mockReset();
});

describe("configuration reads", () => {
  it("returns branding without the mailbox password", async () => {
    findFirst.mockResolvedValue({
      name: "Example",
      logo: "/logo.png",
      favicon: "/favicon.ico",
    });

    await getConfiguration();

    expect(findFirst.mock.calls[0]?.[0].select).toEqual({
      name: true,
      logo: true,
      favicon: true,
    });
    expect(findFirst.mock.calls[0]?.[0].select).not.toHaveProperty("password");
  });

  it("does not load mail settings without configuration view permission", async () => {
    requirePermission.mockResolvedValue({
      ok: false,
      message: "Unauthorized",
    });

    await expect(getConfigurationSettings()).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
