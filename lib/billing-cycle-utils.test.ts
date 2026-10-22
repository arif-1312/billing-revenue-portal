import { describe, expect, it } from "vitest";

import {
  generatePurchaseOrderBillingCycles,
  resolveCycleInvoiceAmount,
} from "./billing-cycle-utils";

describe("invoice amounts", () => {
  it("keeps an amount already entered for a billing cycle", () => {
    expect(resolveCycleInvoiceAmount(1500, 1000, 1000)).toEqual({
      amount: 1500,
      trackedGeneratedAmount: 1000,
    });
  });

  it("updates an untouched prefilled amount when the schedule changes", () => {
    expect(resolveCycleInvoiceAmount(1000, 2000, 1000)).toEqual({
      amount: 2000,
      trackedGeneratedAmount: 2000,
    });
  });

  it("keeps a saved amount that differs from the generated split", () => {
    expect(resolveCycleInvoiceAmount(1500, 1000, null)).toEqual({
      amount: 1500,
      trackedGeneratedAmount: 1000,
    });
  });

  it("uses the generated amount when the cycle has no invoice amount yet", () => {
    expect(resolveCycleInvoiceAmount(0, 1000, null)).toEqual({
      amount: 1000,
      trackedGeneratedAmount: 1000,
    });
  });
});

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

  it("creates one cycle for a one-time billing plan with no cycle count", () => {
    const cycles = generatePurchaseOrderBillingCycles({
      startDate: new Date(2026, 3, 15),
      endDate: new Date(2026, 8, 30),
      totalBillingCycles: 0,
      planName: "One-Time",
      type: "START",
    });

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.invoiceDate).toEqual(new Date(2026, 3, 15));
  });
});
