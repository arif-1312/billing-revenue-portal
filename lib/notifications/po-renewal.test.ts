import { describe, expect, it } from "vitest";
import { stateNotificationDrafts, type PurchaseOrderSnapshot } from "./model";

const order: PurchaseOrderSnapshot = {
  id: "po-1", poNumber: "PO-1", status: "LIVE", startOn: null,
  endOn: "2026-12-08", contractId: null, contractName: null,
  customerName: "Customer", companyName: "Company", poAmount: 1000, invoices: [],
};

describe("PO renewal notifications", () => {
  it("creates a deduplicated reminder from 45 days before the end date", () => {
    expect(stateNotificationDrafts(order, new Date("2026-10-23T06:00:00Z"))).toEqual([]);
    const drafts = stateNotificationDrafts(order, new Date("2026-10-24T06:00:00Z"));
    expect(drafts.map((draft) => draft.eventType)).toEqual(["PO_EXPIRY_45_DAYS"]);
    expect(drafts[0].dedupeKey).toBe("PO_EXPIRY_45_DAYS|po-1|2026-12-08");
    expect(stateNotificationDrafts({ ...order, status: "CLOSED" }, new Date("2026-10-24T06:00:00Z"))).toEqual([]);
  });
});
