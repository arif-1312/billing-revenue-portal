import { describe, expect, it } from "vitest";

import { generatePurchaseOrderBillingCycles } from "./billing-cycle-utils";

describe("OTS billing cycles", () => {
  it("creates one cycle for an OTS billing plan", () => {
    const cycles = generatePurchaseOrderBillingCycles({
      startDate: new Date(2026, 3, 1),
      endDate: new Date(2027, 2, 31),
      totalBillingCycles: 0,
      planName: "OTS",
      type: "START",
    });

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.invoiceDate).toEqual(new Date(2026, 3, 1));
  });
});
