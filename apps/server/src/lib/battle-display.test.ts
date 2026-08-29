import { describe, expect, it } from "vitest";

import {
  battleDemandScore,
  battleHasPlayedTurn,
  formatArtistBattleTitle,
  isDurableReplayPlaybackUrl,
  rankFeaturedBattleIds,
  resolveArtistBattleTitle,
  resolveBattleReplayStatus,
} from "./battle-display";

describe("battle display helpers", () => {
  it("formats canonical artist battle titles", () => {
    expect(formatArtistBattleTitle("hip-hop-rap")).toBe(
      "Artist Battle - Hip Hop"
    );
    expect(
      resolveArtistBattleTitle("SoundKit Artist Battle", "Electronic")
    ).toBe("Artist Battle - Electronic");
    expect(resolveArtistBattleTitle("Summer Showdown", "Electronic")).toBe(
      "Summer Showdown"
    );
  });

  it("requires a real turn before exposing a battle as replay activity", () => {
    expect(
      battleHasPlayedTurn({
        outcome: "canceled",
        roundStatuses: [],
      })
    ).toBe(false);
    expect(
      battleHasPlayedTurn({
        outcome: "quit",
        roundStatuses: ["active"],
      })
    ).toBe(true);
    expect(
      battleHasPlayedTurn({
        outcome: null,
        roundStatuses: ["upcoming", "completed"],
      })
    ).toBe(true);
    expect(
      battleHasPlayedTurn({
        experienceStartedAt: new Date(),
        outcome: "canceled",
        roundStatuses: [],
      })
    ).toBe(true);
  });

  it("only treats copied media paths as durable replay URLs", () => {
    expect(
      isDurableReplayPlaybackUrl(
        "https://media.mysoundkit.com/media/live-recordings/battle-1/recording.mp4"
      )
    ).toBe(true);
    expect(
      isDurableReplayPlaybackUrl(
        "https://api.realtime.cloudflare.com/download/1"
      )
    ).toBe(false);
    expect(isDurableReplayPlaybackUrl(null)).toBe(false);
  });

  it("distinguishes available, processing, and missing replays", () => {
    expect(
      resolveBattleReplayStatus({
        recordingStatus: "UPLOADED",
        replayPublishedAt: null,
        replayVideoAvailable: true,
      })
    ).toBe("available");
    expect(
      resolveBattleReplayStatus({
        recordingStatus: "UPLOADING",
        replayPublishedAt: null,
        replayVideoAvailable: false,
      })
    ).toBe("processing");
    expect(
      resolveBattleReplayStatus({
        recordingStatus: null,
        replayPublishedAt: null,
        replayVideoAvailable: false,
      })
    ).toBe("none");
  });

  it("uses viewers for live demand and queue size for scheduled demand", () => {
    expect(
      battleDemandScore({
        queueSize: 99,
        status: "live",
        viewerCount: 12,
      })
    ).toBe(12);
    expect(
      battleDemandScore({
        queueSize: 99,
        status: "scheduled",
        viewerCount: 12,
      })
    ).toBe(99);
  });

  it("ranks only demanded live and scheduled battles", () => {
    expect([
      ...rankFeaturedBattleIds(
        [
          {
            id: "scheduled-high",
            queueSize: 20,
            status: "scheduled",
            viewerCount: 0,
          },
          {
            id: "live-high",
            queueSize: 1,
            status: "live",
            viewerCount: 18,
          },
          {
            id: "completed",
            queueSize: 100,
            status: "completed",
            viewerCount: 100,
          },
          {
            id: "no-demand",
            queueSize: 0,
            status: "scheduled",
            viewerCount: 0,
          },
        ],
        6
      ).entries(),
    ]).toEqual([
      ["scheduled-high", 1],
      ["live-high", 2],
    ]);
  });
});
