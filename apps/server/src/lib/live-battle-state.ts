/* eslint-disable one-var, sort-vars, prefer-destructuring, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import type {
  LiveBattleArtistControls,
  LiveBattleRound,
  LiveRoomArtist,
} from "@/lib/live-room-data";

export const BATTLE_CANCELLATION_REASONS = [
  "ducked",
  "artist_unavailable",
  "technical_issue",
  "schedule_conflict",
  "moderation",
  "other",
  "platform_issue",
] as const;

export type BattleCancellationReason =
  (typeof BATTLE_CANCELLATION_REASONS)[number];
export type BattleOutcomeKind = "canceled" | "ducked" | "forfeited";

export interface BattleOutcome {
  affectedUserId?: string | null;
  kind: BattleOutcomeKind;
  reason: BattleCancellationReason;
  recordedAt: number;
}

export type BattlePhase =
  | "scheduled"
  | "waiting_room"
  | "round_intro"
  | "artist_a_turn"
  | "turn_transition"
  | "artist_b_turn"
  | "pre_vote"
  | "voting"
  | "round_result"
  | "between_rounds"
  | "tiebreaker_a"
  | "tiebreaker_transition"
  | "tiebreaker_b"
  | "tiebreaker_voting"
  | "battle_result"
  | "ended";

export interface BattleDurations {
  betweenRoundsMs: number;
  roundIntroMs: number;
  roundResultMs: number;
  transitionMs: number;
  turnMs: number;
  voteMs: number;
  waitingRoomMs: number;
}

export const BATTLE_ADMISSION_BATCH_SIZE = 1000;

export const PRODUCTION_BATTLE_DURATIONS: BattleDurations = {
  betweenRoundsMs: 15_000,
  roundIntroMs: 5000,
  roundResultMs: 5000,
  transitionMs: 10_000,
  turnMs: 3 * 60_000,
  voteMs: 2 * 60_000,
  waitingRoomMs: 30_000,
};

export interface BattleCoordination {
  activeArtistUserId: string | null;
  admissionBatchSize?: number;
  artistReadyUserIds?: string[];
  admittedUserIds?: string[];
  battleId: string;
  durations: BattleDurations;
  format: "best_of_3" | "best_of_5" | "best_of_7";
  lastTransitionVersion: number;
  phase: BattlePhase;
  phaseEndsAt: number | null;
  phaseStartedAt: number;
  outcome?: BattleOutcome;
  queuedUserIds?: string[];
  removedUserIds?: string[];
  requiredVoterUserIds?: string[];
  roundNumber: number;
  votedUserIds?: string[];
  waitingUserIds?: string[];
  winnerUserId: string | null;
}

export interface BattleStateHost {
  battle: {
    artistControls?: LiveBattleArtistControls;
    artistControlsByUserId?: Record<string, LiveBattleArtistControls>;
    artists: [LiveRoomArtist, LiveRoomArtist];
    currentRoundId: string;
    rounds: LiveBattleRound[];
    tiePolicy: string;
  };
  coordination: BattleCoordination;
}

export const requiredWinsForFormat = (format: BattleCoordination["format"]) =>
  Number(format.slice(-1)) / 2 + 0.5;

export const regularRoundCountForFormat = (
  format: BattleCoordination["format"]
) => Number(format.slice(-1));

export const isTiebreakerPhase = (phase: BattlePhase) =>
  phase.startsWith("tiebreaker_");

export const isVotingPhase = (phase: BattlePhase) =>
  phase === "voting" || phase === "tiebreaker_voting";

export const phaseDuration = (
  phase: BattlePhase,
  durations: BattleDurations
) => {
  if (
    phase === "artist_a_turn" ||
    phase === "artist_b_turn" ||
    phase === "tiebreaker_a" ||
    phase === "tiebreaker_b"
  ) {
    return durations.turnMs;
  }

  if (phase === "voting" || phase === "tiebreaker_voting") {
    return durations.voteMs;
  }

  if (phase === "round_intro") {
    return durations.roundIntroMs;
  }

  if (phase === "pre_vote") {
    return 1;
  }

  if (phase === "turn_transition" || phase === "tiebreaker_transition") {
    return durations.transitionMs;
  }

  if (phase === "round_result" || phase === "battle_result") {
    return durations.roundResultMs;
  }

  if (phase === "between_rounds") {
    return durations.betweenRoundsMs;
  }

  if (phase === "waiting_room") {
    return durations.waitingRoomMs;
  }

  return null;
};

const winnerForRound = (round: LiveBattleRound) => {
    const artistIds = Object.keys(round.voteTotals);
    if (artistIds.length < 2) {
      return null;
    }

    const artistA = artistIds[0],
      artistB = artistIds[1];
    if (!(artistA && artistB)) {
      return null;
    }

    const votesA = round.voteTotals[artistA] ?? 0,
      votesB = round.voteTotals[artistB] ?? 0;

    if (votesA === votesB) {
      return round.isTiebreaker ? artistA : null;
    }

    return votesA > votesB ? artistA : artistB;
  },
  roundsWon = (rounds: LiveBattleRound[], artistId: string) =>
    rounds.filter((round) => round.winnerArtistId === artistId).length,
  nextRegularRound = (rounds: LiveBattleRound[], roundNumber: number) =>
    rounds.find(
      (round) => !round.isTiebreaker && round.number === roundNumber + 1
    );

export const createBattleCoordination = ({
  battleId,
  format,
  now = Date.now(),
  scheduledStartAt,
  durations = PRODUCTION_BATTLE_DURATIONS,
  admissionBatchSize,
}: {
  battleId: string;
  format: BattleCoordination["format"];
  now?: number;
  scheduledStartAt?: number | null;
  durations?: BattleDurations;
  admissionBatchSize?: number;
}): BattleCoordination => ({
  activeArtistUserId: null,
  admissionBatchSize,
  admittedUserIds: [],
  artistReadyUserIds: [],
  battleId,
  durations,
  format,
  lastTransitionVersion: 0,
  phase:
    scheduledStartAt && scheduledStartAt > now ? "scheduled" : "waiting_room",
  phaseEndsAt:
    scheduledStartAt && scheduledStartAt > now ? scheduledStartAt : null,
  phaseStartedAt: now,
  queuedUserIds: [],
  removedUserIds: [],
  requiredVoterUserIds: [],
  roundNumber: 1,
  votedUserIds: [],
  waitingUserIds: [],
  winnerUserId: null,
});

const updateRoundStatus = (
  rounds: LiveBattleRound[],
  phase: BattlePhase,
  roundNumber: number
) =>
  rounds.map((round) => {
    if (
      round.number < roundNumber ||
      (round.isTiebreaker && !isTiebreakerPhase(phase))
    ) {
      return round.winnerArtistId
        ? { ...round, status: "complete" as const }
        : round;
    }

    if (round.number !== roundNumber) {
      return round;
    }

    if (isVotingPhase(phase)) {
      return { ...round, status: "voting" as const };
    }

    if (phase === "round_result" || phase === "battle_result") {
      return { ...round, status: "complete" as const };
    }

    return { ...round, status: "live" as const };
  });

export const transitionBattle = (
  host: BattleStateHost,
  now: number
): BattleStateHost => {
  const { battle, coordination } = host;
  if (!coordination.phaseEndsAt || now < coordination.phaseEndsAt) {
    return host;
  }

  const [artistA, artistB] = battle.artists,
    bothArtistsReady =
      (coordination.artistReadyUserIds ?? []).every(
        (userId) => userId === artistA.id || userId === artistB.id
      ) &&
      [artistA.id, artistB.id].every((userId) =>
        (coordination.artistReadyUserIds ?? []).includes(userId)
      );
  if (coordination.phase === "waiting_room" && !bothArtistsReady) {
    return host;
  }

  const currentRound = battle.rounds.find(
      (round) => round.number === coordination.roundNumber
    ),
    { phase } = coordination;
  let nextPhase: BattlePhase = phase,
    nextRoundNumber = coordination.roundNumber,
    activeArtistUserId: string | null = null,
    { winnerUserId } = coordination,
    nextRounds = battle.rounds;

  if (phase === "scheduled") {
    nextPhase = "waiting_room";
  } else if (phase === "waiting_room") {
    if (!bothArtistsReady) {
      return host;
    }
    nextPhase = "round_intro";
  } else if (phase === "round_intro") {
    nextPhase = "artist_a_turn";
    activeArtistUserId = artistA.id;
  } else if (phase === "artist_a_turn") {
    nextPhase = "turn_transition";
  } else if (phase === "turn_transition") {
    nextPhase = "artist_b_turn";
    activeArtistUserId = artistB.id;
  } else if (phase === "artist_b_turn") {
    nextPhase = "pre_vote";
  } else if (phase === "pre_vote") {
    nextPhase = "voting";
  } else if (phase === "voting" || phase === "tiebreaker_voting") {
    const roundWinner = currentRound ? winnerForRound(currentRound) : null;
    nextPhase = "round_result";
    if (currentRound && roundWinner) {
      nextRounds = battle.rounds.map((round) =>
        round.id === currentRound.id
          ? { ...round, winnerArtistId: roundWinner }
          : round
      );
    }
  } else if (phase === "round_result") {
    const updatedRound = battle.rounds.find(
        (round) => round.number === coordination.roundNumber
      ),
      winnerA = roundsWon(battle.rounds, artistA.id),
      winnerB = roundsWon(battle.rounds, artistB.id),
      requiredWins = requiredWinsForFormat(coordination.format),
      regularRounds = regularRoundCountForFormat(coordination.format),
      hasClinched = winnerA >= requiredWins || winnerB >= requiredWins,
      regularRoundsComplete =
        battle.rounds.filter(
          (round) => !round.isTiebreaker && round.status === "complete"
        ).length >= regularRounds;

    if (hasClinched || (updatedRound?.isTiebreaker ?? false)) {
      winnerUserId = winnerA > winnerB ? artistA.id : artistB.id;
      nextPhase = "battle_result";
    } else if (regularRoundsComplete) {
      if (winnerA === winnerB) {
        const tiebreaker = battle.rounds.find((round) => round.isTiebreaker);
        if (tiebreaker) {
          nextRoundNumber = tiebreaker.number;
          nextPhase = "tiebreaker_a";
          activeArtistUserId = artistA.id;
        } else {
          winnerUserId = null;
          nextPhase = "battle_result";
        }
      } else {
        winnerUserId = winnerA > winnerB ? artistA.id : artistB.id;
        nextPhase = "battle_result";
      }
    } else {
      nextRoundNumber += 1;
      nextPhase = "between_rounds";
    }
  } else if (phase === "between_rounds") {
    nextPhase = "round_intro";
  } else if (phase === "tiebreaker_a") {
    nextPhase = "tiebreaker_transition";
  } else if (phase === "tiebreaker_transition") {
    nextPhase = "tiebreaker_b";
    activeArtistUserId = artistB.id;
  } else if (phase === "tiebreaker_b") {
    nextPhase = "tiebreaker_voting";
  } else if (phase === "battle_result") {
    nextPhase = "ended";
  }

  const admittedUsers = coordination.admittedUserIds ?? [],
    admissionCandidates = [
      ...(coordination.waitingUserIds ?? []),
      ...(coordination.queuedUserIds ?? []),
    ].filter((userId) => !admittedUsers.includes(userId)),
    shouldAdmitBatch =
      nextPhase === "waiting_room" ||
      (nextPhase === "round_intro" && phase === "between_rounds"),
    admissionBatchSize =
      coordination.admissionBatchSize ?? BATTLE_ADMISSION_BATCH_SIZE,
    admittedBatch = shouldAdmitBatch
      ? admissionCandidates.slice(0, admissionBatchSize)
      : [],
    requiredVoters = coordination.requiredVoterUserIds ?? [],
    votedUsers = coordination.votedUserIds ?? [],
    waitingUsers = shouldAdmitBatch
      ? admissionCandidates.slice(admissionBatchSize)
      : (coordination.waitingUserIds ?? []),
    removedUserIds =
      nextPhase === "between_rounds"
        ? requiredVoters.filter((userId) => !votedUsers.includes(userId))
        : (coordination.removedUserIds ?? []),
    admittedUserIds =
      nextPhase === "between_rounds"
        ? admittedUsers.filter((userId) => !removedUserIds.includes(userId))
        : shouldAdmitBatch
          ? [...admittedUsers, ...admittedBatch]
          : admittedUsers,
    nextDuration =
      nextPhase === "waiting_room"
        ? null
        : phaseDuration(nextPhase, coordination.durations),
    nextStartedAt = coordination.phaseEndsAt,
    nextCoordination: BattleCoordination = {
      ...coordination,
      activeArtistUserId,
      admittedUserIds,
      lastTransitionVersion: coordination.lastTransitionVersion + 1,
      phase: nextPhase,
      phaseEndsAt: nextDuration ? nextStartedAt + nextDuration : null,
      phaseStartedAt: nextStartedAt,
      queuedUserIds: shouldAdmitBatch ? [] : coordination.queuedUserIds,
      removedUserIds,
      requiredVoterUserIds:
        nextPhase === "voting" || nextPhase === "tiebreaker_voting"
          ? admittedUserIds.filter(
              (userId) => ![artistA.id, artistB.id].includes(userId)
            )
          : isVotingPhase(phase) || phase === "round_result"
            ? requiredVoters
            : [],
      roundNumber: nextRoundNumber,
      votedUserIds:
        isVotingPhase(phase) || phase === "round_result" ? votedUsers : [],
      waitingUserIds: waitingUsers,
      winnerUserId,
    };

  return {
    battle: {
      ...battle,
      rounds: updateRoundStatus(nextRounds, nextPhase, nextRoundNumber),
    },
    coordination: nextCoordination,
  };
};

export const advanceBattleToNow = (
  host: BattleStateHost,
  now: number,
  maxTransitions = 32
) => {
  let current = host;
  for (let index = 0; index < maxTransitions; index += 1) {
    const next = transitionBattle(current, now);
    if (next === current) {
      return current;
    }
    current = next;
  }
  return current;
};

export const publicBattlePhaseLabel = (phase: BattlePhase) =>
  phase
    .replaceAll("_", " ")
    .replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());

export const nextTrackForArtist = ({
  artistId,
  currentTrackId,
  trackIds,
}: {
  artistId: string;
  currentTrackId?: string | null;
  trackIds: Record<string, string[]>;
}) => {
  const tracks = trackIds[artistId] ?? [];
  return tracks.find((trackId) => trackId !== currentTrackId) ?? null;
};

export const nextRegularRoundForNumber = nextRegularRound;
