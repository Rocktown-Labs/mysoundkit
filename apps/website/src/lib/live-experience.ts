export type LiveExperienceKind = "battle" | "party" | "stream";

export type LiveScheduleMode = "asap" | "scheduled";

export type BattlePhase =
  | "draft"
  | "matching"
  | "scheduled"
  | "lobby"
  | "round_setup"
  | "round_live"
  | "voting"
  | "round_results"
  | "between_rounds"
  | "complete"
  | "canceled";

export type RoundVoterStatus = "eligible" | "voted" | "missed" | "removed";

export interface RoundVoterSnapshot {
  roundId: string;
  status: RoundVoterStatus;
  userId: string;
  voteRequired: boolean;
  votedAt: null | string;
}

export interface LiveSessionLock {
  endsAt: null | string;
  expiresAt: string;
  role: "host" | "participant" | "viewer";
  sessionId: string;
  sessionType: LiveExperienceKind;
  startsAt: string;
  status: "reserved" | "active" | "ended" | "expired";
  userId: string;
}

export interface LiveExperienceConfig {
  accent: string;
  checklist: string[];
  description: string;
  kind: LiveExperienceKind;
  roomLabel: string;
  title: string;
}

export const realtimeKitAlwaysOn = {
  backstageVoice: true,
  captions: true,
  chat: true,
  recording: true,
} as const;

export const liveExperienceConfigs: Record<
  LiveExperienceKind,
  LiveExperienceConfig
> = {
  battle: {
    accent: "BattleBot controls rounds, stage audio, votes, and lobby moves.",
    checklist: [
      "Choose a battle-ready kit",
      "Find or challenge an artist",
      "Confirm tracks before each round",
      "Open voting only to eligible round viewers",
    ],
    description:
      "Artists enter with a kit, match or schedule, then BattleBot runs rounds, stage audio, votes, and audience movement.",
    kind: "battle",
    roomLabel: "Battle room",
    title: "Live Battle",
  },
  party: {
    accent: "Playlist playback, lyrics, host badges, and chat stay synced.",
    checklist: [
      "Attach an album, EP, mixtape, or playlist",
      "Choose ASAP or scheduled premiere",
      "Keep chat open for every listener",
      "Optionally join with artist video",
    ],
    description:
      "A release or playlist room where listeners hear tracks in order, chat together, and follow lyrics or timestamped moments.",
    kind: "party",
    roomLabel: "Listening room",
    title: "Listening Party",
  },
  stream: {
    accent: "Single creator video, realtime chat, and health analytics.",
    checklist: [
      "Enter stream details",
      "Pick browser camera or OBS",
      "Check camera and microphone access",
      "Review stream health and audience metrics",
    ],
    description:
      "A creator video room with chat, encoder/browser setup, realtime audience tools, and analytics-heavy control details.",
    kind: "stream",
    roomLabel: "Stream room",
    title: "Live Stream",
  },
};

export const battlePhaseTransitions: Record<BattlePhase, BattlePhase[]> = {
  between_rounds: ["round_setup", "complete", "canceled"],
  canceled: [],
  complete: [],
  draft: ["matching", "scheduled", "canceled"],
  lobby: ["round_setup", "canceled"],
  matching: ["scheduled", "lobby", "canceled"],
  round_live: ["voting", "canceled"],
  round_results: ["between_rounds", "complete", "canceled"],
  round_setup: ["round_live", "canceled"],
  scheduled: ["lobby", "canceled"],
  voting: ["round_results", "canceled"],
};

export const canTransitionBattlePhase = (
  currentPhase: BattlePhase,
  nextPhase: BattlePhase
) => battlePhaseTransitions[currentPhase].includes(nextPhase);

export const createRoundVoterSnapshot = ({
  activeParticipantIds,
  lobbyParticipantIds,
  roundId,
}: {
  activeParticipantIds: string[];
  lobbyParticipantIds: string[];
  roundId: string;
}) => {
  const lobbyIds = new Set(lobbyParticipantIds);
  const uniqueActiveIds = new Set(activeParticipantIds);

  return [...uniqueActiveIds]
    .filter((userId) => !lobbyIds.has(userId))
    .map((userId): RoundVoterSnapshot => ({
      roundId,
      status: "eligible",
      userId,
      voteRequired: true,
      votedAt: null,
    }));
};

export const resolveMandatoryVoteResults = ({
  now,
  snapshot,
  votedUserIds,
}: {
  now: string;
  snapshot: RoundVoterSnapshot[];
  votedUserIds: string[];
}) => {
  const voteSet = new Set(votedUserIds);

  return snapshot.map((voter): RoundVoterSnapshot => {
    if (voteSet.has(voter.userId)) {
      return {
        ...voter,
        status: "voted",
        votedAt: voter.votedAt ?? now,
      };
    }

    return {
      ...voter,
      status: "missed",
    };
  });
};

const isCreatorRole = (role: LiveSessionLock["role"]) =>
  role === "host" || role === "participant";

const isActiveLock = (lock: LiveSessionLock, now: Date) => {
  if (lock.status === "ended" || lock.status === "expired") {
    return false;
  }

  return new Date(lock.expiresAt) > now;
};

const windowsOverlap = (
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) => firstStart < secondEnd && secondStart < firstEnd;

export const findLiveSessionConflict = ({
  existingLocks,
  now = new Date(),
  requestedLock,
}: {
  existingLocks: LiveSessionLock[];
  now?: Date;
  requestedLock: LiveSessionLock;
}) => {
  const requestedStart = new Date(requestedLock.startsAt);
  const requestedEnd = requestedLock.endsAt
    ? new Date(requestedLock.endsAt)
    : new Date(requestedLock.expiresAt);

  return (
    existingLocks.find((lock) => {
      const isSameUser = lock.userId === requestedLock.userId;
      const isSameSession = lock.sessionId === requestedLock.sessionId;

      if (!isSameUser || isSameSession) {
        return false;
      }

      if (!(isCreatorRole(lock.role) || isCreatorRole(requestedLock.role))) {
        return false;
      }

      if (!isActiveLock(lock, now)) {
        return false;
      }

      const lockStart = new Date(lock.startsAt);
      const lockEnd = lock.endsAt
        ? new Date(lock.endsAt)
        : new Date(lock.expiresAt);

      return windowsOverlap(lockStart, lockEnd, requestedStart, requestedEnd);
    }) ?? null
  );
};

export const canShowChallengeAction = ({
  isOwner,
  targetIsArtist,
  viewerAccountType,
}: {
  isOwner: boolean;
  targetIsArtist: boolean;
  viewerAccountType?: "artist" | "fan" | null;
}) => !isOwner && targetIsArtist && viewerAccountType === "artist";
