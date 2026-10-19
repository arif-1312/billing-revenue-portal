import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("sets browser protections and keeps content security policy in report-only mode", () => {
    const keys = securityHeaders.map((header) => header.key);

    expect(keys).toEqual([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy-Report-Only",
    ]);
    expect(keys).not.toContain("Content-Security-Policy");
  });
});

describe("session configuration", () => {
  it("uses a twelve hour session and does not rewrite the user during login", () => {
    const source = readFileSync(path.join(process.cwd(), "auth.ts"), "utf8");

    expect(source).toContain("maxAge: TWELVE_HOURS");
    expect(source).toContain("token.role = user.role");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain("sameSite: \"lax\"");
    expect(source).not.toContain("prisma.user.update");
    expect(source).not.toContain("firstName: token.name");
  });
});
