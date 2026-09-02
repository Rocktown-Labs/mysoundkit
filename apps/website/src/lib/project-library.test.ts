import { describe, expect, it } from "vitest";

import { isTrackForProjectLibraryKind } from "./project-library";

const track = (overrides: Record<string, unknown> = {}) => ({
  catalogItemType: "single" as const,
  fileAvailability: { master: true },
  isPublic: false,
  masterDownloadUrl: "/v1/tracks/track-1/master",
  ...overrides,
});

describe("project library source filtering", () => {
  it("treats private singles with uploaded masters as concepts", () => {
    expect(isTrackForProjectLibraryKind(track(), "concept")).toBe(true);
    expect(
      isTrackForProjectLibraryKind(track({ isPublic: true }), "concept")
    ).toBe(false);
  });

  it("treats beat catalog uploads as beats", () => {
    expect(
      isTrackForProjectLibraryKind(track({ catalogItemType: "beat" }), "beat")
    ).toBe(true);
    expect(isTrackForProjectLibraryKind(track(), "beat")).toBe(false);
  });

  it("only shows uploaded masters in the master collection", () => {
    expect(isTrackForProjectLibraryKind(track(), "master")).toBe(true);
    expect(
      isTrackForProjectLibraryKind(
        track({ fileAvailability: { master: false }, masterDownloadUrl: null }),
        "master"
      )
    ).toBe(false);
  });
});
