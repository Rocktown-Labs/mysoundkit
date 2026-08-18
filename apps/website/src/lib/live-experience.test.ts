import { describe, expect, it } from "vitest";

import {
  canShowChallengeAction,
  canTransitionBattlePhase,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  resolveMandatoryVoteResults,
} from "./live-experience";
import type { LiveSessionLock } from "./live-experience";

describe("live battle orchestration", () => {
  it("allows only declared battle phase transitions", () => {
    expect(canTransitionBattlePhase("draft", "matching")).toBe(true);
    expect(canTransitionBattlePhase("round_live", "voting")).toBe(true);
    expect(canTransitionBattlePhase("voting", "between_rounds")).toBe(false);
    expect(canTransitionBattlePhase("complete", "round_setup")).toBe(false);
  });

  it("excludes next-round lobby participants from the active voter snapshot", () => {
    const snapshot = createRoundVoterSnapshot({
      activeParticipantIds: ["fan-1", "fan-2", "fan-2", "fan-3"],
      lobbyParticipantIds: ["fan-3", "fan-4"],
      roundId: "round-2",
    });

    expect(snapshot).toEqual([
      {
        roundId: "round-2",
        status: "eligible",
        userId: "fan-1",
        voteRequired: true,
        votedAt: null,
      },
      {
        roundId: "round-2",
        status: "eligible",
        userId: "fan-2",
        voteRequired: true,
        votedAt: null,
      },
    ]);
  });

  it("marks missing mandatory voters for removal before the next round", () => {
    const snapshot = createRoundVoterSnapshot({
        activeParticipantIds: ["fan-1", "fan-2"],
        lobbyParticipantIds: [],
        roundId: "round-1",
      }),
      resolved = resolveMandatoryVoteResults({
        now: "2026-07-22T15:03:00.000Z",
        snapshot,
        votedUserIds: ["fan-2"],
      });

    expect(resolved).toEqual([
      {
        roundId: "round-1",
        status: "missed",
        userId: "fan-1",
        voteRequired: true,
        votedAt: null,
      },
      {
        roundId: "round-1",
        status: "voted",
        userId: "fan-2",
        voteRequired: true,
        votedAt: "2026-07-22T15:03:00.000Z",
      },
    ]);
  });
});

describe("live session locks", () => {
  const baseLock: LiveSessionLock = {
    endsAt: "2026-07-22T16:00:00.000Z",
    expiresAt: "2026-07-22T16:05:00.000Z",
    role: "participant",
    sessionId: "battle-1",
    sessionType: "battle",
    startsAt: "2026-07-22T15:00:00.000Z",
    status: "active",
    userId: "artist-1",
  };

  it("blocks artists from overlapping creator roles", () => {
    const conflict = findLiveSessionConflict({
      existingLocks: [baseLock],
      now: new Date("2026-07-22T15:30:00.000Z"),
      requestedLock: {
        ...baseLock,
        role: "host",
        sessionId: "stream-1",
        sessionType: "stream",
        startsAt: "2026-07-22T15:45:00.000Z",
      },
    });

    expect(conflict?.sessionId).toBe("battle-1");
  });

  it("ignores expired locks and non-overlapping windows", () => {
    const expiredLock: LiveSessionLock = {
        ...baseLock,
        expiresAt: "2026-07-22T14:55:00.000Z",
      },
      conflict = findLiveSessionConflict({
        existingLocks: [expiredLock],
        now: new Date("2026-07-22T15:30:00.000Z"),
        requestedLock: {
          ...baseLock,
          sessionId: "party-1",
          sessionType: "party",
          startsAt: "2026-07-22T17:00:00.000Z",
        },
      });

    expect(conflict).toBeNull();
  });
});

describe("artist profile live permissions", () => {
  it("shows Challenge only to artist viewers on someone else's artist page", () => {
    expect(
      canShowChallengeAction({
        isOwner: false,
        targetIsArtist: true,
        viewerAccountType: "artist",
      })
    ).toBe(true);
    expect(
      canShowChallengeAction({
        isOwner: false,
        targetIsArtist: true,
        viewerAccountType: "fan",
      })
    ).toBe(false);
    expect(
      canShowChallengeAction({
        isOwner: true,
        targetIsArtist: true,
        viewerAccountType: "artist",
      })
    ).toBe(false);
  });
});
