import { describe, expect, it } from "vitest";

import { safeBrandingPath } from "./branding-path";
import { clientAddress } from "./client-address";
import { httpsUpgradeUrl } from "./https-upgrade";

describe("client address", () => {
  const headers = {
    get(name: string) {
      if (name === "x-forwarded-for") return "203.0.113.9, 198.51.100.2"
      return null
    },
  }

  it("ignores a caller-supplied forwarded address unless the proxy is trusted", () => {
    expect(clientAddress(headers, false)).toBe("")
    expect(clientAddress(headers, true)).toBe("198.51.100.2")
  })
})

describe("https upgrade", () => {
  it("redirects production http traffic from a named host", () => {
    expect(httpsUpgradeUrl({
      appEnv: "production",
      proto: "http",
      host: "billing.example",
      path: "/admin/home?tab=1",
    })).toBe("https://billing.example/admin/home?tab=1")

    expect(httpsUpgradeUrl({
      appEnv: "development",
      proto: "http",
      host: "billing.example",
      path: "/",
    })).toBeNull()

    expect(httpsUpgradeUrl({
      appEnv: "production",
      proto: "http",
      host: "localhost:3000",
      path: "/",
    })).toBeNull()
  })
})

describe("branding paths", () => {
  it("keeps an upload path and rejects traversal or remote addresses", () => {
    expect(safeBrandingPath("/uploads/11111111-1111-1111-1111-111111111111.png")).toBe(
      "/uploads/11111111-1111-1111-1111-111111111111.png",
    )
    expect(safeBrandingPath("")).toBeNull()
    expect(() => safeBrandingPath("/uploads/../.env")).toThrow(/not valid/)
    expect(() => safeBrandingPath("https://evil.example/logo.png")).toThrow(/not valid/)
  })
})
