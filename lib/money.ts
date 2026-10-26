import { Prisma } from "@prisma/client"

const SCALE = 2

export function money(value: unknown) {
  if (value instanceof Prisma.Decimal) return value

  if (value == null || value === "") return new Prisma.Decimal(0)

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return new Prisma.Decimal(0)
    return new Prisma.Decimal(value.toFixed(SCALE))
  }

  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "")
    if (!trimmed) return new Prisma.Decimal(0)
    return new Prisma.Decimal(trimmed).toDecimalPlaces(SCALE)
  }

  if (typeof value === "object" && value !== null && "toString" in value) {
    return new Prisma.Decimal(String(value)).toDecimalPlaces(SCALE)
  }

  return new Prisma.Decimal(0)
}

export function addMoney(left: unknown, right: unknown) {
  return money(left).plus(money(right))
}

export function subtractMoney(left: unknown, right: unknown) {
  return money(left).minus(money(right))
}

/** Rounded currency amount safe to hand to existing numeric UI fields. */
export function moneyToNumber(value: unknown) {
  return Number(money(value).toDecimalPlaces(SCALE).toFixed(SCALE))
}

export function moneyGreaterThan(left: unknown, right: unknown) {
  return money(left).greaterThan(money(right))
}
