/* oxlint-disable sort-vars -- Assertions follow environment order. */
import {
  isolatedSessionScope,
  nativeSessionScope,
} from "@soundkit/env/session-scope";
import { describe, expect, it } from "vitest";

describe("environment session scopes", () => {
  it("preserves production native credentials and cookie names", () => {
    expect(
      nativeSessionScope("https://api.mysoundkit.com/auth", "soundkit")
    ).toEqual({
      cookiePrefix: "better-auth",
      storagePrefix: "soundkit",
    });
    expect(isolatedSessionScope("https://api.mysoundkit.com")).toBeNull();
  });
  it("scopes staging and previews outside each other's parent domain", () => {
    const staging = isolatedSessionScope("https://api.staging.soundkit.bio"),
      first = isolatedSessionScope("https://api.pr-520.preview.soundkit.bio"),
      second = isolatedSessionScope("https://api.pr-521.preview.soundkit.bio");
    expect(staging).toEqual({
      cookiePrefix: "soundkit-staging",
      domain: "staging.soundkit.bio",
    });
    expect(first).toEqual({
      cookiePrefix: "soundkit-pr-520",
      domain: "pr-520.preview.soundkit.bio",
    });
    expect(second?.domain.endsWith(`.${first?.domain}`)).toBe(false);
    expect(first?.domain.endsWith(`.${staging?.domain}`)).toBe(false);
  });
  it("does not grant a shared cookie domain to lookalikes or non-HTTPS endpoints", () => {
    for (const url of [
      "https://api.staging.soundkit.bio.attacker.test",
      "http://api.staging.soundkit.bio",
      "https://api.pr-0.preview.soundkit.bio",
      "https://api.staging.soundkit.bio:4430",
    ]) {
      expect(isolatedSessionScope(url)).toBeNull();
    }
  });
  it("separates native credentials by complete origin, retaining the app scheme", () => {
    const endpoints = [
        "https://api.staging.soundkit.bio",
        "https://api.pr-520.preview.soundkit.bio",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://api-staging.mysoundkit.com",
      ],
      scopes = endpoints.map((url) => nativeSessionScope(url, "soundkit"));
    expect(new Set(scopes.map((scope) => scope.storagePrefix)).size).toBe(
      endpoints.length
    );
    expect(
      scopes.every((scope) => /^[a-zA-Z0-9._-]+$/u.test(scope.storagePrefix))
    ).toBe(true);
    expect(scopes[0]?.cookiePrefix).toBe("soundkit-staging");
    expect(nativeSessionScope(`${endpoints[0]}/auth`, "soundkit")).toEqual(
      scopes[0]
    );
    expect(
      nativeSessionScope("https://api.staging.soundkit.bio", "other")
        .storagePrefix
    ).not.toBe(scopes[0]?.storagePrefix);
  });
});

it("rejects malformed native origins without falling back to production storage", () => {
  for (const invalid of ["", "private configuration", "file:///api/auth"]) {
    expect(isolatedSessionScope(invalid)).toBeNull();
    expect(() => nativeSessionScope(invalid, "soundkit")).toThrow(
      "Invalid SoundKit API URL configuration"
    );
  }
});
