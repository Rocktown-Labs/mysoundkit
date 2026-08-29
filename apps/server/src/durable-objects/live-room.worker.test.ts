/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { describe, expect, it } from "vitest";

import { createBattleCoordination } from "../lib/live-battle-state";
import { createSampleLiveRoom } from "../lib/live-room-data";
import { battleBotMessageForPhase, battleOutcomeMessage } from "./live-room";

describe("battle announcer messages", () => {
  it("includes the round tracks and a voting instruction without a prefix", () => {
    const room = createSampleLiveRoom("battle-1");
    if (!room.battle) {
      throw new Error("Expected sample battle room.");
    }

    room.battle.coordination = {
      ...createBattleCoordination({
        battleId: room.id,
        format: "best_of_3",
      }),
      activeArtistUserId: null,
      phase: "voting",
      roundNumber: 3,
    };

    const message = battleBotMessageForPhase(room, "voting");
    expect(message).toContain("Electric Pulse");
    expect(message).toContain("Urban Flow");
    expect(message).toContain("Vote");
    expect(message).not.toContain("BattleBot:");
  });

  it("explains a no-show as a no-result terminal state", () => {
    const room = createSampleLiveRoom("battle-1");
    if (!room.battle) {
      throw new Error("Expected sample battle room.");
    }

    room.battle.coordination = {
      ...createBattleCoordination({
        battleId: room.id,
        format: "best_of_3",
      }),
      outcome: {
        affectedUserId: room.battle.artists[1].id,
        kind: "canceled",
        reason: "artist_unavailable",
        recordedAt: Date.now(),
      },
      phase: "ended",
    };

    expect(battleOutcomeMessage(room)).toBe(
      "The battle was canceled before the first turn. No result was recorded. The room is now closed."
    );
    expect(battleBotMessageForPhase(room, "ended")).toContain(
      "No result was recorded"
    );
  });
});
