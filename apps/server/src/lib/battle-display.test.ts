import { describe, expect, it } from "vitest";

import {
  battleDemandScore,
  formatArtistBattleTitle,
  rankFeaturedBattleIds,
  resolveArtistBattleTitle,
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
