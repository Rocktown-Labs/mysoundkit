import { describe, expect, it } from "vitest";

import { DEEP_LINK_SCHEME, parseDeepLink } from "./deep-link";

const appUrl = "https://mysoundkit.com";

describe("parseDeepLink", () => {
  it("resolves bare and empty links to the app root", () => {
    expect(parseDeepLink("soundkit://", appUrl)).toBe(appUrl);
    expect(parseDeepLink("soundkit://", appUrl)).toBe("https://mysoundkit.com");
  });

  it("resolves in-app routes with or without leading slashes", () => {
    expect(parseDeepLink("soundkit://dashboard/tracks", appUrl)).toBe(
      "https://mysoundkit.com/dashboard/tracks"
    );
    expect(parseDeepLink("soundkit:///live/battles/123", appUrl)).toBe(
      "https://mysoundkit.com/live/battles/123"
    );
  });

  it("preserves query strings used by auth callbacks", () => {
    expect(parseDeepLink("soundkit://tracks/9?autoplay=1", appUrl)).toBe(
      "https://mysoundkit.com/tracks/9?autoplay=1"
    );
  });

  it("rejects other schemes and plain paths", () => {
    expect(
      parseDeepLink("https://mysoundkit.com/dashboard", appUrl)
    ).toBeNull();
    expect(parseDeepLink("soundkit-pro://dashboard", appUrl)).toBeNull();
    expect(parseDeepLink("dashboard/tracks", appUrl)).toBeNull();
  });

  it("rejects traversal, encoded characters, and oversize links", () => {
    expect(parseDeepLink("soundkit://../admin", appUrl)).toBeNull();
    expect(
      parseDeepLink("soundkit://tracks/%2e%2e%2fadmin", appUrl)
    ).toBeNull();
    expect(parseDeepLink("soundkit://tracks/1?x=café", appUrl)).toBeNull();
    expect(
      parseDeepLink(`soundkit://tracks/${"a".repeat(2100)}`, appUrl)
    ).toBeNull();
  });

  it("uses the SoundKit scheme constant", () => {
    expect(DEEP_LINK_SCHEME).toBe("soundkit");
  });
});
