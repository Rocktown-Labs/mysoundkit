import { describe, expect, it } from "vitest";

import {
  dedupeBattleKitTracks,
  evaluateBattleKitReadiness,
  validateBattleKitTracks,
} from "./battle-kits";

const mainTracks = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    mainSlot: index + 1,
    role: "main" as const,
    trackId: `track-${index + 1}`,
  }));

describe("Battle Kit readiness", () => {
  it("keeps only the first copy of each track", () => {
    expect(
      dedupeBattleKitTracks([
        { id: "kit-track-1", trackId: "track-1" },
        { id: "kit-track-1-cover-duplicate", trackId: "track-1" },
        { id: "kit-track-2", trackId: "track-2" },
      ])
    ).toEqual([
      { id: "kit-track-1", trackId: "track-1" },
      { id: "kit-track-2", trackId: "track-2" },
    ]);
  });

  it.each([
    ["best_of_3", 3],
    ["best_of_5", 5],
    ["best_of_7", 7],
  ] as const)(
    "requires the main set plus a tiebreaker for %s",
    (format, count) => {
      const tracks = mainTracks(count);

      expect(evaluateBattleKitReadiness({ format, tracks }).isBattleReady).toBe(
        false
      );
      expect(
        evaluateBattleKitReadiness({
          format,
          tracks: [
            ...tracks,
            { mainSlot: null, role: "tiebreaker", trackId: "tiebreaker" },
          ],
        }).isBattleReady
      ).toBe(true);
    }
  );

  it("does not allow the tiebreaker to duplicate a main track", () => {
    const tracks = [
      ...mainTracks(3),
      { mainSlot: null, role: "tiebreaker" as const, trackId: "track-1" },
    ];

    expect(
      evaluateBattleKitReadiness({ format: "best_of_3", tracks })
    ).toMatchObject({
      isBattleReady: false,
      reason: "A track can only appear once in a Battle Kit.",
    });
    expect(validateBattleKitTracks({ format: "best_of_3", tracks })).toBe(
      "A track can only appear once in a Battle Kit."
    );
  });

  it("allows incomplete saved drafts but never marks them ready", () => {
    const tracks = mainTracks(2);

    expect(validateBattleKitTracks({ format: "best_of_3", tracks })).toBeNull();
    expect(
      evaluateBattleKitReadiness({ format: "best_of_3", tracks })
    ).toMatchObject({
      isBattleReady: false,
      mainTrackCount: 2,
      totalRequiredTracks: 4,
    });
  });

  it("requires consecutive main slots and one tiebreaker", () => {
    const tracks = [
      { mainSlot: 1, role: "main" as const, trackId: "track-1" },
      { mainSlot: 3, role: "main" as const, trackId: "track-2" },
      { mainSlot: null, role: "tiebreaker" as const, trackId: "track-3" },
    ];

    expect(validateBattleKitTracks({ format: "best_of_3", tracks })).toContain(
      "consecutive slots"
    );
  });
});
