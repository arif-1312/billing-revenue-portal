import { describe, expect, it } from "vitest";

import { formatError } from "./utils";

describe("formatError", () => {
  it("keeps a business validation message", () => {
    expect(formatError(new Error("Customer code is required"))).toBe(
      "Customer code is required",
    );
    expect(formatError(new Error("Password is required"))).toBe(
      "Password is required",
    );
  });

  it("hides driver and database details", () => {
    const prismaError = {
      name: "PrismaClientKnownRequestError",
      code: "P2025",
      message: "postgres://billing:secret@example.internal:5432/billing",
    };

    expect(formatError(prismaError)).toBe("Something went wrong");
    expect(formatError(new Error("Invalid `prisma.customer.delete()` invocation"))).toBe(
      "Something went wrong",
    );
  });

  it("keeps a unique-constraint message without the database text", () => {
    expect(
      formatError({
        name: "PrismaClientKnownRequestError",
        code: "P2002",
        message: "Unique constraint failed",
        meta: { target: ["email"] },
      }),
    ).toBe("Email already exists");
  });
});
