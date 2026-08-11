import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battleRounds,
  battles,
  liveExperiences,
  trackAssets,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { z } from "zod";

import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  allowsMockRealtime,
  buildNotificationFanout,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  buildRealtimeMeetingPayload,
  createMockParticipantToken,
  createMockRealtimeMeeting,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  hasRealtimeKitConfig,
  resolveRealtimePreset,
} from "@/lib/live-experience";
import type {
  BattlePhase,
  LiveExperienceKind,
  LiveParticipantRole,
  RealtimeMeeting,
  RealtimeParticipantToken,
} from "@/lib/live-experience";
import {
  applyBattleBotAction,
  buildLiveExperienceInsert,
  loadLiveExperienceById,
} from "@/lib/live-experience-events";
import type {
  LiveBattleRound,
  LiveRoomArtist,
  LiveRoomState,
  LiveRoomTrack,
} from "@/lib/live-room-data";
import {
  battleBotActionBodySchema,
  createLiveExperienceBodySchema,
  joinLiveExperienceBodySchema,
  liveSessionLockCheckBodySchema,
} from "@/lib/schemas";
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

const app = new Hono<AppEnv>();

type CreateLiveExperienceBody = z.infer<typeof createLiveExperienceBodySchema>;

interface CloudflareMeetingResponse {
  data?: {
    id?: string;
    title?: string;
  };
  errors?: unknown[];
  id?: string;
  messages?: unknown[];
  result?: {
    id?: string;
    title?: string;
  };
  success?: boolean;
  title?: string;
}

interface CloudflareParticipantResponse {
  data?: {
    id?: string;
    token?: string;
  };
  errors?: unknown[];
  id?: string;
  messages?: unknown[];
  result?: {
    id?: string;
    token?: string;
  };
  success?: boolean;
  token?: string;
}

interface CloudflareStreamResponse {
  result?: {
    playback?: {
      hls?: string;
    };
    rtmps?: {
      streamKey?: string;
      url?: string;
    };
    srt?: {
      streamKey?: string;
      url?: string;
    };
    status?: string;
    uid?: string;
  };
  success?: boolean;
}

const badRequest = (message: string) => ({
  message,
});

const streamInputFromCloudflareResponse = (
  data: CloudflareStreamResponse,
  title?: string
) => {
  const { result } = data;

  if (!(result?.uid && result.rtmps?.streamKey && result.rtmps.url)) {
    return null;
  }

  return {
    id: result.uid,
    playbackUrl: result.playback?.hls ?? "",
    rtmpsKey: result.rtmps.streamKey,
    rtmpsUrl: result.rtmps.url,
    srtKey: result.srt?.streamKey ?? "",
    srtUrl: result.srt?.url ?? "",
    status: result.status ?? "idle",
    ...(title ? { title } : {}),
  };
};

const createMockStreamInput = (title: string) => ({
  id: `mock_live_input_${crypto.randomUUID()}`,
  playbackUrl: "",
  rtmpsKey: `mock_${crypto.randomUUID()}`,
  rtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
  srtKey: `mock_${crypto.randomUUID()}`,
  srtUrl: "srt://live.cloudflare.com:443/live",
  status: "idle",
  title,
});

const cloudflareStreamSetupRequired = {
  message:
    "Cloudflare Stream live inputs are not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.",
};

const readResponseSnippet = async (response: Response) => {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500);
};

const logCloudflareApiFailure = ({
  body,
  label,
  response,
}: {
  body?: string;
  label: string;
  response: Response;
}) => {
  console.error(label, {
    body,
    status: response.status,
    statusText: response.statusText,
  });
};

const createCloudflareStreamInput = async ({
  env,
  title,
}: {
  env: AppEnv["Bindings"];
  title: string;
}) => {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken =
    env.CLOUDFLARE_STREAM_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;

  if (!(accountId && apiToken)) {
    return null;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      body: JSON.stringify({
        meta: { name: title },
        recording: { mode: "automatic" },
      }),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  );

  if (!response.ok) {
    logCloudflareApiFailure({
      body: await readResponseSnippet(response),
      label: "Cloudflare Stream live input creation failed",
      response,
    });
    return null;
  }

  const data = (await response.json()) as CloudflareStreamResponse;
  return streamInputFromCloudflareResponse(data, title);
};

const liveKindFromExperienceId = (experienceId: string): LiveExperienceKind => {
  if (experienceId.includes("_party_")) {
    return "party";
  }

  if (experienceId.includes("_stream_")) {
    return "stream";
  }

  return "battle";
};

const defaultSourceForKind = (kind: LiveExperienceKind) => {
  if (kind === "party") {
    return "playlist";
  }

  return "browser";
};

const nextBattlePhaseForAction = ({
  action,
  phase,
}: {
  action: string;
  phase?: BattlePhase;
}) => {
  if (action === "move_lobby_to_round") {
    return "round_active";
  }

  return phase ?? "between_rounds";
};

const realtimeKitConfig = (env: AppEnv["Bindings"]) => ({
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  allowMockRealtime: env.SOUNDKIT_ALLOW_MOCK_REALTIME,
  apiToken: env.CLOUDFLARE_API_TOKEN,
  appId: env.CLOUDFLARE_REALTIMEKIT_APP_ID,
});

const realtimeSetupRequired = {
  message:
    "Cloudflare RealtimeKit is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_REALTIMEKIT_APP_ID.",
};

const createRealtimeMeeting = async ({
  env,
  kind,
  title,
}: {
  env: AppEnv["Bindings"];
  kind: LiveExperienceKind;
  title: string;
}): Promise<RealtimeMeeting> => {
  const config = realtimeKitConfig(env);

  if (
    hasRealtimeKitConfig(config) &&
    config.accountId &&
    config.apiToken &&
    config.appId
  ) {
    try {
      const response = await fetch(
        buildRealtimeKitMeetingUrl({
          accountId: config.accountId,
          appId: config.appId,
        }),
        {
          body: JSON.stringify(buildRealtimeMeetingPayload({ title })),
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareMeetingResponse;
        const meeting = data.result ?? data.data ?? data;
        const meetingId = meeting?.id;

        if (meetingId) {
          return {
            id: meetingId,
            provider: "cloudflare_realtimekit",
            status: "configured",
            title: meeting?.title ?? title,
          };
        }
      }
      logCloudflareApiFailure({
        body: response.ok
          ? JSON.stringify({
              errors: "Missing RealtimeKit meeting id in response.",
            })
          : await readResponseSnippet(response),
        label: "Cloudflare RealtimeKit meeting creation failed",
        response,
      });
    } catch (error) {
      console.error("Cloudflare RealtimeKit meeting creation failed", error);
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockRealtimeMeeting({ kind, title });
  }

  throw new Error(realtimeSetupRequired.message);
};

const createRealtimeParticipant = async ({
  env,
  kind,
  meetingId,
  phase,
  role,
  user,
}: {
  env: AppEnv["Bindings"];
  kind: LiveExperienceKind;
  meetingId: string;
  phase?: BattlePhase;
  role: LiveParticipantRole;
  user: AuthenticatedUser;
}): Promise<RealtimeParticipantToken> => {
  const config = realtimeKitConfig(env);
  const presetName = resolveRealtimePreset({ kind, phase, role });

  if (
    hasRealtimeKitConfig(config) &&
    config.accountId &&
    config.apiToken &&
    config.appId
  ) {
    try {
      const response = await fetch(
        buildRealtimeKitParticipantUrl({
          accountId: config.accountId,
          appId: config.appId,
          meetingId,
        }),
        {
          body: JSON.stringify({
            custom_participant_id: user.id,
            name: user.name ?? user.email ?? "SoundKit User",
            preset_name: presetName,
          }),
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareParticipantResponse;
        const participant = data.result ?? data.data ?? data;
        const authToken = participant?.token;
        const participantId = participant?.id;

        if (authToken && participantId) {
          return {
            authToken,
            breakoutRoomId:
              phase === "lobby" ? `${meetingId}_lobby` : undefined,
            meetingId,
            participantId,
            presetName,
          };
        }
      }
      logCloudflareApiFailure({
        body: response.ok
          ? JSON.stringify({
              errors: "Missing RealtimeKit participant token in response.",
            })
          : await readResponseSnippet(response),
        label: "Cloudflare RealtimeKit participant creation failed",
        response,
      });
    } catch (error) {
      console.error(
        "Cloudflare RealtimeKit participant creation failed",
        error
      );
    }
  }

  if (allowsMockRealtime(config)) {
    return createMockParticipantToken({
      kind,
      meetingId,
      phase,
      role,
      user,
    });
  }

  throw new Error(realtimeSetupRequired.message);
};

const createRequiredStreamInput = async ({
  body,
  env,
}: {
  body: CreateLiveExperienceBody;
  env: AppEnv["Bindings"];
}) => {
  if (!(body.kind === "stream" && body.source === "obs")) {
    return null;
  }

  try {
    const streamInput = await createCloudflareStreamInput({
      env,
      title: body.title.trim(),
    });

    if (streamInput) {
      return streamInput;
    }
  } catch (error) {
    console.error("Cloudflare Stream live input creation failed", error);
  }

  if (allowsMockRealtime(realtimeKitConfig(env))) {
    return createMockStreamInput(body.title.trim());
  }

  return null;
};

const createMeetingForExperience = async ({
  body,
  env,
  streamInput,
}: {
  body: CreateLiveExperienceBody;
  env: AppEnv["Bindings"];
  streamInput: Awaited<ReturnType<typeof createCloudflareStreamInput>>;
}) => {
  try {
    return await createRealtimeMeeting({
      env,
      kind: body.kind,
      title: body.title.trim(),
    });
  } catch (error) {
    if (streamInput) {
      return createMockRealtimeMeeting({
        kind: body.kind,
        title: body.title.trim(),
      });
    }

    console.error("Unable to create live experience meeting", error);
    return null;
  }
};

const resolveMeetingIdForExperience = async (experienceId: string) => {
  const experience = await loadLiveExperienceById(experienceId);

  return experience?.meetingId ?? experienceId;
};

const isArtistUser = async (userId: string) => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  const [profile] = await createDb()
    .select({ accountType: userProfiles.accountType })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return profile?.accountType === "artist";
};

const isPartyHostingAllowed = async ({
  session,
  user,
}: {
  session: AppEnv["Variables"]["session"];
  user: AuthenticatedUser;
}) => {
  const entitlements = await resolveEntitlements({
    session: isAuthenticatedSession(session) ? session : null,
    user,
  });

  if (entitlements.isPremium) {
    return true;
  }

  return isArtistUser(user.id);
};

const persistLiveExperience = async ({
  body,
  createdByUserId,
  experienceId,
  meetingId,
  startsAt,
}: {
  body: CreateLiveExperienceBody;
  createdByUserId: string;
  experienceId: string;
  meetingId: string;
  startsAt: string;
}) => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const result = await createDb()
    .insert(liveExperiences)
    .values(
      buildLiveExperienceInsert({
        battleId: null,
        battleKitId: body.battleKitId,
        createdByUserId,
        id: experienceId,
        kind: body.kind,
        meetingId,
        playlistId: body.playlistId,
        projectId: body.projectId,
        source: body.source ?? defaultSourceForKind(body.kind),
        startsAt,
        title: body.title.trim(),
        visibility: body.visibility,
      })
    )
    .onConflictDoNothing();

  return result;
};

const durableRequest = (
  c: { env: AppEnv["Bindings"] },
  roomId: string,
  path: string,
  init?: RequestInit
) => {
  if (!c.env.LIVE_ROOMS) {
    return null;
  }

  const id = c.env.LIVE_ROOMS.idFromName(roomId);
  const stub = c.env.LIVE_ROOMS.get(id);
  const headers = new Headers(init?.headers);
  headers.set("x-soundkit-live-room-id", roomId);

  return stub.fetch(`https://live-room.soundkit.internal${path}`, {
    ...init,
    headers,
  });
};

const objectUrlFromMetadata = (metadata: unknown) => {
  if (!(metadata && typeof metadata === "object" && "url" in metadata)) {
    return null;
  }

  const { url } = metadata as { url?: unknown };
  return typeof url === "string" ? url : null;
};

const liveRoomTrackFromRow = ({
  artistName,
  coverArtUrl,
  status,
  title,
  trackId,
}: {
  artistName: string;
  coverArtUrl: null | string;
  status: LiveRoomTrack["status"];
  title: string;
  trackId: string;
}): LiveRoomTrack => ({
  artistName,
  coverArtUrl: coverArtUrl ?? "",
  durationMs: 0,
  id: trackId,
  lyrics: [],
  status,
  title,
});

const liveRoundStatusFromDb = (
  status: "active" | "completed" | "upcoming"
): LiveBattleRound["status"] => {
  if (status === "completed") {
    return "complete";
  }

  if (status === "active") {
    return "voting";
  }

  return "queued";
};

const trackStatusForRound = ({
  isFirstTrack,
  roundStatus,
}: {
  isFirstTrack: boolean;
  roundStatus: "active" | "completed" | "upcoming";
}): LiveRoomTrack["status"] => {
  if (roundStatus === "completed") {
    return "played";
  }

  if (roundStatus === "active") {
    return isFirstTrack ? "playing" : "queued";
  }

  return "queued";
};

const selectCurrentRound = <
  T extends {
    roundNumber: number;
    status: "active" | "completed" | "upcoming";
  },
>(
  rounds: T[]
) =>
  rounds.find((round) => round.status === "active") ??
  rounds.find((round) => round.status === "upcoming") ??
  rounds.at(-1) ??
  null;

const buildBattleRoomSnapshot = async (
  roomId: string
): Promise<LiveRoomState | null> => {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const db = createDb();
  const [battle] = await db
    .select({
      challengerArtistUserId: battles.challengerArtistUserId,
      createdAt: battles.createdAt,
      id: battles.id,
      opponentArtistUserId: battles.opponentArtistUserId,
      status: battles.status,
      title: battles.title,
      viewerCount: battles.viewerCount,
    })
    .from(battles)
    .where(or(eq(battles.id, roomId), eq(battles.externalBattleId, roomId)))
    .limit(1);

  if (!battle) {
    return null;
  }

  const roundRows = await db
    .select({
      id: battleRounds.id,
      isTiebreaker: battleRounds.isTiebreaker,
      roundNumber: battleRounds.roundNumber,
      status: battleRounds.status,
      trackOneId: battleRounds.trackOneId,
      trackOneVotes: battleRounds.trackOneVotes,
      trackTwoId: battleRounds.trackTwoId,
      trackTwoVotes: battleRounds.trackTwoVotes,
      winningTrackId: battleRounds.winningTrackId,
    })
    .from(battleRounds)
    .where(eq(battleRounds.battleId, battle.id))
    .orderBy(asc(battleRounds.roundNumber));
  const trackIds = [
    ...new Set(
      roundRows
        .flatMap((round) => [round.trackOneId, round.trackTwoId])
        .filter((trackId): trackId is string => Boolean(trackId))
    ),
  ];
  const profileIds = [
    ...new Set(
      [battle.challengerArtistUserId, battle.opponentArtistUserId].filter(
        (userId): userId is string => Boolean(userId)
      )
    ),
  ];
  const [trackRows, coverRows, profileRows] = await Promise.all([
    trackIds.length > 0
      ? db
          .select({
            artistName: userProfiles.displayName,
            id: tracks.id,
            ownerUserId: tracks.ownerUserId,
            title: tracks.title,
          })
          .from(tracks)
          .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
          .where(inArray(tracks.id, trackIds))
      : [],
    trackIds.length > 0
      ? db
          .select({
            metadata: trackAssets.metadata,
            trackId: trackAssets.trackId,
          })
          .from(trackAssets)
          .where(
            and(
              inArray(trackAssets.trackId, trackIds),
              eq(trackAssets.assetKind, "cover_art")
            )
          )
      : [],
    profileIds.length > 0
      ? db
          .select({
            avatarUrl: userProfiles.avatarUrl,
            displayName: userProfiles.displayName,
            userId: userProfiles.userId,
          })
          .from(userProfiles)
          .where(inArray(userProfiles.userId, profileIds))
      : [],
  ]);
  const coverByTrackId = new Map(
    coverRows.map((asset) => [
      asset.trackId,
      objectUrlFromMetadata(asset.metadata),
    ])
  );
  const trackById = new Map(
    trackRows.map((track) => [
      track.id,
      {
        artistName: track.artistName ?? "SoundKit Artist",
        coverArtUrl: coverByTrackId.get(track.id) ?? null,
        ownerUserId: track.ownerUserId,
        title: track.title,
      },
    ])
  );
  const profileByUserId = new Map(
    profileRows.map((profile) => [profile.userId, profile])
  );
  const currentRound = selectCurrentRound(roundRows);
  const fallbackArtistIds = [
    battle.challengerArtistUserId ?? "artist-one",
    battle.opponentArtistUserId ?? "artist-two",
  ] as const;
  const liveArtists: [LiveRoomArtist, LiveRoomArtist] = [
    {
      avatarUrl: profileByUserId.get(fallbackArtistIds[0])?.avatarUrl ?? "",
      id: fallbackArtistIds[0],
      isMuted: false,
      name:
        profileByUserId.get(fallbackArtistIds[0])?.displayName ?? "Artist One",
      roundsWon: roundRows.filter(
        (round) =>
          round.status === "completed" &&
          round.winningTrackId &&
          trackById.get(round.winningTrackId)?.ownerUserId ===
            fallbackArtistIds[0]
      ).length,
      stagePosition: "left",
      verified: false,
    },
    {
      avatarUrl: profileByUserId.get(fallbackArtistIds[1])?.avatarUrl ?? "",
      id: fallbackArtistIds[1],
      isMuted: currentRound?.status === "active",
      name:
        profileByUserId.get(fallbackArtistIds[1])?.displayName ?? "Artist Two",
      roundsWon: roundRows.filter(
        (round) =>
          round.status === "completed" &&
          round.winningTrackId &&
          trackById.get(round.winningTrackId)?.ownerUserId ===
            fallbackArtistIds[1]
      ).length,
      stagePosition: "right",
      verified: false,
    },
  ];
  const liveRounds = roundRows.flatMap((round): LiveBattleRound[] => {
    const trackOne = round.trackOneId ? trackById.get(round.trackOneId) : null;
    const trackTwo = round.trackTwoId ? trackById.get(round.trackTwoId) : null;

    if (!(round.trackOneId && trackOne && round.trackTwoId && trackTwo)) {
      return [];
    }

    return [
      {
        artistATrack: liveRoomTrackFromRow({
          artistName: trackOne.artistName,
          coverArtUrl: trackOne.coverArtUrl,
          status: trackStatusForRound({
            isFirstTrack: true,
            roundStatus: round.status,
          }),
          title: trackOne.title,
          trackId: round.trackOneId,
        }),
        artistBTrack: liveRoomTrackFromRow({
          artistName: trackTwo.artistName,
          coverArtUrl: trackTwo.coverArtUrl,
          status: trackStatusForRound({
            isFirstTrack: false,
            roundStatus: round.status,
          }),
          title: trackTwo.title,
          trackId: round.trackTwoId,
        }),
        id: round.id,
        isTiebreaker: round.isTiebreaker,
        number: round.roundNumber,
        status: liveRoundStatusFromDb(round.status),
        voteTotals: {
          [liveArtists[0].id]: round.trackOneVotes,
          [liveArtists[1].id]: round.trackTwoVotes,
        },
        winnerArtistId: round.winningTrackId
          ? (trackById.get(round.winningTrackId)?.ownerUserId ?? null)
          : null,
      },
    ];
  });
  const currentLiveRound =
    liveRounds.find((round) => round.id === currentRound?.id) ??
    liveRounds[0] ??
    null;
  const tracklist = currentLiveRound
    ? [currentLiveRound.artistATrack, currentLiveRound.artistBTrack]
    : [];

  return {
    battle: {
      artists: liveArtists,
      currentRoundId: currentLiveRound?.id ?? "",
      rounds: liveRounds,
      tiePolicy:
        "If the scheduled rounds end tied, SoundKit unlocks one tiebreaker song from each battle kit and runs sudden-death voting.",
    },
    chat: [],
    createdAt: battle.createdAt.toISOString(),
    currentTrackId: currentLiveRound?.artistATrack.id ?? "",
    hostName: liveArtists[0].name,
    id: battle.id,
    kind: "battle",
    status:
      battle.status === "completed"
        ? "ended"
        : battle.status === "live"
          ? "live"
          : "upcoming",
    summary:
      "Turn-based artist stages, synced lyrics, live chat, and voting at the end of every round.",
    title: battle.title,
    tracklist,
    viewerCount: battle.viewerCount,
  };
};

const seedDurableRoom = async ({
  c,
  room,
  roomId,
}: {
  c: { env: AppEnv["Bindings"] };
  room: LiveRoomState;
  roomId: string;
}) =>
  durableRequest(c, roomId, "/seed", {
    body: JSON.stringify(room),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

app.post("/experiences", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = createLiveExperienceBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live experience details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const body = parseResult.data;
  const startsAt = body.scheduledStartAt ?? new Date().toISOString();
  const canHostParty = await isPartyHostingAllowed({
    session: c.get("session"),
    user,
  });

  if (body.kind === "party" && !canHostParty) {
    return c.json(
      forbiddenMessage(
        "A premium subscription is required to host listening parties."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const streamInput = await createRequiredStreamInput({
    body,
    env: c.env,
  });

  if (body.kind === "stream" && body.source === "obs" && !streamInput) {
    return c.json(
      cloudflareStreamSetupRequired,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const meeting = await createMeetingForExperience({
    body,
    env: c.env,
    streamInput,
  });

  if (!meeting) {
    return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  const experienceId = `live_${body.kind}_${crypto.randomUUID()}`;
  const roomHref = `/live/${
    body.kind === "party" ? "parties" : `${body.kind}s`
  }/${experienceId}`;

  await persistLiveExperience({
    body,
    createdByUserId: user.id,
    experienceId,
    meetingId: meeting.id,
    startsAt,
  });

  return c.json(
    buildCreateExperienceResponse({
      body,
      createdByUserId: user.id,
      experienceId,
      meeting,
      roomHref,
      startsAt,
      streamInput,
    }),
    HttpStatusCodes.CREATED
  );
});

const buildCreateExperienceResponse = ({
  body,
  createdByUserId,
  experienceId,
  meeting,
  roomHref,
  startsAt,
  streamInput,
}: {
  body: CreateLiveExperienceBody;
  createdByUserId: string;
  experienceId: string;
  meeting: RealtimeMeeting;
  roomHref: string;
  startsAt: string;
  streamInput: Awaited<ReturnType<typeof createCloudflareStreamInput>>;
}) => ({
  defaults: {
    captions: true,
    chat: true,
    recording: true,
    setupScreen: true,
  },
  experience: {
    battleKitId: body.battleKitId ?? null,
    createdByUserId,
    description: body.description ?? "",
    format: body.format ?? null,
    genre: body.genre ?? null,
    id: experienceId,
    kind: body.kind,
    opponentUsername: body.opponentUsername ?? null,
    playlistId: body.playlistId ?? null,
    projectId: body.projectId ?? null,
    roomHref,
    scheduleMode: body.scheduleMode,
    source: body.source ?? defaultSourceForKind(body.kind),
    startsAt,
    status: body.scheduleMode === "asap" ? "ready" : "scheduled",
    title: body.title.trim(),
    visibility: body.visibility,
  },
  lock: {
    experienceId,
    kind: body.kind,
    startsAt,
    status: body.scheduleMode === "asap" ? "live" : "scheduled",
  },
  notifications: buildNotificationFanout({
    experienceId,
    kind: body.kind,
    title: body.title.trim(),
  }),
  realtime: meeting,
  streamInput,
});

app.post("/experiences/:experienceId/join", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = joinLiveExperienceBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live participant details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const experienceId = c.req.param("experienceId");
  const kind = liveKindFromExperienceId(experienceId);
  const meetingId = await resolveMeetingIdForExperience(experienceId);
  let participant: RealtimeParticipantToken;

  try {
    participant = await createRealtimeParticipant({
      env: c.env,
      kind,
      meetingId,
      phase: parseResult.data.phase,
      role: parseResult.data.role,
      user,
    });
  } catch (error) {
    console.error("Unable to create live participant token", error);
    return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
  }

  return c.json(
    {
      participant,
      setupScreen: true,
    },
    HttpStatusCodes.CREATED
  );
});

app.post("/experiences/:experienceId/session-locks/check", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = liveSessionLockCheckBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("Live session lock details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const conflict = findLiveSessionConflict(parseResult.data);

  return c.json(
    {
      conflict,
      hasConflict: Boolean(conflict),
    },
    HttpStatusCodes.OK
  );
});

app.post("/experiences/:experienceId/battlebot", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parseResult = battleBotActionBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return c.json(
      badRequest("BattleBot action details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const experienceId = c.req.param("experienceId");
  const experience = await loadLiveExperienceById(experienceId);
  const battleId = experience?.battleId ?? experienceId;
  const result = await applyBattleBotAction({
    action: parseResult.data.action,
    battleId,
    participants: parseResult.data.participants,
  });

  return c.json(
    {
      action: parseResult.data.action,
      admitted: result.admitted ?? [],
      battleBot: {
        message:
          "BattleBot recorded the room action and prepared the next transition.",
        nextPhase:
          result.nextPhase ?? nextBattlePhaseForAction(parseResult.data),
      },
      booted: result.booted ?? [],
      experienceId,
      snapshot:
        result.snapshot ??
        createRoundVoterSnapshot(parseResult.data.participants),
      winnerTrackId: result.winnerTrackId ?? null,
    },
    HttpStatusCodes.CREATED
  );
});

app.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const battleRoom = await buildBattleRoomSnapshot(roomId);

  if (battleRoom) {
    const seedResponse = await seedDurableRoom({ c, room: battleRoom, roomId });

    if (!seedResponse) {
      return c.json(battleRoom, HttpStatusCodes.OK);
    }
  }

  const response = await durableRequest(c, roomId, "/state");

  if (!response) {
    return c.json(
      { message: "Live room Durable Object binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.OK);
});

app.get("/rooms/:roomId/ws", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/ws", {
    headers: c.req.raw.headers,
    method: "GET",
  });

  if (!response) {
    return c.json(
      { message: "Live room WebSocket binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return response;
});

app.post("/rooms/:roomId/chat", async (c) => {
  const roomId = c.req.param("roomId");
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    userName?: string;
  };
  const response = await durableRequest(c, roomId, "/chat", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    return c.json(
      { message: "Live room chat is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.CREATED);
});

app.post("/rooms/:roomId/vote", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/vote", {
    body: JSON.stringify(await c.req.json().catch(() => ({}))),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    return c.json(
      { message: "Live room voting is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const voteBody = await response.json();
  return Response.json(voteBody, {
    status: response.status,
  });
});

app.post("/cloudflare-stream", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const title = body.title || "Live Stream";

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const streamInput = await createCloudflareStreamInput({
        env: c.env,
        title,
      });

      if (streamInput) {
        return c.json(streamInput, HttpStatusCodes.CREATED);
      }
    } catch (error) {
      console.error("Cloudflare Stream live input creation failed", error);
    }
  }

  return c.json(
    cloudflareStreamSetupRequired,
    HttpStatusCodes.SERVICE_UNAVAILABLE
  );
});

app.get("/cloudflare-stream/:streamId", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const streamId = c.req.param("streamId");
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          method: "GET",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as CloudflareStreamResponse;
        const streamInput = streamInputFromCloudflareResponse(data);

        if (streamInput) {
          return c.json(streamInput, HttpStatusCodes.OK);
        }
      }
    } catch (error) {
      console.error("Cloudflare Stream live input lookup failed", error);
    }
  }

  return c.json(
    {
      message: cloudflareStreamSetupRequired.message,
    },
    HttpStatusCodes.SERVICE_UNAVAILABLE
  );
});

export default app;
