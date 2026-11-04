import {
  isTurnstileResponseValid,
  verifyTurnstileRequest,
} from "@soundkit/auth/turnstile";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("explicit synthetic environment CAPTCHA policy", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("fails closed with no credentials unless the explicit bypass is true", async () => {
    vi.stubEnv("TURNSTILE_SECRET", "");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "");
    vi.stubEnv("DESKTOP_AUTH_SECRET", "");
    const request = new Request(
      "https://api.staging.soundkit.bio/auth/sign-in/email"
    );
    vi.stubEnv("TURNSTILE_DISABLED", "false");
    expect(await verifyTurnstileRequest({ action: "login", request })).toBe(
      false
    );
    vi.stubEnv("TURNSTILE_DISABLED", "true");
    expect(await verifyTurnstileRequest({ action: "login", request })).toBe(
      true
    );
  });
});
