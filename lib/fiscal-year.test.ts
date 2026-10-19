import { describe, expect, it } from "vitest";

import {
  calendarParts,
  endOfMonth,
  calendarDaysBetween,
  fiscalMonthIndex,
  FIRST_FISCAL_YEAR,
  getFiscalYear,
  parseKolkataDate,
  quarterContainsMonth,
} from "./fiscal-year";

describe("fiscal year boundary", () => {
  it("keeps 31 March in the financial year that started the previous April", () => {
    const date = parseKolkataDate("2026-03-31");

    expect(getFiscalYear(date)).toBe(2025);
    expect(fiscalMonthIndex(date)).toBe(11);
    expect(quarterContainsMonth("4", "11")).toBe(true);
    expect(quarterContainsMonth("1", "11")).toBe(false);
  });

  it("starts the next financial year on 1 April", () => {
    const date = parseKolkataDate("2026-04-01");

    expect(getFiscalYear(date)).toBe(2026);
    expect(fiscalMonthIndex(date)).toBe(0);
    expect(quarterContainsMonth("1", "0")).toBe(true);
    expect(quarterContainsMonth("1,2", "0,5")).toBe(true);
    expect(quarterContainsMonth("1", "0,5")).toBe(false);
    expect(calendarParts(2026, 0)).toEqual({ calendarMonth: 3, calendarYear: 2026 });
  });

  it("ends March on the Kolkata calendar", () => {
    const end = endOfMonth(parseKolkataDate("2026-03-15"));

    expect(end.toISOString()).toBe("2026-03-31T18:29:59.999Z");
    expect(FIRST_FISCAL_YEAR).toBe(2010);
  });

  it("counts Kolkata calendar days across the financial-year boundary", () => {
    expect(
      calendarDaysBetween(parseKolkataDate("2026-04-01"), parseKolkataDate("2026-03-31")),
    ).toBe(1);
    expect(
      calendarDaysBetween(parseKolkataDate("2026-10-16"), parseKolkataDate("2026-10-16")),
    ).toBe(0);
  });
});
