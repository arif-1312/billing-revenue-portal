import { beforeEach, describe, expect, it } from "vitest";

import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
  resetLoginThrottleForTests,
} from "./login-throttle";

beforeEach(() => {
  resetLoginThrottleForTests();
});

describe("login throttle", () => {
  it("locks a username after five failures and unlocks when the window expires", () => {
    const now = 1_000;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(isLoginLocked("Ada", now)).toBe(false);
      recordLoginFailure("Ada", now);
    }

    expect(isLoginLocked("ada", now + 1)).toBe(true);
    expect(isLoginLocked("Ada", now + 15 * 60 * 1000 + 1)).toBe(false);
  });

  it("clears failures after a successful login", () => {
    recordLoginFailure("Ada", 1_000);
    recordLoginFailure("Ada", 1_000);
    clearLoginFailures(" Ada ");

    expect(isLoginLocked("ada", 1_000)).toBe(false);
  });
});
