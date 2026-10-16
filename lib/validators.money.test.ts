import { describe, expect, it } from "vitest";

import { billingCycleSchema, purchaseOrderSchema, projectMonthlyPLSchema } from "./validators";

describe("financial bounds", () => {
  it("accepts zero and ordinary positive amounts", () => {
    const parsed = purchaseOrderSchema.parse({
      poAmount: 12500.5,
      billingCycles: [
        {
          invoiceAmount: 1000,
          collectedAmount: 0,
          tds: 10,
          payments: [{ amount: 1000 }],
        },
      ],
    });

    expect(parsed.poAmount).toBe(12500.5);
    expect(parsed.billingCycles[0]?.invoiceAmount).toBe(1000);
  });

  it("rejects negative, non-finite, and oversized amounts", () => {
    expect(() => purchaseOrderSchema.parse({ poAmount: -1 })).toThrow();
    expect(() =>
      billingCycleSchema.parse({ invoiceAmount: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() =>
      projectMonthlyPLSchema.parse({ billedAmount: 10000000000 }),
    ).toThrow();
    expect(() => billingCycleSchema.parse({ collectedAmount: Number.NaN })).toThrow();
  });
});
