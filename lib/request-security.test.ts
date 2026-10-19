import { describe, expect, it } from "vitest";

import { isAllowedMutationOrigin } from "./origin-check";
import { consumeRateLimit, resetRateLimitsForTests } from "./action-rate-limit";
import { cssColor, cssIdentifier } from "./chart-style";
import { securityHeadersFor } from "./security-headers";

describe("request origin checks", () => {
  it("allows the same host and rejects a foreign origin", () => {
    expect(
      isAllowedMutationOrigin("http://localhost:3000", "localhost:3000"),
    ).toBe(true);
    expect(
      isAllowedMutationOrigin("https://evil.example", "billing.example"),
    ).toBe(false);
    expect(isAllowedMutationOrigin("not a url", "localhost:3000")).toBe(false);
    expect(isAllowedMutationOrigin(null, "localhost:3000")).toBe(false);
    expect(isAllowedMutationOrigin("null", "localhost:3000")).toBe(false);
  });
});

describe("action rate limits", () => {
  it("blocks the request after the configured limit", () => {
    resetRateLimitsForTests();
    expect(consumeRateLimit("export:ada", 2, 60_000, 1_000)).toBe(true);
    expect(consumeRateLimit("export:ada", 2, 60_000, 1_000)).toBe(true);
    expect(consumeRateLimit("export:ada", 2, 60_000, 1_000)).toBe(false);
    expect(consumeRateLimit("export:ada", 2, 60_000, 61_001)).toBe(true);
  });
});

describe("chart style values", () => {
  it("keeps ordinary colors and drops values that can break out of CSS", () => {
    expect(cssColor("#2563eb")).toBe("#2563eb");
    expect(cssColor("hsl(var(--chart-1))")).toBe("hsl(var(--chart-1))");
    expect(cssColor("red; } body { background: url(https://evil)")).toBeNull();
    expect(cssIdentifier("revenue")).toBe("revenue");
    expect(cssIdentifier("a] { }")).toBeNull();
  });
});

describe("production headers", () => {
  it("adds HSTS only in production", () => {
    expect(
      securityHeadersFor("development").some(
        (header) => header.key === "Strict-Transport-Security",
      ),
    ).toBe(false);
    expect(
      securityHeadersFor("production").some(
        (header) => header.key === "Strict-Transport-Security",
      ),
    ).toBe(true);
  });
});
