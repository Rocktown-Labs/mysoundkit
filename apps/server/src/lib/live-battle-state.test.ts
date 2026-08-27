/* eslint-disable one-var, sort-vars, prefer-destructuring */
import { describe, expect, it } from "vitest";

import {
  advanceBattleToNow,
  createBattleCoordination,
  phaseDuration,
  transitionBattle,
} from "@/lib/live-battle-state";
import type { BattlePhase } from "@/lib/live-battle-state";
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
  it("waits for both artists before starting the first round", () => {
    const state = host();
    state.coordination.phaseEndsAt = 10;

    expect(transitionBattle(state, 10).coordination.phase).toBe("waiting_room");

    state.coordination.artistReadyUserIds = ["artist-a", "artist-b"];
    const started = transitionBattle(state, 10);
    expect(started.coordination.phase).toBe("round_intro");
    expect(started.coordination.phaseEndsAt).toBe(20);
  });

  it("uses persisted phase timestamps and transitions without timer ticks", () => {
    const initial = host();
    initial.coordination.artistReadyUserIds = ["artist-a", "artist-b"];
    initial.coordination.phaseEndsAt = 10;
    const next = transitionBattle(initial, 10);

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
    expect(opened.coordination.phaseEndsAt).toBeNull();
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
    state.coordination.artistReadyUserIds = ["artist-a", "artist-b"];
    state.coordination.phaseEndsAt = 20;

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

type TestBattleState = ReturnType<typeof host>;

const PHASE_SEQUENCE_TO_VOTING = [
    "round_intro",
    "artist_a_turn",
    "turn_transition",
    "artist_b_turn",
    "pre_vote",
    "voting",
  ] as const satisfies readonly BattlePhase[],
  fans = (count: number) =>
    Array.from({ length: count }, (_, index) => `fan-${index + 1}`),
  startOpen = (admittedCount: number): TestBattleState => {
    const state = host();
    return {
      ...state,
      coordination: {
        ...state.coordination,
        admittedUserIds: fans(admittedCount),
        artistReadyUserIds: ["artist-a", "artist-b"],
        phase: "waiting_room",
        phaseEndsAt: 10,
        phaseStartedAt: 0,
        queuedUserIds: [],
        removedUserIds: [],
        waitingUserIds: [],
      },
    };
  },
  advanceOne = (state: TestBattleState): TestBattleState => {
    const deadline = state.coordination.phaseEndsAt;
    if (deadline === null) {
      throw new Error(
        `Phase ${state.coordination.phase} has no transition deadline.`
      );
    }

    const next = transitionBattle(state, deadline),
      duration = phaseDuration(
        next.coordination.phase,
        next.coordination.durations
      );
    expect(next.coordination.phaseStartedAt).toBe(deadline);
    expect(next.coordination.phaseEndsAt).toBe(
      duration === null ? null : deadline + duration
    );
    return next;
  },
  advanceThrough = (
    initial: TestBattleState,
    expectedPhases: readonly BattlePhase[],
    seen?: BattlePhase[]
  ) => {
    let state = initial;
    for (const expectedPhase of expectedPhases) {
      state = advanceOne(state);
      expect(state.coordination.phase).toBe(expectedPhase);
      seen?.push(state.coordination.phase);
    }
    return state;
  },
  castVotes = (
    state: TestBattleState,
    roundNumber: number,
    votesA: number,
    votesB: number,
    votedUserIds = state.coordination.requiredVoterUserIds ?? []
  ): TestBattleState => ({
    ...state,
    battle: {
      ...state.battle,
      rounds: state.battle.rounds.map((round) =>
        round.number === roundNumber
          ? {
              ...round,
              voteTotals: { "artist-a": votesA, "artist-b": votesB },
            }
          : round
      ),
    },
    coordination: {
      ...state.coordination,
      votedUserIds,
    },
  });

describe("full battle timeline", () => {
  it("walks a best-of-3 from waiting room through a two-round clinch", () => {
    const seen: BattlePhase[] = [];
    let state = startOpen(30);

    state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING, seen);
    state = castVotes(state, 1, 20, 10);
    state = advanceThrough(state, ["round_result", "between_rounds"], seen);

    state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING, seen);
    state = castVotes(state, 2, 20, 10);
    state = advanceThrough(state, ["round_result", "battle_result"], seen);

    expect(seen).toEqual([
      "round_intro",
      "artist_a_turn",
      "turn_transition",
      "artist_b_turn",
      "pre_vote",
      "voting",
      "round_result",
      "between_rounds",
      "round_intro",
      "artist_a_turn",
      "turn_transition",
      "artist_b_turn",
      "pre_vote",
      "voting",
      "round_result",
      "battle_result",
    ]);
    expect(state.coordination.winnerUserId).toBe("artist-a");
    expect(
      state.battle.rounds.filter((round) => round.winnerArtistId === "artist-a")
    ).toHaveLength(2);

    const deadline = state.coordination.phaseEndsAt;
    if (deadline === null) {
      throw new Error("Battle result is missing its display deadline.");
    }
    const ended = advanceBattleToNow(state, deadline);
    expect(ended.coordination.phase).toBe("ended");
  });

  it("uses sudden death after three scheduled rounds end 1-1", () => {
    let state = startOpen(30);

    for (const [roundNumber, votesA, votesB] of [
      [1, 21, 9],
      [2, 9, 21],
      [3, 15, 15],
    ] as const) {
      state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING);
      state = castVotes(state, roundNumber, votesA, votesB);
      state = advanceOne(state);
      expect(state.coordination.phase).toBe("round_result");

      state = advanceOne(state);
      if (roundNumber < 3) {
        expect(state.coordination.phase).toBe("between_rounds");
      }
    }

    expect(state.coordination.phase).toBe("tiebreaker_a");
    expect(state.coordination.roundNumber).toBe(4);
    expect(
      state.battle.rounds.find((round) => round.number === 3)?.winnerArtistId
    ).toBeNull();

    state = advanceThrough(state, [
      "tiebreaker_transition",
      "tiebreaker_b",
      "tiebreaker_voting",
    ]);
    state = castVotes(state, 4, 25, 5);
    state = advanceThrough(state, ["round_result", "battle_result", "ended"]);

    expect(state.coordination.winnerUserId).toBe("artist-a");
  });

  it("removes exactly the required voters who abstain between rounds", () => {
    let state = startOpen(4);

    state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING);
    expect(state.coordination.requiredVoterUserIds).toEqual(fans(4));

    state = castVotes(state, 1, 2, 0, ["fan-1", "fan-2"]);
    state = advanceThrough(state, ["round_result", "between_rounds"]);

    expect(state.coordination.removedUserIds).toEqual(["fan-3", "fan-4"]);
    expect(state.coordination.admittedUserIds).toEqual(["fan-1", "fan-2"]);
  });

  it("records a tied regular round as complete without assigning a winner", () => {
    let state = startOpen(30);

    state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING);
    state = castVotes(state, 1, 15, 15);
    state = advanceOne(state);

    const round = state.battle.rounds.find((entry) => entry.number === 1);
    expect(round?.status).toBe("complete");
    expect(round?.winnerArtistId).toBeNull();

    state = advanceOne(state);
    expect(state.coordination.phase).toBe("between_rounds");
    expect(state.coordination.roundNumber).toBe(2);
  });

  it("ends after the scheduled rounds when one artist leads despite tied rounds", () => {
    let state = startOpen(30);

    for (const [roundNumber, votesA, votesB] of [
      [1, 20, 10],
      [2, 15, 15],
      [3, 15, 15],
    ] as const) {
      state = advanceThrough(state, PHASE_SEQUENCE_TO_VOTING);
      state = castVotes(state, roundNumber, votesA, votesB);
      state = advanceThrough(state, ["round_result"]);
      state = advanceOne(state);
    }

    expect(state.coordination.phase).toBe("battle_result");
    expect(state.coordination.winnerUserId).toBe("artist-a");
  });

  it("resolves tied tiebreaker voting consistently toward artist A", () => {
    let state = startOpen(2);
    state = {
      ...state,
      coordination: {
        ...state.coordination,
        phase: "tiebreaker_voting",
        phaseEndsAt: 10,
        phaseStartedAt: 0,
        requiredVoterUserIds: fans(2),
        roundNumber: 4,
        votedUserIds: fans(2),
      },
    };
    state = castVotes(state, 4, 10, 10);
    state = advanceOne(state);

    expect(
      state.battle.rounds.find((round) => round.number === 4)?.winnerArtistId
    ).toBe("artist-a");

    state = advanceOne(state);
    expect(state.coordination.phase).toBe("battle_result");
    expect(state.coordination.winnerUserId).toBe("artist-a");
  });
});
