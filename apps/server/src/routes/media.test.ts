import { describe, expect, it } from "vitest";

import { objectKeyFromPath } from "./media";

describe("media object paths", () => {
  it("preserves object key path separators", () => {
    expect(objectKeyFromPath("/media/profiles/user/cover%20art.jpg")).toBe(
      "profiles/user/cover art.jpg"
    );
  });

  it.each([
    "/media/../secrets.txt",
    "/media/profiles/../secrets.txt",
    "/media/profiles/%2e%2e/secrets.txt",
    "/media/profiles/user/%2e%2e%5csecrets.txt",
    "/media/%2e%2e",
  ])("rejects traversal path %s", (path) => {
    expect(objectKeyFromPath(path)).toBeNull();
  });

  it("rejects malformed and non-media paths", () => {
    expect(objectKeyFromPath("/media/profiles/%E0%A4%A")).toBeNull();
    expect(objectKeyFromPath("/v1/media/profiles/avatar.jpg")).toBeNull();
    expect(objectKeyFromPath("/media//profiles/avatar.jpg")).toBeNull();
  });
});
