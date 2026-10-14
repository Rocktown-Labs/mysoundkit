import { describe, expect, it } from "vitest";

import { createNavigationPolicy } from "./navigation-policy";

const devPolicy = createNavigationPolicy({
    appUrl: "http://localhost:4311",
    devOrigin: "http://localhost:5173",
  }),
  policy = createNavigationPolicy({
    appUrl: "https://mysoundkit.com",
    devOrigin: null,
  });

describe("createNavigationPolicy", () => {
  it("allows the app origin and its subdomains", () => {
    expect(policy.isAllowedInWindow("https://mysoundkit.com/dashboard")).toBe(
      true
    );
    expect(
      policy.isAllowedInWindow("https://api.mysoundkit.com/auth/sign-in/social")
    ).toBe(true);
    expect(
      policy.isAllowedInWindow("https://media.mysoundkit.com/tracks/1.mp3")
    ).toBe(true);
  });

  it("allows the Google OAuth consent host but not all of google.com", () => {
    expect(
      policy.isAllowedInWindow("https://accounts.google.com/o/oauth2/v2/auth")
    ).toBe(true);
    expect(policy.isAllowedInWindow("https://www.google.com/")).toBe(false);
  });

  it("rejects lookalike and suffixed hosts", () => {
    expect(policy.isAllowedInWindow("https://evilmysoundkit.com/login")).toBe(
      false
    );
    expect(
      policy.isAllowedInWindow("https://mysoundkit.com.evil.io/login")
    ).toBe(false);
    expect(policy.isAllowedInWindow("https://mysoundkit.com:8443/login")).toBe(
      true
    );
  });

  it("rejects non-http(s) URLs and malformed input", () => {
    // oxlint-disable-next-line eslint/no-script-url -- fixture input the policy must reject
    expect(policy.isAllowedInWindow("javascript:alert(1)")).toBe(false);
    expect(policy.isAllowedInWindow("file:///etc/passwd")).toBe(false);
    expect(policy.isAllowedInWindow("not a url")).toBe(false);
    expect(policy.isAllowedInWindow("")).toBe(false);
  });

  it("allows the configured dev origin exactly", () => {
    expect(
      devPolicy.isAllowedInWindow("http://localhost:5173/error.html")
    ).toBe(true);
    expect(devPolicy.isAllowedInWindow("http://localhost:3000/")).toBe(true);
    expect(devPolicy.isAllowedInWindow("http://127.0.0.1:5173/")).toBe(false);
  });

  it("routes external http(s), mailto, and tel to the system browser", () => {
    expect(policy.canOpenExternally("https://soundkit.bio/atlas")).toBe(true);
    expect(policy.canOpenExternally("http://example.com")).toBe(true);
    expect(policy.canOpenExternally("mailto:hi@mysoundkit.com")).toBe(true);
    expect(policy.canOpenExternally("tel:+15550001234")).toBe(true);
  });

  it("never sends in-app URLs or dangerous schemes to the system browser", () => {
    expect(policy.canOpenExternally("https://mysoundkit.com/dashboard")).toBe(
      true
    );
    expect(policy.canOpenExternally("file:///etc/passwd")).toBe(false);
    // oxlint-disable-next-line eslint/no-script-url -- fixture input the policy must reject
    expect(policy.canOpenExternally("javascript:alert(1)")).toBe(false);
    expect(policy.canOpenExternally("chrome://version")).toBe(false);
  });
});
