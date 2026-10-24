import { describe, expect, it } from "vitest"

import { outstandingBalance } from "./outstanding"

describe("notification outstanding balance", () => {
  it("subtracts successfully recorded payments from the invoice amount", () => {
    expect(
      outstandingBalance(1000, [{ amount: 200 }, { amount: 300 }]),
    ).toBe(500)
  })

  it("keeps a partial payment outstanding", () => {
    expect(outstandingBalance(1000, [{ amount: 400 }])).toBe(600)
  })

  it("treats a fully paid invoice as settled", () => {
    expect(
      outstandingBalance(1000, [{ amount: 600 }, { amount: 400 }]),
    ).toBe(0)
  })

  it("returns a negative balance when payments exceed the invoice", () => {
    expect(outstandingBalance(1000, [{ amount: 1200 }])).toBe(-200)
  })

  it("ignores zero and negative payment rows", () => {
    expect(
      outstandingBalance(1000, [{ amount: 100 }, { amount: 0 }, { amount: -20 }]),
    ).toBe(900)
  })

  it("rounds to cents", () => {
    expect(outstandingBalance(1000, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(999.7)
  })

  it("treats a missing payment list as unpaid", () => {
    expect(outstandingBalance(250, null)).toBe(250)
    expect(outstandingBalance(0, [])).toBe(0)
  })
})
