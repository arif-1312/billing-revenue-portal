import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    rateLimitBucket: { deleteMany: vi.fn() },
  },
}));

import { fileMatchesSignature } from "./file-signature";
import {
  assertAppEnv,
  assertProductionSeedPassword,
} from "./environment";
import { addMoney, moneyToNumber } from "./money";
import {
  canRemoveSystemUser,
  roleAssignmentDecision,
  roleChangeDecision,
  unauthorizedGrant,
} from "./privilege";
import { MemoryRateLimitStore } from "./rate-limit-store";
import { loginIsLimited, recordSharedLoginFailure, resetLoginRateLimitForTests, useLoginRateLimitStore } from "./login-rate-limit";
import { encryptSecret, isSecretConfigured } from "./secret-box";
import { idleExpired } from "./session-decision";
import { securityHeadersFor } from "./security-headers";
import { importRowBlockReason } from "./import-guard";
import { purchaseOrderUpdateBlock } from "./purchase-order-guard";
import { assessRevenueImport } from "./revenue-excel";

const actorGrants = new Map([
  ["/admin/customer", {
    canView: true,
    canCreate: true,
    canEdit: false,
    canDelete: false,
  }],
]);

describe("role escalation", () => {
  it("rejects a role editor granting a permission they do not have", () => {
    const grant = unauthorizedGrant(actorGrants, [{
      moduleId: "/admin/customer",
      canView: true,
      canDelete: true,
    }]);

    expect(grant).not.toBeNull();
    expect(roleChangeDecision({
      actorIsSystem: false,
      targetIsSystem: false,
      nextStatus: "ACTIVE",
      renamesRole: false,
      grantsExceedActor: true,
    })).toEqual({
      ok: false,
      message: "You cannot grant a permission you do not have.",
    });
  });

  it("rejects changes to the protected system role by a normal editor", () => {
    expect(roleChangeDecision({
      actorIsSystem: false,
      targetIsSystem: true,
      nextStatus: "ACTIVE",
      renamesRole: false,
      grantsExceedActor: false,
    }).ok).toBe(false);
  });

  it("rejects assigning the system role and demoting the last system administrator", () => {
    expect(roleAssignmentDecision({
      actorIsSystem: false,
      targetIsActiveSystem: false,
      nextRoleIsSystem: true,
      nextRoleIsActive: true,
      nextRoleExceedsActor: true,
      otherActiveSystemUsers: 1,
      deactivatesTarget: false,
    }).message).toBe("You cannot assign the system administrator role.");

    expect(canRemoveSystemUser({
      targetIsActiveSystem: true,
      otherActiveSystemUsers: 0,
    }).ok).toBe(false);
  });
});

describe("closed purchase orders", () => {
  it("rejects an ordinary edit and a stale version", () => {
    const current = new Date("2026-10-24T00:00:00.000Z");
    expect(purchaseOrderUpdateBlock({
      status: "CLOSED",
      actorIsSystem: false,
      currentUpdatedAt: current,
    })).toMatch(/Closed purchase orders/);
    expect(purchaseOrderUpdateBlock({
      status: "LIVE",
      actorIsSystem: false,
      expectedUpdatedAt: "2026-10-23T00:00:00.000Z",
      currentUpdatedAt: current,
    })).toMatch(/someone else/);
    expect(purchaseOrderUpdateBlock({
      status: "CLOSED",
      actorIsSystem: true,
      expectedUpdatedAt: current,
      currentUpdatedAt: current,
    })).toBeNull();
  });
});

describe("decimal money", () => {
  it("adds fractional amounts without binary floating-point drift", () => {
    expect(moneyToNumber(addMoney("0.10", "0.20"))).toBe(0.3);
    expect(moneyToNumber(addMoney(0.1, 0.2))).toBe(0.3);
  });
});

describe("mailbox secret", () => {
  it("stores a value that is not the original password", () => {
    process.env.AUTH_SECRET = "test-secret-value-0123456789";
    const stored = encryptSecret("mailbox-secret");

    expect(stored).not.toContain("mailbox-secret");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(isSecretConfigured(stored)).toBe(true);
  });
});

describe("production seed", () => {
  it("fails closed when APP_ENV is missing and rejects a development password in production", () => {
    expect(() => assertAppEnv({} as NodeJS.ProcessEnv)).toThrow(/APP_ENV/);
    expect(() => assertProductionSeedPassword("admin123", "production")).toThrow(
      /development password/,
    );
    expect(assertProductionSeedPassword("a-long-unique-password", "development")).toBe(
      "a-long-unique-password",
    );
  });
});

describe("shared login limits", () => {
  it("locks an account for every limiter using the same store", async () => {
    resetLoginRateLimitForTests();
    const shared = new MemoryRateLimitStore();
    useLoginRateLimitStore(shared);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordSharedLoginFailure("ada", "203.0.113.4", 1_000);
    }

    useLoginRateLimitStore(shared);
    await expect(loginIsLimited("Ada", "203.0.113.9", 1_000)).resolves.toBe(true);
    await expect(loginIsLimited("other", "203.0.113.4", 1_000)).resolves.toBe(true);
    resetLoginRateLimitForTests();
  });
});

describe("uploads and headers", () => {
  it("rejects a text file renamed as a PNG", () => {
    expect(fileMatchesSignature(Buffer.from("not a png"), ".png")).toBe(false);
    expect(fileMatchesSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), ".png")).toBe(true);
  });

  it("enforces a production content security policy without unsafe-eval", () => {
    const production = securityHeadersFor("production");
    const enforced = production.find((header) => header.key === "Content-Security-Policy");

    expect(enforced?.value).toContain("default-src 'self'");
    expect(enforced?.value).not.toContain("unsafe-eval");
    expect(
      securityHeadersFor("development").some(
        (header) => header.key === "Content-Security-Policy",
      ),
    ).toBe(false);
  });
});

describe("session idle timeout", () => {
  it("expires an idle session and keeps a recent one", () => {
    const now = 10_000_000;
    expect(idleExpired(now - 3 * 60 * 60 * 1000, now)).toBe(true);
    expect(idleExpired(now - 60 * 1000, now)).toBe(false);
    expect(idleExpired(undefined, now)).toBe(false);
  });
});

describe("revenue import identity", () => {
  it("does not choose the first invoice when several records share a number", () => {
    const assessed = assessRevenueImport(
      {
        columnErrors: [],
        candidates: [{
          excelRow: 2,
          invoiceNumber: "INV-1",
          customerPONumber: "PO-1",
          customerName: "Northwind",
          companyName: "Northwind",
          vendorName: "",
          invoiceDate: "2026-04-01",
          invoiceAmount: 100,
          collectedAmount: 0,
          tds: 0,
          paymentReceived: "NO",
          paymentReceivedDate: "",
          paymentDueDate: "",
          billingSubmittedDate: "",
          billingRemark: "",
          poAmount: 100,
          poStatus: "LIVE",
          scope: "",
          billingPlanName: "",
          serviceTypeName: "",
          contractDurationName: "",
          contractTypeName: "",
          poOwner: "",
          paymentTerms: "",
          purchaseOrderType: "",
          startFrom: "",
          endDate: "",
          remark: "",
        }],
      },
      {
        purchaseOrdersByNumber: new Map(),
        existingInvoices: new Map([
          ["inv-1", [
            { id: "cycle-1", purchaseOrderId: "po-1" },
            { id: "cycle-2", purchaseOrderId: "po-2" },
          ]],
        ]),
      },
    );

    expect(assessed.inserts).toHaveLength(0);
    expect(assessed.errors[0]?.messages.join(" ")).toContain("More than one");
  });

  it("blocks create-only callers from updates and payment replacement", () => {
    expect(importRowBlockReason(
      { purchaseOrderId: "po-1" },
      { canEdit: false, canDelete: false },
    )).toMatch(/Update permission/);
    expect(importRowBlockReason(
      { billingCycleId: "cycle-1" },
      { canEdit: true, canDelete: false },
    )).toMatch(/Delete permission/);
    expect(importRowBlockReason(
      {},
      { canEdit: false, canDelete: false },
    )).toBeNull();
  });
});
