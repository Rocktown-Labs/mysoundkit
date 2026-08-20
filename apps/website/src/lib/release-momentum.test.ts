import { describe, expect, it } from "vitest";

import { isReleasedTrack } from "./release-momentum";

const baseTrack = {
  isPublic: true,
  releaseAt: null,
  releaseStrategy: "publish_when_ready" as const,
};

describe("release momentum release filtering", () => {
  it("includes a public publish-when-ready track", () => {
    expect(isReleasedTrack(baseTrack)).toBe(true);
  });

  it("excludes private and unreleased tracks", () => {
    expect(isReleasedTrack({ ...baseTrack, isPublic: false })).toBe(false);
    expect(
      isReleasedTrack(
        {
          ...baseTrack,
          releaseAt: "2027-01-01T00:00:00.000Z",
          releaseStrategy: "scheduled",
        },
        new Date("2026-01-01T00:00:00.000Z").getTime()
      )
    ).toBe(false);
  });

  it("includes a scheduled track after its release time", () => {
    expect(
      isReleasedTrack(
        {
          ...baseTrack,
          releaseAt: "2025-01-01T00:00:00.000Z",
          releaseStrategy: "scheduled",
        },
        new Date("2026-01-01T00:00:00.000Z").getTime()
      )
    ).toBe(true);
  });
});
