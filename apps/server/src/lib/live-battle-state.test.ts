import { describe, expect, it } from "vitest";

import {
  createBattleCoordination,
  transitionBattle,
} from "@/lib/live-battle-state";
import type { LiveBattleRound, LiveRoomArtist } from "@/lib/live-room-data";

const artists: [LiveRoomArtist, LiveRoomArtist] = [
    {
      avatarUrl: "",
      id: "artist-a",
      isMuted: false,
      name: "Artist A",
      roundsWon: 0,
      stagePosition: "left" as const,
      verified: false,
    },
    {
      avatarUrl: "",
      id: "artist-b",
      isMuted: true,
      name: "Artist B",
      roundsWon: 0,
      stagePosition: "right" as const,
      verified: false,
    },
  ],
  makeRound = (number: number, isTiebreaker = false): LiveBattleRound => ({
    artistATrack: {
      artistName: "Artist A",
      coverArtUrl: "",
      durationMs: 180_000,
      id: `a-${number}`,
      lyrics: [],
      status: "queued",
      title: `A ${number}`,
    },
    artistBTrack: {
      artistName: "Artist B",
      coverArtUrl: "",
      durationMs: 180_000,
      id: `b-${number}`,
      lyrics: [],
      status: "queued",
      title: `B ${number}`,
    },
    id: `round-${number}`,
    isTiebreaker,
    number,
    status: "queued",
    voteTotals: { "artist-a": 0, "artist-b": 0 },
    winnerArtistId: null,
  }),
  host = (
    format: "best_of_3" | "best_of_5" | "best_of_7" = "best_of_3",
    admissionBatchSize = 50
  ) => {
    const coordination = createBattleCoordination({
      admissionBatchSize,
      battleId: "battle-1",
      durations: {
        betweenRoundsMs: 10,
        roundIntroMs: 10,
        roundResultMs: 10,
        transitionMs: 10,
        turnMs: 10,
        voteMs: 10,
        waitingRoomMs: 10,
      },
      format,
      now: 0,
    });
    return {
      battle: {
        artists,
        currentRoundId: "round-1",
        rounds: [makeRound(1), makeRound(2), makeRound(3), makeRound(4, true)],
        tiePolicy: "tiebreaker",
      },
      coordination,
    };
  };

describe("live battle state machine", () => {
  it("uses persisted phase timestamps and transitions without timer ticks", () => {
    const initial = host(),
      next = transitionBattle(initial, 10);

    expect(next.coordination.phase).toBe("round_intro");
    expect(next.coordination.phaseStartedAt).toBe(10);
    expect(next.coordination.phaseEndsAt).toBe(20);
    expect(next.coordination.lastTransitionVersion).toBe(1);
  });

  it("opens voting after both artist turns and snapshots admitted voters", () => {
    let state = host();
    state.coordination = {
      ...state.coordination,
      admittedUserIds: ["fan-1", "fan-2"],
      phase: "artist_b_turn",
      phaseEndsAt: 10,
      phaseStartedAt: 0,
    };

    state = transitionBattle(state, 10);
    expect(state.coordination.phase).toBe("pre_vote");
    state = transitionBattle(state, 21);

    expect(state.coordination.phase).toBe("voting");
    expect(state.coordination.requiredVoterUserIds).toEqual(["fan-1", "fan-2"]);
    expect(state.coordination.votedUserIds).toEqual([]);
  });

  it("ends a match as soon as the standard clinch score is reached", () => {
    const state = host(),
      roundOne = state.battle.rounds[0],
      roundTwo = state.battle.rounds[1];
    if (!(roundOne && roundTwo)) {
      throw new Error("Test rounds are missing.");
    }
    roundOne.winnerArtistId = "artist-a";
    roundTwo.winnerArtistId = "artist-a";
    state.coordination = {
      ...state.coordination,
      phase: "round_result",
      phaseEndsAt: 10,
      phaseStartedAt: 0,
      roundNumber: 2,
    };

    const next = transitionBattle(state, 10);
    expect(next.coordination.phase).toBe("battle_result");
    expect(next.coordination.winnerUserId).toBe("artist-a");
  });

  it("stays scheduled until the battle start and only then opens the waiting room", () => {
    const coordination = createBattleCoordination({
      battleId: "battle-1",
      durations: {
        betweenRoundsMs: 10,
        roundIntroMs: 10,
        roundResultMs: 10,
        transitionMs: 10,
        turnMs: 10,
        voteMs: 10,
        waitingRoomMs: 10,
      },
      format: "best_of_3",
      now: 0,
      scheduledStartAt: 7_200_000,
    });

    expect(coordination.phase).toBe("scheduled");
    expect(coordination.phaseEndsAt).toBe(7_200_000);

    const early = transitionBattle(
      { battle: host().battle, coordination },
      1000
    );
    expect(early.coordination.phase).toBe("scheduled");

    const opened = transitionBattle(
      { battle: host().battle, coordination },
      7_200_000
    );
    expect(opened.coordination.phase).toBe("waiting_room");
    expect(opened.coordination.phaseEndsAt).toBe(7_200_000 + 10);
  });

  it("admits the first batch of queued users when the battle opens and keeps the rest waiting", () => {
    let state = host();
    const coordination = {
      ...state.coordination,
      phase: "scheduled" as const,
      phaseEndsAt: 10,
      phaseStartedAt: 0,
      queuedUserIds: Array.from(
        { length: 120 },
        (_, index) => `fan-${index + 1}`
      ),
      waitingUserIds: [],
    };

    state = transitionBattle({ battle: state.battle, coordination }, 10);
    expect(state.coordination.phase).toBe("waiting_room");
    expect(state.coordination.admittedUserIds).toHaveLength(50);
    expect(state.coordination.queuedUserIds).toEqual([]);
    expect(state.coordination.waitingUserIds).toHaveLength(70);
  });

  it("admits the next batch only during the between-rounds window", () => {
    let state = host();
    const coordination = {
      ...state.coordination,
      phase: "scheduled" as const,
      phaseEndsAt: 10,
      phaseStartedAt: 0,
      queuedUserIds: Array.from(
        { length: 120 },
        (_, index) => `fan-${index + 1}`
      ),
      waitingUserIds: [],
    };

    state = transitionBattle({ battle: state.battle, coordination }, 10);
    expect(state.coordination.admittedUserIds).toHaveLength(50);

    state = transitionBattle(state, 20);
    expect(state.coordination.phase).toBe("round_intro");
    expect(state.coordination.admittedUserIds).toHaveLength(50);
    state = transitionBattle(state, 30);
    state = transitionBattle(state, 40);
    state = transitionBattle(state, 50);
    state = transitionBattle(state, 60);
    state = transitionBattle(state, 61);
    expect(state.coordination.phase).toBe("voting");
    expect(state.coordination.admittedUserIds).toHaveLength(50);

    state.coordination = {
      ...state.coordination,
      votedUserIds: (state.coordination.admittedUserIds ?? []).slice(0, 25),
    };
    state = transitionBattle(state, 71);
    expect(state.coordination.phase).toBe("round_result");
    state = transitionBattle(state, 81);
    expect(state.coordination.phase).toBe("between_rounds");
    expect(state.coordination.admittedUserIds).toHaveLength(25);

    state = transitionBattle(state, 91);
    expect(state.coordination.phase).toBe("round_intro");
    expect(state.coordination.admittedUserIds).toHaveLength(75);
    expect(state.coordination.waitingUserIds).toHaveLength(20);
  });

  it("admits thousands of queued users when the batch size is raised via coordination", () => {
    let state = host("best_of_3", 1000);
    const coordination = {
      ...state.coordination,
      phase: "scheduled" as const,
      phaseEndsAt: 10,
      phaseStartedAt: 0,
      queuedUserIds: Array.from(
        { length: 2500 },
        (_, index) => `fan-${index + 1}`
      ),
      waitingUserIds: [],
    };

    state = transitionBattle({ battle: state.battle, coordination }, 10);
    expect(state.coordination.phase).toBe("waiting_room");
    expect(state.coordination.admittedUserIds).toHaveLength(1000);
    expect(state.coordination.queuedUserIds).toEqual([]);
    expect(state.coordination.waitingUserIds).toHaveLength(1500);
  });
});
