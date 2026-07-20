import { describe, expect, it } from "vitest";

import {
  hasReachedQualifiedPlayback,
  minimumPlayedSecondsForQualification,
  qualificationWindowKey,
  shouldExcludeArtistSeatStream,
} from "./stream-qualification-rules";

describe("stream qualification seat exclusions", () => {
  it("excludes listeners who occupy an artist Premium workspace seat", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner", "manager", "producer"],
        listenerUserId: "producer",
      })
    ).toBe(true);
  });

  it("does not exclude unrelated listeners", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner", "manager", "producer"],
        listenerUserId: "fan_listener",
      })
    ).toBe(false);
  });

  it("does not exclude anonymous playback", () => {
    expect(
      shouldExcludeArtistSeatStream({
        artistPlanMemberUserIds: ["artist_owner"],
        listenerUserId: null,
      })
    ).toBe(false);
  });

  it("requires 70% playback when fixed seconds are disabled", () => {
    expect(
      minimumPlayedSecondsForQualification({
        durationSeconds: 200,
        thresholdPercent: 70,
        thresholdSeconds: 0,
      })
    ).toBe(140);
    expect(
      hasReachedQualifiedPlayback({
        durationSeconds: 200,
        playedSeconds: 139,
        thresholdPercent: 70,
        thresholdSeconds: 0,
      })
    ).toBe(false);
    expect(
      hasReachedQualifiedPlayback({
        durationSeconds: 200,
        playedSeconds: 140,
        thresholdPercent: 70,
        thresholdSeconds: 0,
      })
    ).toBe(true);
  });

  it("uses fixed seconds only when the config enables them", () => {
    expect(
      minimumPlayedSecondsForQualification({
        durationSeconds: 200,
        thresholdPercent: 70,
        thresholdSeconds: 30,
      })
    ).toBe(30);
  });

  it("builds deterministic deduplication window keys", () => {
    expect(
      qualificationWindowKey({
        deduplicationWindowHours: 24,
        occurredAt: new Date("2026-07-19T12:00:00.000Z"),
      })
    ).toBe(
      qualificationWindowKey({
        deduplicationWindowHours: 24,
        occurredAt: new Date("2026-07-19T23:59:00.000Z"),
      })
    );
  });
});
