import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battleKitTracks,
  battleKits,
  battleLineupSnapshots,
  battleQueueEntries,
  battleRounds,
  battles,
  listeningParties,
  liveExperiences,
  projectTracks,
  trackAssets,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, asc, desc, eq, gte, inArray, isNull, ne, or } from "drizzle-orm";
import { Hono } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { z } from "zod";

import type {
  LiveRoomIdentity,
  LiveRoomVoteBody,
} from "@/durable-objects/live-room";
import { publicAssetUrlFromParts } from "@/lib/asset-urls";
import { evaluateBattleKitReadiness } from "@/lib/battle-kits";
import { retryDurableObjectCall } from "@/lib/durable-object-retry";
import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreSlug } from "@/lib/genre-catalog";
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
  getFollowerUserIds,
  insertNotificationsForUsers,
  loadLiveExperienceById,
  notificationTypeForKind,
} from "@/lib/live-experience-events";
import { enqueueLiveStartedNotification } from "@/lib/live-notifications";
import type {
  LiveBattleArtistControls,
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
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new Hono<AppEnv>(),
  databaseUnavailableMessage = {
    message: "Database is not configured.",
  };

app.get("/experiences/public", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json([], HttpStatusCodes.OK);
  }

  const kind = c.req.query("kind"),
    db = createDb(),
    cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000),
    conditions = [
      eq(liveExperiences.visibility, "public"),
      or(
        eq(liveExperiences.status, "live"),
        and(
          eq(liveExperiences.status, "scheduled"),
          gte(liveExperiences.startsAt, cutoff)
        )
      ),
      kind
        ? eq(liveExperiences.kind, kind as "battle" | "party" | "stream")
        : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> =>
      Boolean(condition)
    ),
    experiences = await db
      .select({
        creatorAvatar: userProfiles.avatarUrl,
        creatorName: userProfiles.displayName,
        endsAt: liveExperiences.endsAt,
        genre: liveExperiences.genre,
        id: liveExperiences.id,
        kind: liveExperiences.kind,
        source: liveExperiences.source,
        startsAt: liveExperiences.startsAt,
        status: liveExperiences.status,
        title: liveExperiences.title,
        viewerCount: liveExperiences.viewerCount,
      })
      .from(liveExperiences)
      .leftJoin(
        userProfiles,
        eq(userProfiles.userId, liveExperiences.createdByUserId)
      )
      .where(and(...conditions))
      .orderBy(asc(liveExperiences.startsAt));

  return c.json(experiences, HttpStatusCodes.OK);
});

app.get("/experiences/me", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!isDatabaseConfigured()) {
    return c.json([], HttpStatusCodes.OK);
  }

  const db = createDb(),
    experiences = await db
      .select()
      .from(liveExperiences)
      .where(eq(liveExperiences.createdByUserId, user.id))
      .orderBy(desc(liveExperiences.createdAt));

  return c.json(experiences, HttpStatusCodes.OK);
});

app.delete("/experiences/:experienceId", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const experienceId = c.req.param("experienceId"),
    db = createDb(),
    [existing] = await db
      .select()
      .from(liveExperiences)
      .where(
        and(
          eq(liveExperiences.id, experienceId),
          eq(liveExperiences.createdByUserId, user.id)
        )
      )
      .limit(1);

  if (!existing) {
    return c.json(
      { message: "Experience not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  if (existing.streamInputId && c.env.CLOUDFLARE_ACCOUNT_ID) {
    const apiToken =
      c.env.CLOUDFLARE_STREAM_API_TOKEN ?? c.env.CLOUDFLARE_API_TOKEN;
    if (apiToken) {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${existing.streamInputId}`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
          method: "DELETE",
        }
      ).catch(() => null);
    }
  }

  await db.delete(liveExperiences).where(eq(liveExperiences.id, experienceId));

  return c.json({ message: "Experience deleted." }, HttpStatusCodes.OK);
});

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
  }),
  streamInputFromCloudflareResponse = (
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
  },
  createMockStreamInput = (title: string) => ({
    id: `mock_live_input_${crypto.randomUUID()}`,
    playbackUrl: "",
    rtmpsKey: `mock_${crypto.randomUUID()}`,
    rtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
    srtKey: `mock_${crypto.randomUUID()}`,
    srtUrl: "srt://live.cloudflare.com:443/live",
    status: "idle",
    title,
  }),
  cloudflareStreamSetupRequired = {
    message:
      "Cloudflare Stream live inputs are not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.",
  },
  OBS_RECONNECT_GRACE_MS = 30_000,
  readResponseSnippet = async (response: Response) => {
    const text = await response.text().catch(() => "");
    return text.slice(0, 500);
  },
  logCloudflareApiFailure = ({
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
  },
  createCloudflareStreamInput = async ({
    env,
    title,
  }: {
    env: AppEnv["Bindings"];
    title: string;
  }) => {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID,
      apiToken = env.CLOUDFLARE_STREAM_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;

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
  },
  syncCloudflareStreamStatus = async ({
    env,
    experience,
  }: {
    env: AppEnv["Bindings"];
    experience: typeof liveExperiences.$inferSelect;
  }) => {
    const accountId = env.CLOUDFLARE_ACCOUNT_ID,
      apiToken = env.CLOUDFLARE_STREAM_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN;
    if (!(accountId && apiToken && experience.streamInputId)) {
      return experience;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${experience.streamInputId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    ).catch(() => null);
    if (!response?.ok) {
      return experience;
    }

    const payload = (await response.json()) as CloudflareStreamResponse,
      inputStatus = payload.result?.status,
      connected = inputStatus === "connected" || inputStatus === "reconnected",
      disconnected =
        inputStatus === "client_disconnect" ||
        inputStatus === "ttl_exceeded" ||
        inputStatus === "failed_to_connect" ||
        inputStatus === "failed_to_reconnect";
    let { status } = experience,
      { endsAt } = experience,
      { ingestStatus } = experience,
      { reconnectUntil } = experience,
      { startedAt } = experience;

    if (connected) {
      const wasLive =
        experience.status === "live" && experience.ingestStatus === "connected";
      status = "live";
      endsAt = null;
      ingestStatus = "connected";
      reconnectUntil = null;
      startedAt = experience.startedAt ?? new Date();
      if (!wasLive) {
        await enqueueLiveStartedNotification({
          creatorUserId: experience.createdByUserId,
          eventType: "live_started",
          experienceId: experience.id,
          kind: experience.kind,
          queue: env.LIVE_NOTIFICATION_QUEUE,
          title: experience.title,
        });
      }
    } else if (disconnected && experience.status !== "ended") {
      const graceExpired =
        experience.reconnectUntil !== null &&
        experience.reconnectUntil !== undefined &&
        experience.reconnectUntil.getTime() <= Date.now();
      if (graceExpired) {
        status = "ended";
        endsAt = new Date();
        ingestStatus = "disconnected";
        reconnectUntil = null;
      } else {
        ingestStatus = "reconnecting";
        reconnectUntil =
          experience.reconnectUntil ??
          new Date(Date.now() + OBS_RECONNECT_GRACE_MS);
      }
    }

    if (
      status === experience.status &&
      endsAt === experience.endsAt &&
      ingestStatus === experience.ingestStatus &&
      reconnectUntil === experience.reconnectUntil &&
      startedAt === experience.startedAt
    ) {
      return experience;
    }

    const [updatedExperience] = await createDb()
      .update(liveExperiences)
      .set({
        endsAt,
        ingestStatus,
        reconnectUntil,
        startedAt,
        status,
        updatedAt: new Date(),
      })
      .where(eq(liveExperiences.id, experience.id))
      .returning();
    return updatedExperience ?? experience;
  },
  liveKindFromExperienceId = (experienceId: string): LiveExperienceKind => {
    if (experienceId.includes("_party_")) {
      return "party";
    }

    if (experienceId.includes("_stream_")) {
      return "stream";
    }

    return "battle";
  },
  defaultSourceForKind = (kind: LiveExperienceKind) => {
    if (kind === "party") {
      return "playlist";
    }

    return "browser";
  },
  nextBattlePhaseForAction = ({
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
  },
  realtimeKitConfig = (env: AppEnv["Bindings"]) => ({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    allowMockRealtime: env.SOUNDKIT_ALLOW_MOCK_REALTIME,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    appId: env.CLOUDFLARE_REALTIMEKIT_APP_ID,
  }),
  realtimeSetupRequired = {
    message:
      "Cloudflare RealtimeKit is not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_REALTIMEKIT_APP_ID.",
  },
  createRealtimeMeeting = async ({
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
          const data = (await response.json()) as CloudflareMeetingResponse,
            meeting = data.result ?? data.data ?? data,
            meetingId = meeting?.id;

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
  },
  createRealtimeParticipant = async ({
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
    const config = realtimeKitConfig(env),
      presetName = resolveRealtimePreset({ kind, phase, role });

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
          const data = (await response.json()) as CloudflareParticipantResponse,
            participant = data.result ?? data.data ?? data,
            authToken = participant?.token,
            participantId = participant?.id;

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
  },
  createRequiredStreamInput = async ({
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
  },
  createMeetingForExperience = async ({
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
  },
  resolveMeetingIdForExperience = async (experienceId: string) => {
    const experience = await loadLiveExperienceById(experienceId);

    return experience?.meetingId ?? experienceId;
  },
  isArtistUser = async (userId: string) => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const [profile] = await createDb()
      .select({ accountType: userProfiles.accountType })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return profile?.accountType === "artist";
  },
  isPartyHostingAllowed = async ({
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
  },
  persistLiveExperience = async ({
    body,
    createdByUserId,
    experienceId,
    meetingId,
    startsAt,
    streamInputId,
  }: {
    body: CreateLiveExperienceBody;
    createdByUserId: string;
    experienceId: string;
    meetingId: string;
    startsAt: string;
    streamInputId?: string | null;
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
          genre: body.genre ? canonicalGenreSlug(body.genre) : null,
          id: experienceId,
          kind: body.kind,
          meetingId,
          playlistId: body.playlistId,
          projectId: body.projectId,
          source: body.source ?? defaultSourceForKind(body.kind),
          startsAt,
          streamInputId,
          title: body.title.trim(),
          visibility: body.visibility,
        })
      )
      .onConflictDoNothing();

    return result;
  },
  resolveLiveRoomIdentity = async (
    c: {
      get?: (key: "user") => AuthenticatedUser | null;
    },
    roomId: string
  ): Promise<LiveRoomIdentity> => {
    const user = c.get?.("user");
    let role: LiveRoomIdentity["role"] = "fan";

    if (user?.role === "admin") {
      role = "admin";
    } else if (user && isDatabaseConfigured()) {
      const db = createDb(),
        [experience] = await db
          .select({
            battleId: liveExperiences.battleId,
            createdByUserId: liveExperiences.createdByUserId,
            kind: liveExperiences.kind,
          })
          .from(liveExperiences)
          .where(
            or(
              eq(liveExperiences.id, roomId),
              eq(liveExperiences.streamInputId, roomId)
            )
          )
          .limit(1);

      if (
        experience?.kind === "party" &&
        experience.createdByUserId === user.id
      ) {
        role = "host";
      } else if (experience?.battleId) {
        const [battle] = await db
          .select({
            challengerArtistUserId: battles.challengerArtistUserId,
            opponentArtistUserId: battles.opponentArtistUserId,
          })
          .from(battles)
          .where(eq(battles.id, experience.battleId))
          .limit(1);
        if (battle?.challengerArtistUserId === user.id) {
          role = "artist_a";
        } else if (battle?.opponentArtistUserId === user.id) {
          role = "artist_b";
        }
      }
    }

    return {
      displayName: user?.name?.trim() || "Listener",
      role,
      userId: user?.id ?? "anonymous",
    };
  },
  durableWebSocketRequest = async (
    c: {
      env: AppEnv["Bindings"];
      get?: (key: "user") => AuthenticatedUser | null;
    },
    roomId: string,
    request: Request
  ) => {
    if (!c.env.LIVE_ROOMS) {
      return null;
    }

    const headers = new Headers(request.headers),
      identity = await resolveLiveRoomIdentity(c, roomId);
    headers.set("x-soundkit-live-room-id", roomId);
    headers.set("x-soundkit-live-user-id", identity.userId);
    headers.set("x-soundkit-live-display-name", identity.displayName);
    headers.set("x-soundkit-live-role", identity.role ?? "fan");
    return c.env.LIVE_ROOMS.getByName(roomId).fetch(
      new Request(`https://live-room.soundkit.internal/ws`, {
        headers,
        method: "GET",
      })
    );
  },
  liveRoomTrackFromRow = ({
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
  }),
  liveRoundStatusFromDb = (
    status: "active" | "completed" | "upcoming"
  ): LiveBattleRound["status"] => {
    if (status === "completed") {
      return "complete";
    }

    if (status === "active") {
      return "voting";
    }

    return "queued";
  },
  trackStatusForRound = ({
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
  },
  selectCurrentRound = <
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
    null,
  buildBattleRoomSnapshot = async (
    roomId: string
  ): Promise<LiveRoomState | null> => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [battle] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          createdAt: battles.createdAt,
          format: battles.format,
          id: battles.id,
          opponentArtistUserId: battles.opponentArtistUserId,
          startsAt: battles.startsAt,
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
        .orderBy(asc(battleRounds.roundNumber)),
      trackIds = [
        ...new Set(
          roundRows
            .flatMap((round) => [round.trackOneId, round.trackTwoId])
            .filter((trackId): trackId is string => Boolean(trackId))
        ),
      ],
      profileIds = [
        ...new Set(
          [battle.challengerArtistUserId, battle.opponentArtistUserId].filter(
            (userId): userId is string => Boolean(userId)
          )
        ),
      ],
      [trackRows, coverRows, profileRows, snapshotRows, queueRows] =
        await Promise.all([
          trackIds.length > 0
            ? db
                .select({
                  artistName: userProfiles.displayName,
                  id: tracks.id,
                  ownerUserId: tracks.ownerUserId,
                  title: tracks.title,
                })
                .from(tracks)
                .leftJoin(
                  userProfiles,
                  eq(userProfiles.userId, tracks.ownerUserId)
                )
                .where(inArray(tracks.id, trackIds))
            : [],
          trackIds.length > 0
            ? db
                .select({
                  metadata: trackAssets.metadata,
                  objectKey: trackAssets.objectKey,
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
          db
            .select({
              artistUserId: battleLineupSnapshots.artistUserId,
              tracks: battleLineupSnapshots.tracks,
            })
            .from(battleLineupSnapshots)
            .where(eq(battleLineupSnapshots.battleId, battle.id)),
          db
            .select({
              userId: battleQueueEntries.userId,
            })
            .from(battleQueueEntries)
            .where(
              and(
                eq(battleQueueEntries.battleId, battle.id),
                eq(battleQueueEntries.status, "queued")
              )
            ),
        ]),
      coverByTrackId = new Map(
        coverRows.map((asset) => [
          asset.trackId,
          publicAssetUrlFromParts(asset),
        ])
      ),
      trackById = new Map(
        trackRows.map((track) => [
          track.id,
          {
            artistName: track.artistName ?? "SoundKit Artist",
            coverArtUrl: coverByTrackId.get(track.id) ?? null,
            ownerUserId: track.ownerUserId,
            title: track.title,
          },
        ])
      ),
      profileByUserId = new Map(
        profileRows.map((profile) => [profile.userId, profile])
      ),
      artistControlsByUserId: Record<string, LiveBattleArtistControls> =
        Object.fromEntries(
          snapshotRows.map((snapshot) => {
            const snapshotTracks = Array.isArray(snapshot.tracks)
              ? snapshot.tracks.filter(
                  (track): track is { trackId: string } =>
                    typeof track === "object" &&
                    track !== null &&
                    "trackId" in track &&
                    typeof track.trackId === "string"
                )
              : [];
            return [
              snapshot.artistUserId,
              {
                availableTrackIds: snapshotTracks.map((track) => track.trackId),
                currentTrackId: null,
                selectedNextTrackId: null,
                usedTrackIds: [],
              },
            ];
          })
        ),
      currentRound = selectCurrentRound(roundRows),
      fallbackArtistIds = [
        battle.challengerArtistUserId ?? "artist-one",
        battle.opponentArtistUserId ?? "artist-two",
      ] as const,
      liveArtists: [LiveRoomArtist, LiveRoomArtist] = [
        {
          avatarUrl: profileByUserId.get(fallbackArtistIds[0])?.avatarUrl ?? "",
          id: fallbackArtistIds[0],
          isMuted: false,
          name:
            profileByUserId.get(fallbackArtistIds[0])?.displayName ??
            "Artist One",
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
            profileByUserId.get(fallbackArtistIds[1])?.displayName ??
            "Artist Two",
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
      ],
      liveRounds = roundRows.flatMap((round): LiveBattleRound[] => {
        const trackOne = round.trackOneId
            ? trackById.get(round.trackOneId)
            : null,
          trackTwo = round.trackTwoId ? trackById.get(round.trackTwoId) : null;

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
      }),
      currentLiveRound =
        liveRounds.find((round) => round.id === currentRound?.id) ??
        liveRounds[0] ??
        null,
      tracklist = currentLiveRound
        ? [currentLiveRound.artistATrack, currentLiveRound.artistBTrack]
        : [];

    return {
      battle: {
        artistControlsByUserId,
        artists: liveArtists,
        currentRoundId: currentLiveRound?.id ?? "",
        queueSize: queueRows.length,
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
      startsAt: battle.startsAt ? battle.startsAt.toISOString() : null,
      status:
        battle.status === "completed"
          ? "ended"
          : (battle.status === "live"
            ? "live"
            : "upcoming"),
      summary:
        "Turn-based artist stages, synced lyrics, live chat, and voting at the end of every round.",
      title: battle.title,
      tracklist,
      viewerCount: battle.viewerCount,
    };
  },
  buildExperienceRoomSnapshot = async (
    roomId: string
  ): Promise<LiveRoomState | null> => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [experience] = await db
        .select({
          battleId: liveExperiences.battleId,
          createdAt: liveExperiences.createdAt,
          createdByUserId: liveExperiences.createdByUserId,
          genre: liveExperiences.genre,
          id: liveExperiences.id,
          ingestErrorCode: liveExperiences.ingestErrorCode,
          ingestErrorMessage: liveExperiences.ingestErrorMessage,
          ingestStatus: liveExperiences.ingestStatus,
          kind: liveExperiences.kind,
          playlistId: liveExperiences.playlistId,
          projectId: liveExperiences.projectId,
          reconnectUntil: liveExperiences.reconnectUntil,
          recordingStatus: liveExperiences.recordingStatus,
          replayPublishedAt: liveExperiences.replayPublishedAt,
          source: liveExperiences.source,
          startedAt: liveExperiences.startedAt,
          startsAt: liveExperiences.startsAt,
          status: liveExperiences.status,
          title: liveExperiences.title,
          viewerCount: liveExperiences.viewerCount,
        })
        .from(liveExperiences)
        .where(
          or(
            eq(liveExperiences.id, roomId),
            eq(liveExperiences.streamInputId, roomId)
          )
        )
        .limit(1);

    if (!experience) {
      return null;
    }

    if (experience.battleId) {
      const battleRoom = await buildBattleRoomSnapshot(experience.battleId);
      if (battleRoom) {
        return battleRoom;
      }
    }

    const [creatorProfile] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, experience.createdByUserId))
        .limit(1),
      hostName =
        creatorProfile?.displayName ??
        creatorProfile?.username ??
        "SoundKit Creator";

    let tracklist: LiveRoomTrack[] = [];

    if (experience.projectId) {
      const projectTrackRows = await db
          .select({
            artistName: userProfiles.displayName,
            id: tracks.id,
            title: tracks.title,
          })
          .from(projectTracks)
          .innerJoin(tracks, eq(tracks.id, projectTracks.trackId))
          .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
          .where(eq(projectTracks.projectId, experience.projectId))
          .orderBy(asc(projectTracks.position), asc(tracks.createdAt)),
        trackIds = projectTrackRows.map((t) => t.id),
        coverRows =
          trackIds.length > 0
            ? await db
                .select({
                  metadata: trackAssets.metadata,
                  objectKey: trackAssets.objectKey,
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
        coverByTrackId = new Map(
          coverRows.map((asset) => [
            asset.trackId,
            publicAssetUrlFromParts(asset),
          ])
        );

      tracklist = projectTrackRows.map((track, index) =>
        liveRoomTrackFromRow({
          artistName: track.artistName ?? hostName,
          coverArtUrl: coverByTrackId.get(track.id) ?? null,
          status: index === 0 ? "playing" : "queued",
          title: track.title,
          trackId: track.id,
        })
      );
    }

    const roomStatus: LiveRoomState["status"] =
      experience.status === "ended"
        ? "ended"
        : (experience.status === "live"
          ? "live"
          : "upcoming");

    const summary =
      experience.kind === "stream"
        ? `Live creator broadcast by ${hostName} on SoundKit.`
        : (experience.kind === "party"
          ? `Live listening party hosted by ${hostName}.`
          : `Live event on SoundKit.`);

    return {
      chat: [],
      createdAt: experience.createdAt.toISOString(),
      currentTrackId: tracklist[0]?.id ?? "",
      hostName,
      id: experience.id,
      kind: experience.kind,
      party:
        experience.kind === "party"
          ? {
              playback: {
                hostMode: "off_camera",
                hostUserId: experience.createdByUserId,
                playbackState: roomStatus === "live" ? "playing" : "paused",
                positionMs: 0,
                stateChangedAt: experience.startedAt?.getTime() ?? Date.now(),
                trackId: tracklist[0]?.id ?? null,
                trackIndex: 0,
              },
            }
          : undefined,
      status: roomStatus,
      stream:
        experience.kind === "stream"
          ? {
              errorCode: experience.ingestErrorCode,
              errorMessage: experience.ingestErrorMessage,
              ingestStatus:
                experience.ingestStatus === "connected"
                  ? "connected"
                  : experience.ingestStatus === "reconnecting"
                    ? "reconnecting"
                    : experience.ingestStatus === "error"
                      ? "error"
                      : experience.ingestStatus === "disconnected"
                        ? "disconnected"
                        : "idle",
              reconnectUntil: experience.reconnectUntil?.getTime() ?? null,
              replayStatus: experience.replayPublishedAt
                ? "available"
                : (experience.recordingStatus
                  ? "processing"
                  : "none"),
            }
          : undefined,
      summary,
      title: experience.title,
      tracklist,
      viewerCount: experience.viewerCount,
    };
  },
  buildListeningPartyRoomSnapshot = async (
    roomId: string
  ): Promise<LiveRoomState | null> => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [party] = await db
        .select({
          createdAt: listeningParties.createdAt,
          description: listeningParties.description,
          hostUserId: listeningParties.hostUserId,
          id: listeningParties.id,
          liveRoomId: listeningParties.liveRoomId,
          projectId: listeningParties.projectId,
          scheduledStartAt: listeningParties.scheduledStartAt,
          startedAt: listeningParties.startedAt,
          status: listeningParties.status,
          title: listeningParties.title,
        })
        .from(listeningParties)
        .where(
          or(
            eq(listeningParties.id, roomId),
            eq(listeningParties.liveRoomId, roomId)
          )
        )
        .limit(1);

    if (!party) {
      return null;
    }

    const [hostProfile] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, party.hostUserId))
        .limit(1),
      hostName =
        hostProfile?.displayName ?? hostProfile?.username ?? "SoundKit Creator";

    let tracklist: LiveRoomTrack[] = [];

    if (party.projectId) {
      const projectTrackRows = await db
          .select({
            artistName: userProfiles.displayName,
            id: tracks.id,
            title: tracks.title,
          })
          .from(projectTracks)
          .innerJoin(tracks, eq(tracks.id, projectTracks.trackId))
          .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
          .where(eq(projectTracks.projectId, party.projectId))
          .orderBy(asc(projectTracks.position), asc(tracks.createdAt)),
        trackIds = projectTrackRows.map((t) => t.id),
        coverRows =
          trackIds.length > 0
            ? await db
                .select({
                  metadata: trackAssets.metadata,
                  objectKey: trackAssets.objectKey,
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
        coverByTrackId = new Map(
          coverRows.map((asset) => [
            asset.trackId,
            publicAssetUrlFromParts(asset),
          ])
        );

      tracklist = projectTrackRows.map((track, index) =>
        liveRoomTrackFromRow({
          artistName: track.artistName ?? hostName,
          coverArtUrl: coverByTrackId.get(track.id) ?? null,
          status: index === 0 ? "playing" : "queued",
          title: track.title,
          trackId: track.id,
        })
      );
    }

    const roomStatus: LiveRoomState["status"] =
      party.status === "ended" || party.status === "canceled"
        ? "ended"
        : (party.status === "live"
          ? "live"
          : "upcoming");

    return {
      chat: [],
      createdAt: party.createdAt.toISOString(),
      currentTrackId: tracklist[0]?.id ?? "",
      hostName,
      id: party.id,
      kind: "party",
      party: {
        playback: {
          hostMode: "off_camera",
          hostUserId: party.hostUserId,
          playbackState: roomStatus === "live" ? "playing" : "paused",
          positionMs: 0,
          stateChangedAt: party.startedAt?.getTime() ?? Date.now(),
          trackId: tracklist[0]?.id ?? null,
          trackIndex: 0,
        },
      },
      status: roomStatus,
      summary:
        party.description ||
        `Live listening party hosted by ${hostName} on SoundKit.`,
      title: party.title,
      tracklist,
      viewerCount: 0,
    };
  },
  seedDurableRoom = async ({
    c,
    room,
    roomId,
  }: {
    c: {
      env: AppEnv["Bindings"];
    };
    room: LiveRoomState;
    roomId: string;
  }) => {
    if (!c.env.LIVE_ROOMS) {
      return null;
    }

    const liveRooms = c.env.LIVE_ROOMS,
      result = await retryDurableObjectCall(() =>
        liveRooms.getByName(roomId).seed(roomId, room)
      );
    return Response.json(result.room, {
      status: result.replaced ? HttpStatusCodes.CREATED : HttpStatusCodes.OK,
    });
  },
  getDurableRoomState = async (
    c: { env: AppEnv["Bindings"] },
    roomId: string
  ) => {
    if (!c.env.LIVE_ROOMS) {
      return null;
    }
    const liveRooms = c.env.LIVE_ROOMS;
    return retryDurableObjectCall(() =>
      liveRooms.getByName(roomId).getState(roomId)
    );
  },
  getDurableRoomStateForUser = async (
    c: {
      env: AppEnv["Bindings"];
      get?: (key: "user") => AuthenticatedUser | null;
    },
    roomId: string
  ) => {
    if (!c.env.LIVE_ROOMS) {
      return null;
    }
    const liveRooms = c.env.LIVE_ROOMS,
      identity = await resolveLiveRoomIdentity(c, roomId);
    return retryDurableObjectCall(() =>
      liveRooms.getByName(roomId).getStateForUser(roomId, identity)
    );
  },
  hasLiveRoomAccess = async (
    c: {
      get: (key: "session" | "user") => unknown;
    },
    isLive: boolean
  ) => {
    if (!(isLive && isDatabaseConfigured())) {
      return true;
    }

    const user = c.get("user") as AuthenticatedUser | null;
    if (user?.role === "admin") {
      return true;
    }

    if (!isAuthenticatedUser(user)) {
      return false;
    }

    const session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(
          session as AppEnv["Variables"]["session"]
        )
          ? (session as AppEnv["Variables"]["session"])
          : null,
        user,
      });

    return Boolean(
      entitlements.isPremium ||
      entitlements.canViewLiveBattles ||
      entitlements.canWatchCreatorStreams
    );
  };

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

  const body = parseResult.data,
    startsAt = body.scheduledStartAt ?? new Date().toISOString(),
    canHostParty = await isPartyHostingAllowed({
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

  if (body.battleKitId) {
    if (!isDatabaseConfigured()) {
      return c.json(
        databaseUnavailableMessage,
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [kit] = await db
        .select()
        .from(battleKits)
        .where(
          and(
            eq(battleKits.id, body.battleKitId),
            organizationId
              ? or(
                  eq(battleKits.ownerUserId, user.id),
                  and(
                    isNull(battleKits.ownerUserId),
                    eq(battleKits.organizationId, organizationId)
                  )
                )
              : eq(battleKits.ownerUserId, user.id)
          )
        )
        .limit(1);

    if (!kit) {
      return c.json(
        { message: "Battle Kit not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const kitTracks = await db
        .select({
          mainSlot: battleKitTracks.mainSlot,
          role: battleKitTracks.role,
          trackId: battleKitTracks.trackId,
        })
        .from(battleKitTracks)
        .where(eq(battleKitTracks.battleKitId, kit.id)),
      readiness = evaluateBattleKitReadiness({
        format: kit.format,
        tracks: kitTracks,
      });
    if (!readiness.isBattleReady) {
      return c.json(
        { message: readiness.reason ?? "Battle Kit is not battle ready." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (body.format && body.format !== kit.format) {
      return c.json(
        { message: "Battle Kit format does not match the live battle format." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
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

  const experienceId = `live_${body.kind}_${crypto.randomUUID()}`,
    roomHref = `/live/${
      body.kind === "party" ? "parties" : `${body.kind}s`
    }/${experienceId}`;

  await persistLiveExperience({
    body,
    createdByUserId: user.id,
    experienceId,
    meetingId: meeting.id,
    startsAt,
    streamInputId: streamInput?.id ?? null,
  });

  if (
    !(
      body.kind === "stream" &&
      body.source === "obs" &&
      body.scheduleMode === "asap"
    )
  ) {
    void (async () => {
      try {
        const followerUserIds = await getFollowerUserIds(user.id);
        if (followerUserIds.length > 0) {
          const isLiveNow = body.scheduleMode === "asap";
          await insertNotificationsForUsers({
            experienceId,
            kind: body.kind,
            message: isLiveNow
              ? `${body.title} is now live! Tap in to watch and chat.`
              : `${body.title} is scheduled for ${new Date(startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
            recipientUserIds: followerUserIds,
            title: isLiveNow
              ? `${body.title} is live`
              : `Upcoming live ${body.kind}: ${body.title}`,
            type: isLiveNow
              ? `${notificationTypeForKind(body.kind)}_live`
              : `${notificationTypeForKind(body.kind)}_scheduled`,
          });
        }
      } catch (error) {
        console.error("Live experience notification fanout failed", error);
      }
    })();
  }

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
    ingestStatus:
      body.kind === "stream" &&
      body.source === "obs" &&
      body.scheduleMode === "asap"
        ? "waiting_for_ingest"
        : "idle",
    kind: body.kind,
    opponentUsername: body.opponentUsername ?? null,
    playlistId: body.playlistId ?? null,
    projectId: body.projectId ?? null,
    roomHref,
    scheduleMode: body.scheduleMode,
    source: body.source ?? defaultSourceForKind(body.kind),
    startsAt,
    status:
      body.kind === "stream" &&
      body.source === "obs" &&
      body.scheduleMode === "asap"
        ? "waiting_for_ingest"
        : (body.scheduleMode === "asap"
          ? "ready"
          : "scheduled"),
    title: body.title.trim(),
    visibility: body.visibility,
  },
  lock: {
    experienceId,
    kind: body.kind,
    startsAt,
    status:
      body.kind === "stream" &&
      body.source === "obs" &&
      body.scheduleMode === "asap"
        ? "scheduled"
        : (body.scheduleMode === "asap"
          ? "live"
          : "scheduled"),
  },
  notifications: buildNotificationFanout({
    experienceId,
    kind: body.kind,
    title: body.title.trim(),
  }),
  realtime: meeting,
  streamInput,
});

app.get("/experiences/:experienceId", async (c) => {
  const storedExperience = await loadLiveExperienceById(
    c.req.param("experienceId")
  );

  if (!storedExperience) {
    return c.json(
      { message: "Live experience not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const experience =
    storedExperience.kind === "stream" && storedExperience.source === "obs"
      ? await syncCloudflareStreamStatus({
          env: c.env,
          experience: storedExperience,
        })
      : storedExperience;

  if (experience.visibility === "private") {
    const user = c.get("user");
    if (!isAuthenticatedUser(user) || user.id !== experience.createdByUserId) {
      return c.json(
        { message: "This live experience is private." },
        HttpStatusCodes.FORBIDDEN
      );
    }
  }

  if (!(await hasLiveRoomAccess(c, experience.status === "live"))) {
    return c.json(
      forbiddenMessage(
        "A Premium subscription is required to watch live rooms."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const customerCode = c.env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    streamBaseUrl =
      experience.streamInputId && customerCode
        ? `https://customer-${customerCode}.cloudflarestream.com/${experience.streamInputId}`
        : null,
    playbackUrl = streamBaseUrl ? `${streamBaseUrl}/manifest/video.m3u8` : null,
    playerUrl = streamBaseUrl ? `${streamBaseUrl}/iframe` : null;

  let creatorAvatar: string | null = null,
    creatorName: string | null = null;

  if (isDatabaseConfigured()) {
    const db = createDb(),
      [creatorProfile] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, experience.createdByUserId))
        .limit(1);

    creatorName =
      creatorProfile?.displayName ??
      creatorProfile?.username ??
      "SoundKit Creator";
    creatorAvatar = creatorProfile?.avatarUrl ?? null;
  }

  return c.json(
    {
      creatorAvatar,
      creatorName,
      genre: experience.genre ?? null,
      id: experience.id,
      ingestErrorCode: experience.ingestErrorCode,
      ingestErrorMessage: experience.ingestErrorMessage,
      ingestStatus: experience.ingestStatus,
      kind: experience.kind,
      playbackUrl,
      playerUrl,
      reconnectUntil: experience.reconnectUntil,
      replayPublishedAt: experience.replayPublishedAt,
      source: experience.source,
      startedAt: experience.startedAt,
      startsAt: experience.startsAt,
      status: experience.status,
      streamInputId: experience.streamInputId,
      title: experience.title,
      viewerCount: experience.viewerCount,
      visibility: experience.visibility,
    },
    HttpStatusCodes.OK
  );
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

  const experienceId = c.req.param("experienceId"),
    kind = liveKindFromExperienceId(experienceId),
    meetingId = await resolveMeetingIdForExperience(experienceId);
  let participantRole: LiveParticipantRole = parseResult.data.role,
    participantPhase = parseResult.data.phase;

  if (isDatabaseConfigured()) {
    const experience = await loadLiveExperienceById(experienceId);
    if (
      experience &&
      !(await hasLiveRoomAccess(c, experience.status === "live"))
    ) {
      return c.json(
        forbiddenMessage(
          "A Premium subscription is required to join live rooms."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (experience?.kind === "party") {
      participantRole =
        experience.createdByUserId === user.id ? "host" : "listener";
    } else if (experience?.battleId) {
      const [battle] = await createDb()
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          opponentArtistUserId: battles.opponentArtistUserId,
        })
        .from(battles)
        .where(eq(battles.id, experience.battleId))
        .limit(1);
      participantRole =
        battle?.challengerArtistUserId === user.id ||
        battle?.opponentArtistUserId === user.id
          ? "artist"
          : "listener";
      participantPhase = undefined;
    } else if (experience && experience.createdByUserId !== user.id) {
      participantRole = "viewer";
    }
  }

  let participant: RealtimeParticipantToken;

  try {
    participant = await createRealtimeParticipant({
      env: c.env,
      kind,
      meetingId,
      phase: participantPhase,
      role: participantRole,
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

  const experienceId = c.req.param("experienceId"),
    experience = await loadLiveExperienceById(experienceId),
    battleId = experience?.battleId ?? experienceId,
    result = await applyBattleBotAction({
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

app.post("/rooms/:roomId/battle/kit", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const roomId = c.req.param("roomId"),
    body = (await c.req.json().catch(() => ({}))) as { kitId?: string },
    experience = await loadLiveExperienceById(roomId),
    battleId = experience?.battleId ?? roomId,
    db = createDb(),
    [battle] = await db
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        format: battles.format,
        id: battles.id,
        opponentArtistUserId: battles.opponentArtistUserId,
        status: battles.status,
      })
      .from(battles)
      .where(
        or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
      )
      .limit(1);

  if (!battle || battle.status !== "scheduled") {
    return c.json(
      {
        message: "Battle lineup can only be selected before the battle starts.",
      },
      HttpStatusCodes.CONFLICT
    );
  }

  const role =
    battle.challengerArtistUserId === user.id
      ? "artist_a"
      : (battle.opponentArtistUserId === user.id
        ? "artist_b"
        : null);
  if (!role) {
    return c.json(
      forbiddenMessage("Only battle competitors can select a Battle Kit."),
      HttpStatusCodes.FORBIDDEN
    );
  }
  if (!body.kitId) {
    return c.json(
      { message: "A Battle Kit is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const [kit] = await db
    .select({ format: battleKits.format, id: battleKits.id })
    .from(battleKits)
    .where(
      and(eq(battleKits.id, body.kitId), eq(battleKits.ownerUserId, user.id))
    )
    .limit(1);
  if (!kit || kit.format !== battle.format) {
    return c.json(
      {
        message:
          "Battle Kit is missing, not owned by you, or the wrong format.",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }

  const kitTracks = await db
      .select({
        mainSlot: battleKitTracks.mainSlot,
        role: battleKitTracks.role,
        trackId: battleKitTracks.trackId,
      })
      .from(battleKitTracks)
      .where(eq(battleKitTracks.battleKitId, kit.id))
      .orderBy(asc(battleKitTracks.mainSlot), asc(battleKitTracks.seedOrder)),
    readiness = evaluateBattleKitReadiness({
      format: kit.format,
      tracks: kitTracks,
    });
  if (!readiness.isBattleReady) {
    return c.json(
      { message: readiness.reason ?? "Battle Kit is not ready." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  await db
    .insert(battleLineupSnapshots)
    .values({
      artistUserId: user.id,
      battleId: battle.id,
      format: kit.format,
      id: crypto.randomUUID(),
      kitId: kit.id,
      tracks: kitTracks,
    })
    .onConflictDoUpdate({
      set: { kitId: kit.id, tracks: kitTracks },
      target: [
        battleLineupSnapshots.battleId,
        battleLineupSnapshots.artistUserId,
      ],
    });

  return c.json(
    { battleId: battle.id, kitId: kit.id, role },
    HttpStatusCodes.OK
  );
});

app.post("/rooms/:roomId/battle/track", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  const roomId = c.req.param("roomId"),
    body = (await c.req.json().catch(() => ({}))) as { trackId?: string },
    identity = await resolveLiveRoomIdentity(c, roomId);
  if (
    !body.trackId ||
    !(identity.role === "artist_a" || identity.role === "artist_b")
  ) {
    return c.json(
      forbiddenMessage("Only the assigned competitor can select this track."),
      HttpStatusCodes.FORBIDDEN
    );
  }

  try {
    const room = await c.env.LIVE_ROOMS.getByName(roomId).chooseBattleTrack(
      roomId,
      body.trackId,
      identity
    );
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Battle track selection failed.",
      },
      HttpStatusCodes.CONFLICT
    );
  }
});

app.post("/rooms/:roomId/party/playback", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  const roomId = c.req.param("roomId"),
    body = (await c.req.json().catch(() => ({}))) as {
      trackId?: string;
      type?: "pause" | "resume" | "replay" | "track_changed";
    },
    identity = await resolveLiveRoomIdentity(c, roomId);
  if (!body.type || (body.type === "track_changed" && !body.trackId)) {
    return c.json(
      { message: "A valid playback action is required." },
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const room = await c.env.LIVE_ROOMS.getByName(roomId).updatePartyPlayback(
      roomId,
      body.type === "track_changed"
        ? { trackId: body.trackId ?? "", type: body.type }
        : (body.type === "replay"
          ? { trackId: body.trackId, type: body.type }
          : { type: body.type }),
      identity
    );
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Party playback update failed.",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }
});

app.get("/rooms/queue", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const db = createDb(),
    rows = await db
      .select({
        battleId: battleQueueEntries.battleId,
        startsAt: battles.startsAt,
        status: battles.status,
        title: battles.title,
      })
      .from(battleQueueEntries)
      .innerJoin(battles, eq(battles.id, battleQueueEntries.battleId))
      .where(
        and(
          eq(battleQueueEntries.userId, user.id),
          or(
            eq(battleQueueEntries.status, "queued"),
            eq(battleQueueEntries.status, "conflict")
          )
        )
      )
      .orderBy(asc(battles.startsAt));

  return c.json(
    {
      battles: rows.map((row) => ({
        battleId: row.battleId,
        startsAt: row.startsAt ? row.startsAt.toISOString() : null,
        status: row.status,
        title: row.title,
      })),
    },
    HttpStatusCodes.OK
  );
});

app.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId"),
    battleRoom = await buildBattleRoomSnapshot(roomId),
    experienceRoom = battleRoom
      ? null
      : await buildExperienceRoomSnapshot(roomId),
    partyRoom =
      battleRoom || experienceRoom
        ? null
        : await buildListeningPartyRoomSnapshot(roomId),
    realRoom = battleRoom ?? experienceRoom ?? partyRoom;

  if (realRoom) {
    if (!(await hasLiveRoomAccess(c, realRoom.status === "live"))) {
      return c.json(
        forbiddenMessage(
          "A Premium subscription is required to watch live rooms."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const seedResponse = await seedDurableRoom({ c, room: realRoom, roomId });

    if (!seedResponse) {
      return c.json(realRoom, HttpStatusCodes.OK);
    }
  }

  const room = await getDurableRoomStateForUser(c, roomId);

  if (!room) {
    return c.json(
      { message: "Live room Durable Object binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return c.json(room, HttpStatusCodes.OK);
});

app.get("/rooms/:roomId/ws", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.json(
      { message: "Expected WebSocket upgrade." },
      HttpStatusCodes.UPGRADE_REQUIRED
    );
  }

  const roomId = c.req.param("roomId"),
    room = await getDurableRoomState(c, roomId);
  if (!(await hasLiveRoomAccess(c, room?.status === "live"))) {
    return c.json(
      forbiddenMessage(
        "A Premium subscription is required to join live rooms."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const response = await durableWebSocketRequest(c, roomId, c.req.raw);

  if (!response) {
    return c.json(
      { message: "Live room WebSocket binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return response;
});

app.post("/rooms/:roomId/chat", async (c) => {
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room chat is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const roomId = c.req.param("roomId"),
    room = await getDurableRoomState(c, roomId);
  if (!(await hasLiveRoomAccess(c, room?.status === "live"))) {
    return c.json(
      forbiddenMessage("A Premium subscription is required to use live chat."),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as { message?: string },
    result = await c.env.LIVE_ROOMS.getByName(roomId).chat(
      roomId,
      body,
      await resolveLiveRoomIdentity(c, roomId)
    );

  return c.json(
    result,
    result.rateLimited
      ? HttpStatusCodes.TOO_MANY_REQUESTS
      : HttpStatusCodes.CREATED
  );
});

app.post("/rooms/:roomId/vote", async (c) => {
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room voting is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const roomId = c.req.param("roomId"),
    room = await getDurableRoomState(c, roomId);
  if (!(await hasLiveRoomAccess(c, room?.status === "live"))) {
    return c.json(
      forbiddenMessage(
        "A Premium subscription is required to vote in live battles."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as LiveRoomVoteBody,
    result = await c.env.LIVE_ROOMS.getByName(roomId).vote(
      roomId,
      body,
      await resolveLiveRoomIdentity(c, roomId)
    );

  return Response.json(result.body, { status: result.status });
});

app.post("/rooms/:roomId/queue", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room queue is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const roomId = c.req.param("roomId"),
    db = createDb(),
    [battle] = await db
      .select({
        id: battles.id,
        status: battles.status,
      })
      .from(battles)
      .where(or(eq(battles.id, roomId), eq(battles.externalBattleId, roomId)))
      .limit(1);

  if (!battle) {
    return c.json({ message: "Battle not found." }, HttpStatusCodes.NOT_FOUND);
  }

  if (battle.status === "completed" || battle.status === "archived") {
    return c.json(
      { message: "This battle is no longer accepting new queue entries." },
      HttpStatusCodes.CONFLICT
    );
  }

  // Overlap policy (multiple queues, one active): persist interest even when the
  // user is already admitted to another live battle, but mark this entry as a
  // conflict so the Durable Object skips admission until the active battle is left.
  const [activeBattleEntry] = await db
      .select({
        battleId: battleQueueEntries.battleId,
      })
      .from(battleQueueEntries)
      .innerJoin(battles, eq(battles.id, battleQueueEntries.battleId))
      .where(
        and(
          eq(battleQueueEntries.userId, user.id),
          ne(battleQueueEntries.battleId, battle.id),
          eq(battleQueueEntries.status, "queued"),
          eq(battles.status, "live")
        )
      )
      .limit(1),
    conflictBattleId = activeBattleEntry?.battleId ?? null,
    statusForEntry = conflictBattleId ? "conflict" : "queued";

  await db
    .insert(battleQueueEntries)
    .values({
      battleId: battle.id,
      conflictBattleId,
      id: crypto.randomUUID(),
      status: statusForEntry,
      userId: user.id,
    })
    .onConflictDoUpdate({
      set: {
        conflictBattleId,
        leftAt: null,
        status: statusForEntry,
        updatedAt: new Date(),
      },
      target: [battleQueueEntries.battleId, battleQueueEntries.userId],
    });

  const identity = await resolveLiveRoomIdentity(c, roomId),
    room = conflictBattleId
      ? await getDurableRoomState(c, roomId)
      : await c.env.LIVE_ROOMS.getByName(roomId).queueViewer(roomId, identity);

  return c.json(room ?? null, HttpStatusCodes.OK);
});

app.post("/rooms/:roomId/leave", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room leave is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const roomId = c.req.param("roomId");

  if (isDatabaseConfigured()) {
    const db = createDb(),
      [battle] = await db
        .select({
          id: battles.id,
        })
        .from(battles)
        .where(or(eq(battles.id, roomId), eq(battles.externalBattleId, roomId)))
        .limit(1);

    if (battle) {
      await db
        .update(battleQueueEntries)
        .set({
          leftAt: new Date(),
          status: "left",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(battleQueueEntries.battleId, battle.id),
            eq(battleQueueEntries.userId, user.id)
          )
        );
    }
  }

  const room = await c.env.LIVE_ROOMS.getByName(roomId).leaveViewer(
    roomId,
    await resolveLiveRoomIdentity(c, roomId)
  );

  return c.json(room, HttpStatusCodes.OK);
});

app.post("/cloudflare-stream", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const body = (await c.req.json().catch(() => ({}))) as { title?: string },
    title = body.title || "Live Stream",
    accountId = c.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken = c.env.CLOUDFLARE_STREAM_API_TOKEN ?? c.env.CLOUDFLARE_API_TOKEN;

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

const loadOwnedStreamExperience = async (streamId: string, userId: string) => {
  const experience = await createDb()
    .select()
    .from(liveExperiences)
    .where(
      and(
        eq(liveExperiences.streamInputId, streamId),
        eq(liveExperiences.createdByUserId, userId)
      )
    )
    .limit(1);

  return experience[0] ?? null;
};

app.delete("/cloudflare-stream/:streamId", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const streamId = c.req.param("streamId"),
    experience = await loadOwnedStreamExperience(streamId, user.id);
  if (!experience) {
    return c.json(
      { message: "Stream input not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken = c.env.CLOUDFLARE_STREAM_API_TOKEN ?? c.env.CLOUDFLARE_API_TOKEN;

  if (!(accountId && apiToken)) {
    return c.json(
      cloudflareStreamSetupRequired,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
    {
      body: JSON.stringify({ enabled: false }),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "PUT",
    }
  );

  if (!response.ok) {
    logCloudflareApiFailure({
      body: await readResponseSnippet(response),
      label: "Cloudflare Stream live input shutdown failed",
      response,
    });
    return c.json(
      { message: "Unable to stop the Cloudflare Stream input." },
      HttpStatusCodes.BAD_GATEWAY
    );
  }

  return c.json(
    { message: "Cloudflare Stream input stopped." },
    HttpStatusCodes.OK
  );
});

app.get("/cloudflare-stream/:streamId", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!isDatabaseConfigured()) {
    return c.json(
      databaseUnavailableMessage,
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const streamId = c.req.param("streamId"),
    experience = await loadOwnedStreamExperience(streamId, user.id);
  if (!experience) {
    return c.json(
      { message: "Stream input not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken = c.env.CLOUDFLARE_STREAM_API_TOKEN ?? c.env.CLOUDFLARE_API_TOKEN;

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
        const data = (await response.json()) as CloudflareStreamResponse,
          streamInput = streamInputFromCloudflareResponse(data);

        if (streamInput) {
          await syncCloudflareStreamStatus({ env: c.env, experience });
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
