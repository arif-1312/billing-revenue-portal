import { describe, expect, it } from "vitest";

import { parseKolkataDate } from "./fiscal-year";
import {
  applyFilterChange,
  effectivePeriodFilters,
  matchingPreset,
  periodMode,
  presetPatch,
  previousPeriod,
} from "./dashboard-presets";
import type { DashboardFilters } from "./revenue-metrics";

const march31 = parseKolkataDate("2026-03-31");
const april1 = parseKolkataDate("2026-04-01");

const base: DashboardFilters = {
  company: "all",
  customer: "co-1",
  startDate: new Date(2026, 0, 1),
  endDate: new Date(2026, 0, 31),
  month: "2",
  quarter: "1",
  year: "2024",
};

describe("dashboard presets", () => {
  it("selects March of the ending financial year on 31 March", () => {
    expect(presetPatch("month", march31)).toMatchObject({
      year: "2025",
      month: "11",
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    });
    expect(presetPatch("quarter", march31)).toMatchObject({
      year: "2025",
      quarter: "4",
      month: "all",
    });
    expect(presetPatch("fy", march31).year).toBe("2025");
    expect(presetPatch("last-fy", march31).year).toBe("2024");
  });

  it("selects April of the new financial year on 1 April", () => {
    expect(presetPatch("month", april1)).toMatchObject({
      year: "2026",
      month: "0",
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    });
    expect(presetPatch("quarter", april1)).toMatchObject({
      year: "2026",
      quarter: "1",
      month: "all",
    });
    expect(presetPatch("fy", april1).year).toBe("2026");
    expect(presetPatch("last-fy", april1).year).toBe("2025");
  });

  it("lets a custom date range override month and quarter", () => {
    const filters: DashboardFilters = {
      ...base,
      startDate: new Date(2026, 3, 2),
      month: "0",
      quarter: "1",
    };

    expect(periodMode(filters)).toBe("dates");
    expect(effectivePeriodFilters(filters)).toMatchObject({
      month: "all",
      quarter: "all",
      startDate: filters.startDate,
    });
  });

  it("clears the date range when a month or quarter is applied", () => {
    expect(applyFilterChange(base, "month", "5")).toMatchObject({
      month: "5",
      quarter: "all",
      startDate: undefined,
      endDate: undefined,
    });
    expect(applyFilterChange(base, "quarter", "2")).toMatchObject({
      quarter: "2",
      month: "all",
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("keeps the customer when another company is selected", () => {
    expect(applyFilterChange(base, "company", "company-1,company-2").customer).toBe("co-1");
  });

  it("keeps a month that belongs to one of the selected quarters", () => {
    expect(applyFilterChange({ ...base, month: "0", quarter: "1" }, "quarter", "1,2")).toMatchObject({
      quarter: "1,2",
      month: "0",
    });
  });
});

describe("previous period", () => {
  const open: DashboardFilters = {
    company: "all",
    customer: "all",
    month: "all",
    quarter: "all",
    year: "2026",
  };

  it("steps April back to March of the previous financial year", () => {
    expect(previousPeriod({ ...open, month: "0" })).toMatchObject({
      year: "2025",
      month: "11",
      quarter: "all",
      label: "prior month",
    });
  });

  it("steps the first quarter back to the fourth quarter", () => {
    expect(previousPeriod({ ...open, quarter: "1" })).toMatchObject({
      year: "2025",
      quarter: "4",
      month: "all",
      label: "prior quarter",
    });
  });

  it("compares a financial year with the previous year", () => {
    expect(previousPeriod(open)).toMatchObject({
      year: "2025",
      month: "all",
      quarter: "all",
      label: "prior FY",
    });
  });

  it("does not compare every year at once", () => {
    expect(previousPeriod({ ...open, year: "all" })).toBeNull();
  });

  it("does not compare several months or years as one period", () => {
    expect(previousPeriod({ ...open, month: "0,1" })).toBeNull();
    expect(previousPeriod({ ...open, year: "2025,2026" })).toBeNull();
  });

  it("does not invent a comparison from one date", () => {
    expect(
      previousPeriod({ ...open, month: "all", startDate: new Date(2026, 3, 1) }),
    ).toBeNull();
  });

  it("does not compare a custom range whose prior window crosses April", () => {
    expect(
      previousPeriod({
        ...open,
        startDate: new Date(2026, 3, 20),
        endDate: new Date(2026, 4, 19),
      }),
    ).toBeNull();
  });
});

describe("matching preset", () => {
  it("recognises the current financial year without treating a company filter as a period change", () => {
    const today = parseKolkataDate("2026-04-01");
    expect(
      matchingPreset(
        {
          company: "co-1",
          customer: "all",
          month: "all",
          quarter: "all",
          year: "2026",
        },
        today,
      ),
    ).toBe("fy");
  });
});
