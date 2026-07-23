import type { AuthenticatedUser } from "@/lib/types";

export type LiveExperienceKind = "battle" | "party" | "stream";
export type LiveScheduleMode = "asap" | "scheduled";
export type LiveSource = "browser" | "obs" | "playlist";
export type LiveParticipantRole = "artist" | "host" | "listener" | "viewer";
export type BattlePhase =
  | "matching"
  | "lobby"
  | "round_active"
  | "voting"
  | "between_rounds"
  | "completed";
export type RealtimeProviderStatus = "configured" | "mocked";

export interface LiveSessionLockInput {
  endsAt?: string | null;
  experienceId: string;
  kind: LiveExperienceKind;
  startsAt: string;
  status: "scheduled" | "live";
}

export interface LiveSessionConflict {
  conflictingExperienceId: string;
  kind: LiveExperienceKind;
  message: string;
  startsAt: string;
}

export interface RoundVoterInput {
  id: string;
  inLobby?: boolean;
  voted?: boolean;
}

export interface RoundVoterSnapshot {
  bootedUserIds: string[];
  eligibleUserIds: string[];
  missingVoteUserIds: string[];
}

export interface NotificationFanout {
  audience: "artists" | "followers" | "watchers";
  ctaHref: string;
  message: string;
  title: string;
}

export interface RealtimeMeeting {
  id: string;
  provider: "cloudflare_realtimekit";
  status: RealtimeProviderStatus;
  title: string;
}

export interface RealtimeParticipantToken {
  authToken: string;
  breakoutRoomId?: string;
  meetingId: string;
  participantId: string;
  presetName: string;
}

export interface CloudflareRealtimeKitConfig {
  accountId?: string;
  apiToken?: string;
  appId?: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ROUND_LOBBY_PRESET = "soundkit-battle-lobby-text";

export const hasRealtimeKitConfig = ({
  accountId,
  apiToken,
  appId,
}: CloudflareRealtimeKitConfig) =>
  Boolean(accountId?.trim() && apiToken?.trim() && appId?.trim());

export const resolveRealtimePreset = ({
  kind,
  phase,
  role,
}: {
  kind: LiveExperienceKind;
  phase?: BattlePhase;
  role: LiveParticipantRole;
}) => {
  if (kind === "battle") {
    if (phase === "lobby") {
      return ROUND_LOBBY_PRESET;
    }

    if (role === "artist") {
      return phase === "round_active"
        ? "soundkit-battle-artist-live"
        : "soundkit-battle-artist-muted";
    }

    return "soundkit-battle-voter";
  }

  if (kind === "party") {
    return role === "host" ? "soundkit-party-host" : "soundkit-party-listener";
  }

  return role === "host" || role === "artist"
    ? "soundkit-stream-host"
    : "soundkit-stream-viewer";
};

export const findLiveSessionConflict = ({
  candidateEndsAt,
  candidateStartsAt,
  locks,
}: {
  candidateEndsAt?: string | null;
  candidateStartsAt: string;
  locks: LiveSessionLockInput[];
}): LiveSessionConflict | null => {
  const candidateStart = new Date(candidateStartsAt).getTime();
  const candidateEnd = candidateEndsAt
    ? new Date(candidateEndsAt).getTime()
    : candidateStart + ONE_HOUR_MS;

  for (const lock of locks) {
    const lockStart = new Date(lock.startsAt).getTime();
    const lockEnd = lock.endsAt
      ? new Date(lock.endsAt).getTime()
      : lockStart + ONE_HOUR_MS;
    const overlaps = candidateStart < lockEnd && lockStart < candidateEnd;

    if (overlaps && lock.status !== "scheduled") {
      return {
        conflictingExperienceId: lock.experienceId,
        kind: lock.kind,
        message:
          "Artists can only host one live battle, party, or stream at a time.",
        startsAt: lock.startsAt,
      };
    }
  }

  return null;
};

export const createRoundVoterSnapshot = (
  participants: RoundVoterInput[]
): RoundVoterSnapshot => {
  const eligibleUserIds = participants
    .filter((participant) => !participant.inLobby)
    .map((participant) => participant.id);
  const missingVoteUserIds = participants
    .filter((participant) => !(participant.inLobby || participant.voted))
    .map((participant) => participant.id);

  return {
    bootedUserIds: missingVoteUserIds,
    eligibleUserIds,
    missingVoteUserIds,
  };
};

export const buildNotificationFanout = ({
  experienceId,
  kind,
  title,
}: {
  experienceId: string;
  kind: LiveExperienceKind;
  title: string;
}): NotificationFanout[] => {
  let noun = "stream";

  if (kind === "battle") {
    noun = "battle";
  }

  if (kind === "party") {
    noun = "listening party";
  }

  const href = `/live/${kind === "party" ? "parties" : `${kind}s`}/${experienceId}`;

  return [
    {
      audience: "artists",
      ctaHref: href,
      message: `${title} is ready. Join the room when it is time to go live.`,
      title: `Your ${noun} is ready`,
    },
    {
      audience: "followers",
      ctaHref: href,
      message: `${title} is scheduled. We will bring everyone to the room when it starts.`,
      title: `New ${noun} scheduled`,
    },
    {
      audience: "watchers",
      ctaHref: href,
      message: `${title} is live. Tap in to watch, chat, and react.`,
      title: `${title} is live`,
    },
  ];
};

export const createMockRealtimeMeeting = ({
  kind,
  title,
}: {
  kind: LiveExperienceKind;
  title: string;
}): RealtimeMeeting => ({
  id: `rtk_${kind}_${crypto.randomUUID()}`,
  provider: "cloudflare_realtimekit",
  status: "mocked",
  title,
});

export const createMockParticipantToken = ({
  kind,
  meetingId,
  phase,
  role,
  user,
}: {
  kind: LiveExperienceKind;
  meetingId: string;
  phase?: BattlePhase;
  role: LiveParticipantRole;
  user: AuthenticatedUser;
}): RealtimeParticipantToken => {
  const presetName = resolveRealtimePreset({
    kind,
    phase,
    role,
  });
  const participantId = `participant_${user.id}`;

  return {
    authToken: `mock_rtk_${meetingId}_${participantId}_${presetName}`,
    breakoutRoomId: phase === "lobby" ? `${meetingId}_lobby` : undefined,
    meetingId,
    participantId,
    presetName,
  };
};

export const buildRealtimeKitMeetingUrl = ({
  accountId,
  appId,
}: {
  accountId: string;
  appId: string;
}) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings`;

export const buildRealtimeKitParticipantUrl = ({
  accountId,
  appId,
  meetingId,
}: {
  accountId: string;
  appId: string;
  meetingId: string;
}) =>
  `${buildRealtimeKitMeetingUrl({ accountId, appId })}/${meetingId}/participants`;

export const buildRealtimeKitEndMeetingUrl = ({
  accountId,
  appId,
  meetingId,
}: {
  accountId: string;
  appId: string;
  meetingId: string;
}) => `${buildRealtimeKitMeetingUrl({ accountId, appId })}/${meetingId}/end`;

export const buildRealtimeKitRecordingUrl = ({
  accountId,
  appId,
  meetingId,
}: {
  accountId: string;
  appId: string;
  meetingId: string;
}) =>
  `${buildRealtimeKitMeetingUrl({ accountId, appId })}/${meetingId}/recordings`;

export const buildRealtimeKitChatDumpUrl = ({
  accountId,
  appId,
  meetingId,
}: {
  accountId: string;
  appId: string;
  meetingId: string;
}) =>
  `${buildRealtimeKitMeetingUrl({ accountId, appId })}/${meetingId}/chat-dump`;

export const buildRealtimeKitPollUrl = ({
  accountId,
  appId,
  meetingId,
}: {
  accountId: string;
  appId: string;
  meetingId: string;
}) => `${buildRealtimeKitMeetingUrl({ accountId, appId })}/${meetingId}/polls`;

export const buildRealtimeMeetingPayload = ({ title }: { title: string }) => ({
  chat_config: {
    allow_files: false,
    text_only: true,
  },
  recording_config: {
    auto_start: true,
    storage: {
      provider: "cloudflare_r2",
    },
    watermark: {
      opacity: 0.85,
      position: "top_right",
      url: "https://mysoundkit.com/logo.png",
    },
  },
  simulcast: true,
  title,
  video_config: {
    codec: "h264",
    max_bitrate: 2500,
  },
});
