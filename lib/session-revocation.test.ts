import { describe, expect, it } from "vitest";

import { decideSession, isSignedInSession } from "./session-decision";
import { passwordFingerprint } from "./password";

describe("session decisions", () => {
  const current = passwordFingerprint("stored-hash");

  it("accepts an active session with the current password fingerprint", () => {
    expect(
      decideSession({
        status: "ACTIVE",
        currentFingerprint: current,
        tokenFingerprint: current,
        loggedOutAfterIssue: false,
      }),
    ).toBe("valid");
  });

  it("rejects logout, password changes, inactive users, and missing fingerprints", () => {
    expect(
      decideSession({
        status: "ACTIVE",
        currentFingerprint: current,
        tokenFingerprint: current,
        loggedOutAfterIssue: true,
      }),
    ).toBe("invalid");
    expect(
      decideSession({
        status: "ACTIVE",
        currentFingerprint: passwordFingerprint("new-hash"),
        tokenFingerprint: current,
        loggedOutAfterIssue: false,
      }),
    ).toBe("invalid");
    expect(
      decideSession({
        status: "INACTIVE",
        currentFingerprint: current,
        tokenFingerprint: current,
        loggedOutAfterIssue: false,
      }),
    ).toBe("invalid");
    expect(
      decideSession({
        status: "ACTIVE",
        currentFingerprint: current,
        tokenFingerprint: undefined,
        loggedOutAfterIssue: false,
      }),
    ).toBe("invalid");
  });

  it("does not treat a session without an email as signed in", () => {
    expect(isSignedInSession(null)).toBe(false);
    expect(isSignedInSession({})).toBe(false);
    expect(isSignedInSession({ user: undefined })).toBe(false);
    expect(isSignedInSession({ user: { email: "ada@example.com" } })).toBe(true);
  });

  it("does not reuse the password hash as the session fingerprint", () => {
    expect(passwordFingerprint("stored-hash")).not.toBe("stored-hash");
  });
});
