import { describe, expect, it } from "vitest";

import { isTurnstileResponseValid } from "@soundkit/auth/turnstile";

describe("Turnstile response validation", () => {
  const expectedHostnames = new Set(["mysoundkit.com", "www.mysoundkit.com"]);

  it("requires success, the expected action, and an allowed hostname", () => {
    expect(
      isTurnstileResponseValid({
        expectedAction: "signup",
        expectedHostnames,
        response: {
          action: "signup",
          hostname: "mysoundkit.com",
          success: true,
        },
      })
    ).toBe(true);

    expect(
      isTurnstileResponseValid({
        expectedAction: "signup",
        expectedHostnames,
        response: {
          action: "login",
          hostname: "mysoundkit.com",
          success: true,
        },
      })
    ).toBe(false);
    expect(
      isTurnstileResponseValid({
        expectedAction: "signup",
        expectedHostnames,
        response: {
          action: "signup",
          hostname: "evil.example",
          success: true,
        },
      })
    ).toBe(false);
  });
});
