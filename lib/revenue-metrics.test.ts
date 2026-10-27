import { describe, expect, it } from "vitest";

import {
  agingBucketForDaysPastDue,
  amountWithGst,
  collectionSlices,
  percentDelta,
  ratePointDelta,
  trendTone,
} from "./revenue-metrics";

describe("management comparisons", () => {
  it("does not calculate a percentage against a zero baseline", () => {
    expect(percentDelta(12500, 0)).toBeNull();
  });

  it("withholds an efficiency change when the prior period has no billing", () => {
    expect(ratePointDelta(40, 0, 0)).toBeNull();
    expect(ratePointDelta(90, 80, 100)).toBe(10);
  });

  it("treats higher overdue as unfavorable and higher collections as favorable", () => {
    expect(trendTone(12, "higher-is-better")).toBe("good");
    expect(trendTone(12, "lower-is-better")).toBe("bad");
    expect(trendTone(-4, "lower-is-better")).toBe("good");
    expect(trendTone(null, "higher-is-better")).toBe("neutral");
    expect(trendTone(0, "lower-is-better")).toBe("neutral");
  });
});

describe("collected with gst", () => {
  it("adds 18 percent to the collected amount", () => {
    expect(amountWithGst(1000)).toBe(1180);
    expect(amountWithGst(0)).toBe(0);
  });
});

describe("aging buckets", () => {
  it("keeps invoices that are not yet due out of the overdue buckets", () => {
    expect(agingBucketForDaysPastDue(-3)).toBeNull();
  });

  it("places the due date and later days in the requested buckets", () => {
    expect(agingBucketForDaysPastDue(0)).toBe("0-30");
    expect(agingBucketForDaysPastDue(1)).toBe("0-30");
    expect(agingBucketForDaysPastDue(30)).toBe("0-30");
    expect(agingBucketForDaysPastDue(31)).toBe("31-60");
    expect(agingBucketForDaysPastDue(61)).toBe("61-90");
    expect(agingBucketForDaysPastDue(91)).toBe("90+");
  });
});

describe("GST display amount", () => {
  it("adds 18 percent and keeps two decimal places", () => {
    expect(amountWithGst(10000.01)).toBe(11800.01);
    expect(amountWithGst(45000)).toBe(53100);
  });
});

describe("collection slices", () => {
  it("splits outstanding into pending and overdue without double counting", () => {
    expect(collectionSlices(50, 50, 20)).toEqual([
      { name: "Collected", value: 50 },
      { name: "Pending", value: 30 },
      { name: "Overdue", value: 20 },
    ]);
  });

  it("refuses a split when overdue exceeds outstanding", () => {
    expect(collectionSlices(10, 5, 9)).toBeNull();
  });
});
