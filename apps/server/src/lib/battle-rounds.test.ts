import { describe, expect, it } from "vitest";

import { buildBattleRoundSeeds } from "./battle-rounds";

const tracksFor = (prefix: string) =>
  [
    { mainSlot: 1, role: "main", trackId: `${prefix}-1` },
    { mainSlot: 2, role: "main", trackId: `${prefix}-2` },
    { mainSlot: 3, role: "main", trackId: `${prefix}-3` },
    { mainSlot: null, role: "tiebreaker", trackId: `${prefix}-tb` },
  ] as const;

describe("battle round provisioning", () => {
  it("creates one matchup per main slot plus a tiebreaker", () => {
    const rounds = buildBattleRoundSeeds({
      artistA: { artistUserId: "artist-a", tracks: tracksFor("a") },
      artistB: { artistUserId: "artist-b", tracks: tracksFor("b") },
      battleId: "battle-1",
      format: "best_of_3",
    });

    expect(rounds).toHaveLength(4);
    expect(rounds?.[0]).toMatchObject({
      roundNumber: 1,
      status: "upcoming",
      trackOneId: "a-1",
      trackTwoId: "b-1",
    });
    expect(rounds?.[3]).toMatchObject({
      isTiebreaker: true,
      roundNumber: 4,
      status: "upcoming",
      trackOneId: "a-tb",
      trackTwoId: "b-tb",
    });
  });

  it("does not provision a room until both artists have ready lineups", () => {
    expect(
      buildBattleRoundSeeds({
        artistA: { artistUserId: "artist-a", tracks: tracksFor("a") },
        artistB: undefined,
        battleId: "battle-1",
        format: "best_of_3",
      })
    ).toBeNull();
  });
});
