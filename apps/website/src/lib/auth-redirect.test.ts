import { describe, expect, it } from "vitest";

import { DEFAULT_AUTH_REDIRECT, sanitizeAuthRedirect } from "./auth-redirect";

describe("sanitizeAuthRedirect", () => {
  it("allows safe relative paths", () => {
    expect(sanitizeAuthRedirect("/library/playlists")).toBe(
      "/library/playlists"
    );
    expect(sanitizeAuthRedirect("/tracks?genre=hip-hop")).toBe(
      "/tracks?genre=hip-hop"
    );
    expect(sanitizeAuthRedirect("/")).toBe("/");
  });

  it("falls back for non-string or non-relative values", () => {
    expect(sanitizeAuthRedirect()).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeAuthRedirect(null)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeAuthRedirect("https://evil.com")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
    expect(sanitizeAuthRedirect("dashboard")).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it("rejects protocol-relative and backslash-normalized open redirects", () => {
    expect(sanitizeAuthRedirect("//evil.com")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeAuthRedirect("/\\evil.com")).toBe(DEFAULT_AUTH_REDIRECT);
  });

  it("rejects control characters", () => {
    expect(sanitizeAuthRedirect("/dashboard\r\nSet-Cookie: a=b")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
    expect(sanitizeAuthRedirect("/dashboard\u0000")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
  });

  it("rejects self-targeting login routes to avoid redirect loops", () => {
    expect(sanitizeAuthRedirect("/login")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeAuthRedirect("/login?redirect=%2Fdashboard")).toBe(
      DEFAULT_AUTH_REDIRECT
    );
    expect(sanitizeAuthRedirect("/login/callback")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeAuthRedirect("/login#form")).toBe(DEFAULT_AUTH_REDIRECT);
  });
});
