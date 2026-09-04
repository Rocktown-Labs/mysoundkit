import { describe, expect, it } from "vitest";

import { isPublicCacheRequest, publicCacheKey } from "./public-response-cache";

describe("public response cache policy", () => {
  it.each([
    "https://api.mysoundkit.com/v1/tracks?scope=public&region=all",
    "https://api.mysoundkit.com/v1/videos?region=all",
    "https://api.mysoundkit.com/v1/projects/public?region=all",
    "https://api.mysoundkit.com/v1/artists?region=all",
    "https://api.mysoundkit.com/v1/artists/discover?region=all",
    "https://api.mysoundkit.com/v1/artists/luna-eclipse",
    "https://api.mysoundkit.com/v1/artists/luna-eclipse/media?section=feed",
    "https://api.mysoundkit.com/v1/discover/genres",
  ])("allows invariant public catalog reads", (url) => {
    expect(isPublicCacheRequest(new Request(url))).toBe(true);
  });

  it.each([
    "https://api.mysoundkit.com/v1/tracks",
    "https://api.mysoundkit.com/v1/tracks?scope=dashboard",
    "https://api.mysoundkit.com/v1/me",
    "https://api.mysoundkit.com/v1/live/experiences/public",
    "https://media.mysoundkit.com/media/tracks/user/master.wav",
  ])("does not cache personalized or real-time reads", (url) => {
    expect(isPublicCacheRequest(new Request(url))).toBe(false);
  });

  it("bypasses authorized requests", () => {
    expect(
      isPublicCacheRequest(
        new Request("https://api.mysoundkit.com/v1/artists", {
          headers: { Authorization: "Bearer secret" },
        })
      )
    ).toBe(false);
  });

  it("canonicalizes query order while keeping the deployment host", () => {
    const first = publicCacheKey(
        new Request(
          "https://api-pr-91.mysoundkit.com/v1/artists?sort=rank-asc&region=all"
        )
      ),
      second = publicCacheKey(
        new Request(
          "https://api-pr-91.mysoundkit.com/v1/artists?region=all&sort=rank-asc"
        )
      );

    expect(first.url).toBe(second.url);
    expect(first.url).toContain("api-pr-91.mysoundkit.com");
  });
});
