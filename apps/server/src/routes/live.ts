import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battleKitTracks,
  battleKits,
  artistProfiles,
  battleLineupSnapshots,
  battleQueueEntries,
  battleRounds,
  battles,
  genres,
  listeningParties,
  liveExperiences,
  projectTracks,
  purchases,
  trackAssets,
  trackCollaborators,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";
import type { z } from "zod";

import type {
  LiveRoomBattleBotAction,
  LiveRoomBattleDisposition,
  LiveRoomIdentity,
  LiveRoomVoteBody,
} from "@/durable-objects/live-room";
import {
  guardedTrackPlaybackUrl,
  publicAssetUrlFromParts,
} from "@/lib/asset-urls";
import {
  battleHasPlayedTurn,
  isDurableReplayPlaybackUrl,
  resolveArtistBattleTitle,
  resolveBattleReplayStatus,
} from "@/lib/battle-display";
import { evaluateBattleKitReadiness } from "@/lib/battle-kits";
import { buildBattleRoundSeeds } from "@/lib/battle-rounds";
import { loadBattleSchemaCapabilities } from "@/lib/battle-schema-capabilities";
import { resolveListeningAccess } from "@/lib/content-access";
import { buildTrackSummary } from "@/lib/dashboard-mappers";
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
  createBattleCoordination,
  isBattleTerminalState,
} from "@/lib/live-battle-state";
import type {
  BattleCancellationReason,
  BattleOutcomeKind,
} from "@/lib/live-battle-state";
import {
  allowsMockRealtime,
  battleMediaPhase,
  buildNotificationFanout,
  buildRealtimeKitMeetingUrl,
  buildRealtimeKitParticipantUrl,
  buildRealtimeMeetingPayload,
  createMockParticipantToken,
  createMockRealtimeMeeting,
  createRoundVoterSnapshot,
  findLiveSessionConflict,
  hasRealtimeKitConfig,
  resolveBattleArtistRole,
  resolveBattleRoomRole,
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
  BATTLE_RECORD_THRESHOLD_VIEWERS,
  recordBattleParticipationOutcome,
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
  cloudflareStreamCustomerBaseUrl,
  fetchCloudflareStreamResponse,
  normalizeCloudflareStreamStatus,
  parseCloudflareStreamResponse,
  resolveCloudflareStreamConnection,
  resolveCloudflareStreamInputStatus,
} from "@/lib/live-stream";
import { notify } from "@/lib/notifications";
import { profileRegionCondition } from "@/lib/public-explore";
import {
  battleBotActionBodySchema,
  battleDispositionBodySchema,
  battleReadyBodySchema,
  createLiveExperienceBodySchema,
  joinLiveExperienceBodySchema,
  liveSessionLockCheckBodySchema,
  streamBotBodySchema,
  streamNowPlayingBodySchema,
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
    regionCondition = profileRegionCondition({
      region: c.req.query("region"),
      regionType: c.req.query("regionType"),
    }),
    db = createDb(),
    cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000),
    conditions = [
      eq(liveExperiences.visibility, "public"),
      or(
        eq(liveExperiences.status, "live"),
        and(
          eq(liveExperiences.status, "scheduled"),
          or(
            gte(liveExperiences.startsAt, cutoff),
            and(
              eq(liveExperiences.kind, "stream"),
              eq(liveExperiences.source, "obs")
            )
          )
        )
      ),
      kind
        ? eq(liveExperiences.kind, kind as "battle" | "party" | "stream")
        : undefined,
      regionCondition,
    ].filter((condition): condition is NonNullable<typeof condition> =>
      Boolean(condition)
    ),
    experiences = await db
      .select({
        creatorAvatar: userProfiles.avatarUrl,
        creatorName: userProfiles.displayName,
        creatorUserId: liveExperiences.createdByUserId,
        creatorUsername: userProfiles.username,
        endsAt: liveExperiences.endsAt,
        genre: liveExperiences.genre,
        id: liveExperiences.id,
        ingestStatus: liveExperiences.ingestStatus,
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
      .orderBy(asc(liveExperiences.startsAt)),
    synchronizedExperiences = await Promise.all(
      experiences.map(async (experience) => {
        if (!(experience.kind === "stream" && experience.source === "obs")) {
          return experience;
        }

        const storedExperience = await loadLiveExperienceById(experience.id);
        if (!storedExperience) {
          return experience;
        }

        const synchronizedExperience = await syncCloudflareStreamStatus({
          env: c.env,
          experience: storedExperience,
        });

        return {
          ...experience,
          endsAt: synchronizedExperience.endsAt,
          ingestStatus: synchronizedExperience.ingestStatus,
          status: synchronizedExperience.status,
        };
      })
    );

  return c.json(
    synchronizedExperiences.filter(
      (experience) =>
        (experience.status === "live" &&
          (experience.kind !== "stream" ||
            experience.source !== "obs" ||
            experience.ingestStatus === "connected")) ||
        (experience.status === "scheduled" &&
          experience.startsAt.getTime() >= cutoff.getTime())
    ),
    HttpStatusCodes.OK
  );
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
      .orderBy(desc(liveExperiences.createdAt)),
    synchronizedExperiences = await Promise.all(
      experiences.map((experience) =>
        experience.kind === "stream" && experience.source === "obs"
          ? syncCloudflareStreamStatus({ env: c.env, experience })
          : experience
      )
    );

  return c.json(synchronizedExperiences, HttpStatusCodes.OK);
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
    const [party] = await db
      .select({ hostUserId: listeningParties.hostUserId })
      .from(listeningParties)
      .where(
        and(
          eq(listeningParties.liveRoomId, experienceId),
          eq(listeningParties.hostUserId, user.id)
        )
      )
      .limit(1);

    if (!party) {
      return c.json(
        { message: "Experience not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db
      .delete(listeningParties)
      .where(eq(listeningParties.liveRoomId, experienceId));

    return c.json({ message: "Experience deleted." }, HttpStatusCodes.OK);
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
  if (existing.kind === "party") {
    await db
      .delete(listeningParties)
      .where(eq(listeningParties.liveRoomId, experienceId));
  }

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
    status?:
      | string
      | {
          state?: null | string;
        };
    uid?: string;
  };
  success?: boolean;
}

interface CloudflareStreamLifecycleResponse {
  live?: boolean;
  videoUID?: string | null;
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
      status: normalizeCloudflareStreamStatus(result.status),
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
      apiToken = env.CLOUDFLARE_STREAM_API_TOKEN ?? env.CLOUDFLARE_API_TOKEN,
      streamBaseUrl = cloudflareStreamCustomerBaseUrl(
        env.CLOUDFLARE_STREAM_CUSTOMER_CODE
      );
    if (!experience.streamInputId || experience.status === "ended") {
      return experience;
    }

    const inputResponsePromise =
        accountId && apiToken
          ? fetchCloudflareStreamResponse(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${encodeURIComponent(experience.streamInputId)}`,
              { headers: { Authorization: `Bearer ${apiToken}` } }
            )
          : Promise.resolve(null),
      lifecycleResponsePromise = streamBaseUrl
        ? fetchCloudflareStreamResponse(
            `${streamBaseUrl}/${encodeURIComponent(experience.streamInputId)}/lifecycle`
          )
        : Promise.resolve(null),
      [inputResponse, lifecycleResponse] = await Promise.all([
        inputResponsePromise,
        lifecycleResponsePromise,
      ]),
      payload =
        await parseCloudflareStreamResponse<CloudflareStreamResponse>(
          inputResponse
        ),
      lifecyclePayload =
        await parseCloudflareStreamResponse<CloudflareStreamLifecycleResponse>(
          lifecycleResponse
        ),
      inputStatus = normalizeCloudflareStreamStatus(payload?.result?.status),
      lifecycleLive =
        typeof lifecyclePayload?.live === "boolean"
          ? lifecyclePayload.live
          : null,
      connection = resolveCloudflareStreamConnection({
        experienceStatus: experience.status,
        inputStatus,
        lifecycleLive,
      }),
      connected = connection === "connected",
      disconnected = connection === "disconnected";

    if (!(payload || lifecyclePayload)) {
      return experience;
    }
    let status: typeof liveExperiences.$inferSelect.status = experience.status,
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
    } else if (disconnected) {
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
    if (action === "move_lobby_to_round" || action === "start_battle") {
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
    activeArtistUserId,
    env,
    kind,
    meetingId,
    phase,
    role,
    user,
  }: {
    activeArtistUserId?: string | null;
    env: AppEnv["Bindings"];
    kind: LiveExperienceKind;
    meetingId: string;
    phase?: BattlePhase;
    role: LiveParticipantRole;
    user: AuthenticatedUser;
  }): Promise<RealtimeParticipantToken> => {
    const config = realtimeKitConfig(env),
      presetName = resolveRealtimePreset({
        activeArtistUserId,
        kind,
        phase,
        role,
        userId: user.id,
      });

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
  ensureBattleLiveExperience = async ({
    env,
    experienceId,
  }: {
    env: AppEnv["Bindings"];
    experienceId: string;
  }) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [existingById] = await db
        .select()
        .from(liveExperiences)
        .where(eq(liveExperiences.id, experienceId))
        .limit(1);

    if (existingById) {
      return existingById;
    }

    const [battle] = await db
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        createdAt: battles.createdAt,
        id: battles.id,
        opponentArtistUserId: battles.opponentArtistUserId,
        startsAt: battles.startsAt,
        status: battles.status,
        title: battles.title,
        visibility: battles.visibility,
      })
      .from(battles)
      .where(
        or(
          eq(battles.id, experienceId),
          eq(battles.externalBattleId, experienceId)
        )
      )
      .limit(1);

    if (!battle) {
      return null;
    }

    const [existingByBattle] = await db
      .select()
      .from(liveExperiences)
      .where(eq(liveExperiences.battleId, battle.id))
      .limit(1);

    if (existingByBattle) {
      return existingByBattle;
    }

    const createdByUserId =
      battle.challengerArtistUserId ?? battle.opponentArtistUserId;
    if (!createdByUserId) {
      return null;
    }

    const meeting = await createRealtimeMeeting({
        env,
        kind: "battle",
        title: battle.title,
      }),
      status =
        battle.status === "live"
          ? "live"
          : (battle.status === "completed" || battle.status === "archived"
            ? "ended"
            : "scheduled"),
      startsAt = (battle.startsAt ?? battle.createdAt).toISOString(),
      [createdExperience] = await db
        .insert(liveExperiences)
        .values({
          ...buildLiveExperienceInsert({
            battleId: battle.id,
            battleKitId: null,
            createdByUserId,
            genre: null,
            id: battle.id,
            kind: "battle",
            meetingId: meeting.id,
            playlistId: null,
            projectId: null,
            source: "browser",
            startsAt,
            title: battle.title,
            visibility: battle.visibility,
          }),
          status,
        })
        .onConflictDoNothing()
        .returning();

    if (createdExperience) {
      return createdExperience;
    }

    const [battleExperience] = await db
      .select()
      .from(liveExperiences)
      .where(eq(liveExperiences.battleId, battle.id))
      .limit(1);
    return battleExperience ?? null;
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
  ensureListeningPartyLiveExperience = async ({
    env,
    roomId,
  }: {
    env: AppEnv["Bindings"];
    roomId: string;
  }) => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const db = createDb(),
      [party] = await db
        .select()
        .from(listeningParties)
        .where(
          or(
            eq(listeningParties.id, roomId),
            eq(listeningParties.liveRoomId, roomId)
          )
        )
        .limit(1);
    if (!party?.liveRoomId) {
      return null;
    }

    const [existing] = await db
      .select()
      .from(liveExperiences)
      .where(eq(liveExperiences.id, party.liveRoomId))
      .limit(1);
    if (existing) {
      return existing;
    }

    const meeting = await createRealtimeMeeting({
        env,
        kind: "party",
        title: party.title,
      }),
      [created] = await db
        .insert(liveExperiences)
        .values({
          ...buildLiveExperienceInsert({
            battleId: null,
            battleKitId: null,
            createdByUserId: party.hostUserId,
            genre: null,
            id: party.liveRoomId,
            kind: "party",
            meetingId: meeting.id,
            playlistId: party.playlistId,
            projectId: party.projectId,
            source: "playlist",
            startsAt: party.scheduledStartAt.toISOString(),
            title: party.title,
            visibility: "public",
          }),
          status:
            party.status === "live"
              ? "live"
              : (party.status === "ended" || party.status === "canceled"
                ? "ended"
                : "scheduled"),
        })
        .onConflictDoNothing()
        .returning();

    if (created) {
      return created;
    }

    const [raced] = await db
      .select()
      .from(liveExperiences)
      .where(eq(liveExperiences.id, party.liveRoomId))
      .limit(1);
    return raced ?? null;
  },
  resolveLiveRoomIdentity = async (
    c: {
      get?: (key: "user") => AuthenticatedUser | null;
    },
    roomId: string
  ): Promise<LiveRoomIdentity> => {
    const user = c.get?.("user"),
      isAdmin = user?.role === "admin";
    let role: LiveRoomIdentity["role"] = isAdmin ? "admin" : "fan",
      avatarUrl: string | null = null;
    if (user && isDatabaseConfigured()) {
      const db = createDb(),
        [experiences, profiles] = await Promise.all([
          db
            .select({
              battleId: liveExperiences.battleId,
              createdByUserId: liveExperiences.createdByUserId,
              kind: liveExperiences.kind,
            })
            .from(liveExperiences)
            .where(
              or(
                eq(liveExperiences.id, roomId),
                eq(liveExperiences.streamInputId, roomId),
                eq(liveExperiences.battleId, roomId)
              )
            )
            .limit(1),
          db
            .select({ avatarUrl: userProfiles.avatarUrl })
            .from(userProfiles)
            .where(eq(userProfiles.userId, user.id))
            .limit(1),
        ]),
        experience = experiences[0],
        profile = profiles[0];
      avatarUrl = profile?.avatarUrl ?? null;

      const [party] = experience
        ? []
        : await db
            .select({ hostUserId: listeningParties.hostUserId })
            .from(listeningParties)
            .where(
              or(
                eq(listeningParties.id, roomId),
                eq(listeningParties.liveRoomId, roomId)
              )
            )
            .limit(1);

      if (
        ((experience &&
          (experience.kind === "party" || experience.kind === "stream") &&
          experience.createdByUserId === user.id) ||
          (party && party.hostUserId === user.id)) &&
        !isAdmin
      ) {
        role = "host";
      } else if (
        !party &&
        (!experience || experience.battleId || experience.kind === "battle")
      ) {
        const battleId = experience?.battleId ?? roomId,
          [battle] = await db
            .select({
              challengerArtistUserId: battles.challengerArtistUserId,
              opponentArtistUserId: battles.opponentArtistUserId,
            })
            .from(battles)
            .where(
              or(
                eq(battles.id, battleId),
                eq(battles.externalBattleId, battleId)
              )
            )
            .limit(1);
        role = resolveBattleRoomRole({
          challengerArtistUserId: battle?.challengerArtistUserId,
          isAdmin,
          opponentArtistUserId: battle?.opponentArtistUserId,
          userId: user.id,
        });
      }
    }

    return {
      avatarUrl,
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
    request: Request,
    overlayToken?: string
  ) => {
    if (!c.env.LIVE_ROOMS) {
      return null;
    }

    const headers = new Headers(request.headers);
    headers.set("x-soundkit-live-room-id", roomId);
    if (overlayToken) {
      headers.set("x-soundkit-live-display-name", "Stream Overlay");
      headers.set("x-soundkit-live-overlay", "true");
      headers.set("x-soundkit-live-role", "host");
      headers.set("x-soundkit-live-user-id", `stream-overlay:${roomId}`);
    } else {
      const identity = await resolveLiveRoomIdentity(c, roomId);
      headers.set("x-soundkit-live-user-id", identity.userId);
      headers.set("x-soundkit-live-display-name", identity.displayName);
      headers.set(
        "x-soundkit-live-avatar-url",
        identity.avatarUrl ?? "/soundkit-default-avatar.svg"
      );
      headers.set("x-soundkit-live-role", identity.role ?? "fan");
    }
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
    href: `/tracks/${encodeURIComponent(trackId)}`,
    id: trackId,
    lyrics: [],
    status,
    title,
  }),
  buildLiveReviewCatalog = async ({
    db,
    query,
    session,
    user,
  }: {
    db: ReturnType<typeof createDb>;
    query?: string;
    session: AppEnv["Variables"]["session"];
    user: AuthenticatedUser;
  }) => {
    const [collaboratorRows, directPurchaseRows, projectPurchaseRows] =
        await Promise.all([
          db
            .select({ trackId: trackCollaborators.trackId })
            .from(trackCollaborators)
            .where(
              and(
                eq(trackCollaborators.collaboratorUserId, user.id),
                eq(trackCollaborators.invitationStatus, "accepted")
              )
            ),
          db
            .select({ trackId: purchases.trackId })
            .from(purchases)
            .where(eq(purchases.buyerUserId, user.id)),
          db
            .select({ trackId: projectTracks.trackId })
            .from(purchases)
            .innerJoin(
              projectTracks,
              eq(projectTracks.projectId, purchases.projectId)
            )
            .where(eq(purchases.buyerUserId, user.id)),
        ]),
      collaboratorTrackIds = collaboratorRows.map((row) => row.trackId),
      purchasedTrackIds = new Set([
        ...directPurchaseRows.flatMap((row) =>
          row.trackId ? [row.trackId] : []
        ),
        ...projectPurchaseRows.map((row) => row.trackId),
      ]),
      visibilityConditions = [
        eq(tracks.isPublic, true),
        eq(tracks.ownerUserId, user.id),
        purchasedTrackIds.size > 0
          ? inArray(tracks.id, [...purchasedTrackIds])
          : undefined,
        collaboratorTrackIds.length > 0
          ? inArray(tracks.id, collaboratorTrackIds)
          : undefined,
      ],
      candidateConditions = [
        isNull(tracks.deletedAt),
        or(...visibilityConditions.filter(Boolean)),
        query ? ilike(tracks.title, `%${query}%`) : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> =>
        Boolean(condition)
      ),
      candidates = await db
        .select()
        .from(tracks)
        .where(and(...candidateConditions))
        .orderBy(desc(tracks.updatedAt))
        .limit(100),
      entitlements = await resolveEntitlements({
        session,
        user,
      }),
      summaries = await Promise.all(
        candidates.map(async (track) => {
          const isOwner = track.ownerUserId === user.id,
            isCollaborator = collaboratorTrackIds.includes(track.id),
            access = resolveListeningAccess({
              hasPurchase: purchasedTrackIds.has(track.id),
              isPremium: entitlements.isPremium,
              policy: track,
            });

          if (
            !(
              isOwner ||
              isCollaborator ||
              ((track.isPublic || purchasedTrackIds.has(track.id)) &&
                access.canListen)
            )
          ) {
            return null;
          }

          const summary = await buildTrackSummary(track);
          return summary.mediaReady
            ? {
                artistName: summary.artistName,
                coverArtUrl: summary.coverArtUrl,
                id: summary.id,
                isPublic: track.isPublic,
                mediaReady: true,
                playbackUrl: guardedTrackPlaybackUrl(track.id),
                title: summary.title,
              }
            : null;
        })
      );

    return summaries.filter((summary) => summary !== null);
  },
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
  materializeBattleRounds = async ({
    battle,
    db,
    lineupSnapshots,
  }: {
    battle: {
      challengerArtistUserId: string | null;
      format: "best_of_3" | "best_of_5" | "best_of_7";
      id: string;
      opponentArtistUserId: string | null;
      status: "archived" | "completed" | "live" | "scheduled";
    };
    db: ReturnType<typeof createDb>;
    lineupSnapshots: {
      artistUserId: string;
      tracks: unknown;
    }[];
  }) => {
    if (battle.status !== "live" && battle.status !== "scheduled") {
      return;
    }

    const seeds = buildBattleRoundSeeds({
      artistA: lineupSnapshots.find(
        (snapshot) => snapshot.artistUserId === battle.challengerArtistUserId
      ),
      artistB: lineupSnapshots.find(
        (snapshot) => snapshot.artistUserId === battle.opponentArtistUserId
      ),
      battleId: battle.id,
      format: battle.format,
    });
    if (!seeds) {
      return;
    }

    await db.transaction(async (tx) => {
      const existingRounds = await tx
        .select({ id: battleRounds.id })
        .from(battleRounds)
        .where(eq(battleRounds.battleId, battle.id))
        .limit(1);
      if (existingRounds.length > 0) {
        return;
      }

      await tx.insert(battleRounds).values(seeds).onConflictDoNothing();
    });
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
      schemaCapabilities = await loadBattleSchemaCapabilities(),
      [battle] = await db
        .select({
          challengerArtistUserId: battles.challengerArtistUserId,
          createdAt: battles.createdAt,
          endedAt: battles.endedAt,
          format: battles.format,
          genre: genres.name,
          id: battles.id,
          opponentArtistUserId: battles.opponentArtistUserId,
          outcome: schemaCapabilities.battleOutcome
            ? battles.outcome
            : sql<BattleOutcomeKind | null>`null`,
          outcomeReason: schemaCapabilities.battleOutcomeReason
            ? battles.outcomeReason
            : sql<string | null>`null`,
          outcomeUserId: schemaCapabilities.battleOutcomeUser
            ? battles.outcomeUserId
            : sql<string | null>`null`,
          replayVideoId: battles.replayVideoId,
          startsAt: battles.startsAt,
          status: battles.status,
          title: battles.title,
          updatedAt: battles.updatedAt,
          viewerCount: battles.viewerCount,
          winnerUserId: schemaCapabilities.battleWinner
            ? battles.winnerUserId
            : sql<string | null>`null`,
        })
        .from(battles)
        .leftJoin(genres, eq(genres.id, battles.genreId))
        .where(or(eq(battles.id, roomId), eq(battles.externalBattleId, roomId)))
        .limit(1);

    if (!battle) {
      return null;
    }

    const loadBattleRoundRows = () =>
      db
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

    let [roundRows, lineupSnapshots, experienceRows] = await Promise.all([
      loadBattleRoundRows(),
      db
        .select({
          artistUserId: battleLineupSnapshots.artistUserId,
          kitId: battleLineupSnapshots.kitId,
          tracks: battleLineupSnapshots.tracks,
        })
        .from(battleLineupSnapshots)
        .where(eq(battleLineupSnapshots.battleId, battle.id)),
      db
        .select({
          recordingStatus: liveExperiences.recordingStatus,
          replayPublishedAt: liveExperiences.replayPublishedAt,
          startedAt: liveExperiences.startedAt,
        })
        .from(liveExperiences)
        .where(eq(liveExperiences.battleId, battle.id)),
    ]);

    if (roundRows.length === 0) {
      await materializeBattleRounds({
        battle,
        db,
        lineupSnapshots,
      });
      roundRows = await loadBattleRoundRows();
    }

    const trackIds = [
        ...new Set(
          roundRows
            .flatMap((round) => [round.trackOneId, round.trackTwoId])
            .filter((trackId): trackId is string => Boolean(trackId))
        ),
      ],
      replayVideoIds = battle.replayVideoId ? [battle.replayVideoId] : [],
      profileIds = [
        ...new Set(
          [battle.challengerArtistUserId, battle.opponentArtistUserId].filter(
            (userId): userId is string => Boolean(userId)
          )
        ),
      ],
      [
        trackRows,
        coverRows,
        profileRows,
        rankRows,
        snapshotRows,
        queueRows,
        replayVideoRows,
      ] = await Promise.all([
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
        profileIds.length > 0
          ? db
              .select({
                rank: sql<number>`row_number() over (order by ${artistProfiles.battleCount} desc, ${artistProfiles.followerCount} desc, ${artistProfiles.userId})`,
                userId: artistProfiles.userId,
              })
              .from(artistProfiles)
              .where(
                and(
                  eq(artistProfiles.publicProfileEnabled, true),
                  or(
                    gt(artistProfiles.battleCount, 0),
                    gt(artistProfiles.followerCount, 0)
                  )
                )
              )
          : [],
        lineupSnapshots,
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
        replayVideoIds.length > 0
          ? db
              .select({
                externalPlaybackUrl: videos.externalPlaybackUrl,
                id: videos.id,
                isPublic: videos.isPublic,
                publishedAt: videos.publishedAt,
                status: videos.status,
                videoKind: videos.videoKind,
              })
              .from(videos)
              .where(inArray(videos.id, replayVideoIds))
          : [],
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
      rankByUserId = new Map(
        rankRows.map((profile) => [profile.userId, profile.rank])
      ),
      experience = experienceRows[0],
      replayVideo = replayVideoRows[0],
      hasPlayedTurn = battleHasPlayedTurn({
        experienceStartedAt: experience?.startedAt,
        outcome: battle.outcome,
        roundStatuses: roundRows.map((round) => round.status),
      }),
      replayStatus = resolveBattleReplayStatus({
        recordingStatus: experience?.recordingStatus,
        replayPublishedAt: experience?.replayPublishedAt,
        replayVideoAvailable: Boolean(
          replayVideo?.isPublic &&
          replayVideo.publishedAt &&
          replayVideo.status === "ready" &&
          replayVideo.videoKind === "battle_replay" &&
          isDurableReplayPlaybackUrl(replayVideo.externalPlaybackUrl)
        ),
      }),
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
                selectedKitId: snapshot.kitId,
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
      battleOutcome = battle.outcome
        ? {
            affectedUserId: battle.outcomeUserId,
            kind: battle.outcome,
            reason: (battle.outcomeReason ??
              "other") as BattleCancellationReason,
            recordedAt: battle.endedAt?.getTime() ?? battle.updatedAt.getTime(),
          }
        : undefined,
      coordination = createBattleCoordination({
        battleId: battle.id,
        format: battle.format,
        now: Date.now(),
        scheduledStartAt: battle.startsAt?.getTime() ?? null,
      }),
      liveArtists: [LiveRoomArtist, LiveRoomArtist] = [
        {
          avatarUrl: profileByUserId.get(fallbackArtistIds[0])?.avatarUrl ?? "",
          id: fallbackArtistIds[0],
          isMuted: false,
          name:
            profileByUserId.get(fallbackArtistIds[0])?.displayName ??
            "Artist One",
          rank: rankByUserId.get(fallbackArtistIds[0]) ?? null,
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
          rank: rankByUserId.get(fallbackArtistIds[1]) ?? null,
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

    coordination.winnerUserId = battle.winnerUserId;

    if (battle.status === "completed" || battle.status === "archived") {
      coordination.phase = "ended";
      coordination.phaseEndsAt = null;
    }

    if (battleOutcome) {
      coordination.phase = "ended";
      coordination.phaseEndsAt = null;
      coordination.outcome = battleOutcome;
    }

    return {
      battle: {
        artistControlsByUserId,
        artists: liveArtists,
        coordination,
        currentRoundId: currentLiveRound?.id ?? "",
        hasPlayedTurn,
        outcome: battleOutcome,
        queueSize: queueRows.length,
        replayStatus,
        replayVideoId: battle.replayVideoId,
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
        battle.status === "completed" || battle.status === "archived"
          ? "ended"
          : (battle.status === "live"
            ? "live"
            : "upcoming"),
      summary:
        "Turn-based artist stages, synced lyrics, live chat, and voting at the end of every round.",
      title: resolveArtistBattleTitle(battle.title, battle.genre ?? "Hip-Hop"),
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
                mediaAvailable: true,
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
              botEnabled: false,
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
              nowPlaying: null,
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
          experienceMediaAvailable: liveExperiences.meetingId,
          experienceStartedAt: liveExperiences.startedAt,
          experienceStatus: liveExperiences.status,
          experienceViewerCount: liveExperiences.viewerCount,
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
        .leftJoin(
          liveExperiences,
          eq(liveExperiences.id, listeningParties.liveRoomId)
        )
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
      party.status === "ended" ||
      party.status === "canceled" ||
      party.experienceStatus === "ended"
        ? "ended"
        : (party.status === "live" || party.experienceStatus === "live"
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
          mediaAvailable: Boolean(party.experienceMediaAvailable),
          playbackState: roomStatus === "live" ? "playing" : "paused",
          positionMs: 0,
          stateChangedAt:
            party.experienceStartedAt?.getTime() ??
            party.startedAt?.getTime() ??
            Date.now(),
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
      viewerCount: party.experienceViewerCount ?? 0,
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
    isLive: boolean,
    roomId?: string
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

    if (roomId) {
      const identity = await resolveLiveRoomIdentity(
        {
          get: (key) => (key === "user" ? user : null),
        },
        roomId
      );
      if (
        identity.role === "artist_a" ||
        identity.role === "artist_b" ||
        identity.role === "host"
      ) {
        return true;
      }
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
    session = c.get("session"),
    entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    }),
    canHostParty = entitlements.isPremium || (await isArtistUser(user.id));

  if (body.kind === "party" && !canHostParty) {
    return c.json(
      forbiddenMessage(
        "Premium access or an artist account is required to host listening parties."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  if (body.kind === "stream" && !entitlements.canHostLiveStreams) {
    return c.json(
      forbiddenMessage(
        "A Premium Artist subscription is required to host live streams."
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

    const requestSession = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(requestSession)
          ? requestSession
          : null,
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

  if (
    !(await hasLiveRoomAccess(c, experience.status === "live", experience.id))
  ) {
    return c.json(
      forbiddenMessage(
        "A Premium subscription is required to watch live rooms."
      ),
      HttpStatusCodes.FORBIDDEN
    );
  }

  const canPlayStream =
      experience.status === "live" && experience.ingestStatus === "connected",
    streamCustomerBaseUrl = cloudflareStreamCustomerBaseUrl(
      c.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    ),
    streamBaseUrl =
      experience.streamInputId && streamCustomerBaseUrl
        ? `${streamCustomerBaseUrl}/${encodeURIComponent(experience.streamInputId)}`
        : null,
    playbackUrl =
      streamBaseUrl && canPlayStream
        ? `${streamBaseUrl}/manifest/video.m3u8`
        : null,
    playerUrl =
      streamBaseUrl && canPlayStream ? `${streamBaseUrl}/iframe` : null;

  let creatorAvatar: string | null = null,
    creatorName: string | null = null,
    creatorUsername: string | null = null;

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
    creatorUsername = creatorProfile?.username ?? null;
  }

  return c.json(
    {
      creatorAvatar,
      creatorName,
      creatorUserId: experience.createdByUserId,
      creatorUsername,
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

app.get("/experiences/:experienceId/review-catalog", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const experience = await loadLiveExperienceById(c.req.param("experienceId"));
  if (!experience) {
    return c.json(
      { message: "Live experience not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }
  if (experience.kind !== "stream") {
    return c.json(
      { message: "Review catalog is only available for stream rooms." },
      HttpStatusCodes.CONFLICT
    );
  }
  if (experience.createdByUserId !== user.id && user.role !== "admin") {
    return c.json(
      forbiddenMessage("Only the stream host can access the review catalog."),
      HttpStatusCodes.FORBIDDEN
    );
  }
  if (experience.status === "ended") {
    return c.json(
      { message: "The ended stream review catalog is read-only." },
      HttpStatusCodes.CONFLICT
    );
  }
  if (!isDatabaseConfigured()) {
    return c.json([], HttpStatusCodes.OK);
  }

  const query = c.req.query("q")?.trim().slice(0, 120);
  return c.json(
    await buildLiveReviewCatalog({
      db: createDb(),
      query: query || undefined,
      session: c.get("session"),
      user,
    }),
    HttpStatusCodes.OK
  );
});

app.post("/experiences/:experienceId/overlay-token", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room overlays are not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const experience = await loadLiveExperienceById(c.req.param("experienceId"));
  if (!experience) {
    return c.json(
      { message: "Live experience not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }
  if (experience.kind !== "stream") {
    return c.json(
      { message: "OBS overlays are only available for stream rooms." },
      HttpStatusCodes.CONFLICT
    );
  }

  const roomSnapshot = await buildExperienceRoomSnapshot(experience.id);
  if (roomSnapshot) {
    await seedDurableRoom({ c, room: roomSnapshot, roomId: experience.id });
  }

  try {
    const token = await c.env.LIVE_ROOMS.getByName(
      experience.id
    ).createStreamOverlayToken(
      experience.id,
      await resolveLiveRoomIdentity(c, experience.id)
    );
    return c.json(token, HttpStatusCodes.CREATED);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to create the OBS overlay token.",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }
});

app.post("/rooms/:roomId/stream/bot", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parsed = streamBotBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return c.json(
      badRequest("StreamBot settings are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const roomId = c.req.param("roomId"),
    experience = await loadLiveExperienceById(roomId);
  if (!experience || experience.kind !== "stream") {
    return c.json(
      { message: "Stream room not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const roomSnapshot = await buildExperienceRoomSnapshot(roomId);
  if (roomSnapshot) {
    await seedDurableRoom({ c, room: roomSnapshot, roomId });
  }

  try {
    const room = await c.env.LIVE_ROOMS.getByName(roomId).setStreamBotEnabled(
      roomId,
      await resolveLiveRoomIdentity(c, roomId),
      parsed.data.enabled
    );
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error ? error.message : "StreamBot update failed.",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }
});

app.post("/rooms/:roomId/stream/now-playing", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parsed = streamNowPlayingBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return c.json(
      badRequest("Now Playing details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const roomId = c.req.param("roomId"),
    experience = await loadLiveExperienceById(roomId);
  if (!experience || experience.kind !== "stream") {
    return c.json(
      { message: "Stream room not found." },
      HttpStatusCodes.NOT_FOUND
    );
  }
  if (experience.status === "ended") {
    return c.json(
      { message: "The ended stream is read-only." },
      HttpStatusCodes.CONFLICT
    );
  }

  const roomSnapshot = await buildExperienceRoomSnapshot(roomId);
  if (roomSnapshot) {
    await seedDurableRoom({ c, room: roomSnapshot, roomId });
  }

  try {
    const identity = await resolveLiveRoomIdentity(c, roomId);
    let selectedTrack: LiveRoomTrack | null = null;
    if (parsed.data.trackId) {
      if (!isDatabaseConfigured()) {
        return c.json(
          databaseUnavailableMessage,
          HttpStatusCodes.SERVICE_UNAVAILABLE
        );
      }

      const catalog = await buildLiveReviewCatalog({
          db: createDb(),
          session: c.get("session"),
          user,
        }),
        catalogTrack = catalog.find(
          (track) => track.id === parsed.data.trackId
        );
      if (!catalogTrack) {
        return c.json(
          forbiddenMessage("This track is not available for live review."),
          HttpStatusCodes.FORBIDDEN
        );
      }
      selectedTrack = {
        artistName: catalogTrack.artistName,
        coverArtUrl: catalogTrack.coverArtUrl ?? "",
        durationMs: 0,
        href: catalogTrack.isPublic
          ? `/tracks/${encodeURIComponent(catalogTrack.id)}`
          : null,
        id: catalogTrack.id,
        lyrics: [],
        status: "playing",
        title: catalogTrack.title,
      };
    }

    const room = await c.env.LIVE_ROOMS.getByName(roomId).setStreamNowPlaying(
      roomId,
      identity,
      selectedTrack
    );
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error ? error.message : "Now Playing update failed.",
      },
      HttpStatusCodes.FORBIDDEN
    );
  }
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
  let experience = isDatabaseConfigured()
    ? await loadLiveExperienceById(experienceId)
    : null;

  if (!experience && isDatabaseConfigured()) {
    const db = createDb(),
      [party] = await db
        .select({
          id: listeningParties.id,
          liveRoomId: listeningParties.liveRoomId,
        })
        .from(listeningParties)
        .where(
          or(
            eq(listeningParties.id, experienceId),
            eq(listeningParties.liveRoomId, experienceId)
          )
        )
        .limit(1);

    if (party) {
      try {
        experience = await ensureListeningPartyLiveExperience({
          env: c.env,
          roomId: experienceId,
        });
      } catch {
        return c.json(
          realtimeSetupRequired,
          HttpStatusCodes.SERVICE_UNAVAILABLE
        );
      }
    }
  }

  const kind = experience?.kind ?? liveKindFromExperienceId(experienceId);
  if (!experience && kind === "battle" && isDatabaseConfigured()) {
    const [battle] = await createDb()
      .select({ id: battles.id })
      .from(battles)
      .where(
        or(
          eq(battles.id, experienceId),
          eq(battles.externalBattleId, experienceId)
        )
      )
      .limit(1);
    return battle
      ? c.json(
          {
            message:
              "Battle media is not open yet. Join when the first turn starts.",
          },
          HttpStatusCodes.CONFLICT
        )
      : c.json({ message: "Battle not found." }, HttpStatusCodes.NOT_FOUND);
  }

  const meetingId = experience?.meetingId ?? experienceId;
  let activeArtistUserId: string | null = null,
    participantRole: LiveParticipantRole = parseResult.data.role,
    participantPhase = parseResult.data.phase;

  if (experience) {
    if (
      !(await hasLiveRoomAccess(c, experience.status === "live", experience.id))
    ) {
      return c.json(
        forbiddenMessage(
          "A Premium subscription is required to join live rooms."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (experience.kind === "party") {
      participantRole =
        experience.createdByUserId === user.id ? "host" : "listener";
    } else if (experience.battleId) {
      const [battle] = await createDb()
          .select({
            challengerArtistUserId: battles.challengerArtistUserId,
            format: battles.format,
            opponentArtistUserId: battles.opponentArtistUserId,
            status: battles.status,
          })
          .from(battles)
          .where(eq(battles.id, experience.battleId))
          .limit(1),
        battleRole = resolveBattleRoomRole({
          challengerArtistUserId: battle?.challengerArtistUserId,
          isAdmin: user.role === "admin",
          opponentArtistUserId: battle?.opponentArtistUserId,
          userId: user.id,
        });
      participantRole =
        battleRole === "artist_a" || battleRole === "artist_b"
          ? "artist"
          : (battleRole === "admin"
            ? "host"
            : "listener");
      if (participantRole === "artist") {
        const [lineup] = await createDb()
          .select({ format: battleLineupSnapshots.format })
          .from(battleLineupSnapshots)
          .where(
            and(
              eq(battleLineupSnapshots.artistUserId, user.id),
              eq(battleLineupSnapshots.battleId, experience.battleId)
            )
          )
          .limit(1);
        if (!lineup || lineup.format !== battle?.format) {
          return c.json(
            {
              message:
                "Lock a Battle Kit made for this battle format before entering the artist stage.",
            },
            HttpStatusCodes.CONFLICT
          );
        }
      }
      const battleRoom = await getDurableRoomState(c, experienceId).catch(
        () => null
      );
      if (
        battle?.status === "completed" ||
        battle?.status === "archived" ||
        battleRoom?.status === "ended" ||
        battleRoom?.battle?.coordination?.phase === "ended"
      ) {
        return c.json(
          {
            message:
              "This battle has ended. The result is available to view, but the room cannot be re-entered.",
          },
          HttpStatusCodes.CONFLICT
        );
      }
      activeArtistUserId =
        battleRoom?.battle?.coordination?.activeArtistUserId ?? null;
      const battlePhase = battleMediaPhase(
          battleRoom?.battle?.coordination?.phase
        ),
        isStageParticipant =
          participantRole === "artist" || participantRole === "host";
      if (
        isStageParticipant &&
        battlePhase !== "lobby" &&
        battlePhase !== "completed"
      ) {
        participantPhase = "round_active";
      } else if (isStageParticipant) {
        participantPhase = battlePhase;
      } else {
        participantPhase = "lobby";
      }
    } else if (experience.createdByUserId !== user.id) {
      participantRole = "viewer";
    }
  }

  let participant: RealtimeParticipantToken;

  try {
    participant = await createRealtimeParticipant({
      activeArtistUserId,
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
  const user = c.get("user"),
    isPlatformBot = Boolean(
      c.env.BATTLE_BOT_SECRET &&
      c.req.header("x-soundkit-battlebot-secret") === c.env.BATTLE_BOT_SECRET
    );
  if (!(isPlatformBot || isAuthenticatedUser(user))) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  if (!isPlatformBot && user?.role !== "admin") {
    return c.json(
      forbiddenMessage(
        "Only BattleBot or platform administrators can control battles."
      ),
      HttpStatusCodes.FORBIDDEN
    );
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
    botAction = parseResult.data.action as LiveRoomBattleBotAction,
    liveRooms = c.env.LIVE_ROOMS;

  if (isDatabaseConfigured()) {
    const db = createDb(),
      [battle] = await db
        .select({ status: battles.status })
        .from(battles)
        .where(
          or(
            eq(battles.id, battleId),
            eq(battles.externalBattleId, battleId),
            eq(battles.externalBattleId, experienceId)
          )
        )
        .limit(1);
    if (isBattleTerminalState({ status: battle?.status })) {
      return c.json(
        {
          message:
            "This battle has ended. BattleBot cannot reopen or change the room.",
        },
        HttpStatusCodes.CONFLICT
      );
    }
  }

  const roomState = liveRooms
      ? await retryDurableObjectCall(() =>
          liveRooms.getByName(experienceId).getState(experienceId)
        )
      : null,
    preflightRoom =
      liveRooms &&
      (botAction === "start_battle" || botAction === "move_lobby_to_round")
        ? await retryDurableObjectCall(() =>
            liveRooms
              .getByName(experienceId)
              .announceBattleBotAction(experienceId, botAction)
          )
        : null;
  if (
    roomState?.status === "ended" ||
    roomState?.battle?.coordination?.phase === "ended" ||
    preflightRoom?.status === "ended" ||
    preflightRoom?.battle?.coordination?.phase === "ended"
  ) {
    return c.json(
      {
        message:
          "This battle has ended. BattleBot cannot reopen or change the room.",
      },
      HttpStatusCodes.CONFLICT
    );
  }
  if (preflightRoom?.battle?.coordination?.phase === "waiting_room") {
    return c.json(
      {
        message: "BattleBot is waiting for both artists to be ready.",
      },
      HttpStatusCodes.CONFLICT
    );
  }

  const opensFirstTurn =
    (botAction === "move_lobby_to_round" || botAction === "start_battle") &&
    !experience &&
    preflightRoom?.battle?.coordination?.roundNumber === 1;
  if (opensFirstTurn) {
    try {
      if (
        !(await ensureBattleLiveExperience({
          env: c.env,
          experienceId,
        }))
      ) {
        return c.json(
          { message: "Battle not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }
    } catch {
      return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
    }
  }

  const result = await applyBattleBotAction({
    action: botAction,
    battleId,
    participants: parseResult.data.participants,
  });
  if (
    (botAction === "move_lobby_to_round" || botAction === "start_battle") &&
    !experience &&
    result.nextPhase === "round_active"
  ) {
    try {
      if (
        !(await ensureBattleLiveExperience({
          env: c.env,
          experienceId,
        }))
      ) {
        return c.json(
          { message: "Battle not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }
    } catch {
      return c.json(realtimeSetupRequired, HttpStatusCodes.SERVICE_UNAVAILABLE);
    }
  }
  if (result.battleEnded) {
    return c.json(
      {
        message:
          "This battle has ended. BattleBot cannot reopen or change the room.",
      },
      HttpStatusCodes.CONFLICT
    );
  }
  if (liveRooms && !preflightRoom) {
    await retryDurableObjectCall(() =>
      liveRooms
        .getByName(experienceId)
        .announceBattleBotAction(experienceId, botAction)
    );
  }

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

app.post("/rooms/:roomId/battle/ready", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parsed = battleReadyBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return c.json(
      badRequest("Battle readiness details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  try {
    const roomId = c.req.param("roomId"),
      identity = await resolveLiveRoomIdentity(c, roomId),
      initialExperience = await loadLiveExperienceById(roomId),
      battleId = initialExperience?.battleId ?? roomId;

    if (isDatabaseConfigured()) {
      const db = createDb(),
        [battle] = await db
          .select({ status: battles.status })
          .from(battles)
          .where(
            or(
              eq(battles.id, battleId),
              eq(battles.externalBattleId, battleId),
              eq(battles.externalBattleId, roomId)
            )
          )
          .limit(1);
      if (isBattleTerminalState({ status: battle?.status })) {
        return c.json(
          {
            message: "This battle has ended. The artist room is now read-only.",
          },
          HttpStatusCodes.CONFLICT
        );
      }
    }

    const room = await c.env.LIVE_ROOMS.getByName(roomId).setArtistReady(
      roomId,
      identity,
      parsed.data.ready
    );
    if (
      isDatabaseConfigured() &&
      room.battle?.coordination?.phase === "round_intro"
    ) {
      const experience =
          (await loadLiveExperienceById(roomId)) ??
          (await ensureBattleLiveExperience({
            env: c.env,
            experienceId: roomId,
          })),
        battleId = experience?.battleId ?? roomId,
        db = createDb(),
        [battle] = await db
          .select({ id: battles.id })
          .from(battles)
          .where(
            or(
              eq(battles.id, battleId),
              eq(battles.externalBattleId, battleId),
              eq(battles.externalBattleId, roomId)
            )
          )
          .limit(1);
      if (battle && experience) {
        const startedAt = new Date();
        await Promise.all([
          db
            .update(battles)
            .set({ status: "live", updatedAt: startedAt })
            .where(eq(battles.id, battle.id)),
          db
            .update(battleRounds)
            .set({ status: "active" })
            .where(
              and(
                eq(battleRounds.battleId, battle.id),
                eq(battleRounds.roundNumber, 1)
              )
            ),
          db
            .update(liveExperiences)
            .set({ status: "live", updatedAt: startedAt })
            .where(eq(liveExperiences.id, experience.id)),
        ]);
        if (c.env.BATTLE_DIRECTORY) {
          await c.env.BATTLE_DIRECTORY.getByName("public")
            .publish(battle.id)
            .catch(() => 0);
        }
      }
    }
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error ? error.message : "Battle readiness failed.",
      },
      HttpStatusCodes.CONFLICT
    );
  }
});

app.post("/rooms/:roomId/battle/disposition", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }

  const parsed = battleDispositionBodySchema.safeParse(
    await c.req.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return c.json(
      badRequest("Battle outcome details are invalid."),
      HttpStatusCodes.BAD_REQUEST
    );
  }

  const roomId = c.req.param("roomId"),
    liveRooms = c.env.LIVE_ROOMS,
    identity = await resolveLiveRoomIdentity(c, roomId),
    disposition = parsed.data as LiveRoomBattleDisposition,
    experience = await loadLiveExperienceById(roomId),
    battleId = experience?.battleId ?? roomId;

  if (isDatabaseConfigured()) {
    const db = createDb(),
      [battle] = await db
        .select({ status: battles.status })
        .from(battles)
        .where(
          or(
            eq(battles.id, battleId),
            eq(battles.externalBattleId, battleId),
            eq(battles.externalBattleId, roomId)
          )
        )
        .limit(1);
    if (isBattleTerminalState({ status: battle?.status })) {
      return c.json(
        {
          message: "This battle has ended and its result is already locked.",
        },
        HttpStatusCodes.CONFLICT
      );
    }
  }

  try {
    const audienceUserIds = await retryDurableObjectCall(() =>
        liveRooms.getByName(roomId).getBattleAudienceUserIds(roomId)
      ),
      room = await retryDurableObjectCall(() =>
        liveRooms
          .getByName(roomId)
          .resolveBattleDisposition(roomId, identity, disposition)
      );
    if (isDatabaseConfigured()) {
      const db = createDb(),
        [battle] = await db
          .select({
            id: battles.id,
            title: battles.title,
          })
          .from(battles)
          .where(
            or(
              eq(battles.id, battleId),
              eq(battles.externalBattleId, battleId),
              eq(battles.externalBattleId, roomId)
            )
          )
          .limit(1);
      if (battle) {
        await Promise.all([
          db
            .update(battles)
            .set({
              endedAt: new Date(),
              isRanked:
                (experience?.peakViewerCount ?? 0) >=
                BATTLE_RECORD_THRESHOLD_VIEWERS,
              outcome: disposition.kind,
              outcomeReason: disposition.reason,
              outcomeUserId: disposition.affectedUserId ?? null,
              status: "archived",
              updatedAt: new Date(),
            })
            .where(eq(battles.id, battle.id)),
          db
            .update(liveExperiences)
            .set({
              endsAt: new Date(),
              ingestStatus: "disconnected",
              status: "ended",
              updatedAt: new Date(),
            })
            .where(eq(liveExperiences.battleId, battle.id)),
          db
            .update(battleQueueEntries)
            .set({
              leftAt: new Date(),
              status: "removed",
              updatedAt: new Date(),
            })
            .where(eq(battleQueueEntries.battleId, battle.id)),
        ]);

        await recordBattleParticipationOutcome({
          affectedUserId: disposition.affectedUserId,
          battleId: battle.id,
          kind: disposition.kind,
          peakViewerCount: experience?.peakViewerCount ?? 0,
        });

        if (c.env.BATTLE_DIRECTORY) {
          await c.env.BATTLE_DIRECTORY.getByName("public")
            .publish(battle.id)
            .catch(() => 0);
        }

        const affectedArtistName =
            room.battle?.artists.find(
              (artist) => artist.id === disposition.affectedUserId
            )?.name ?? null,
          outcomeRecordedAt = room.battle?.outcome?.recordedAt ?? Date.now(),
          notificationRecipients = [
            ...(disposition.affectedUserId &&
            (disposition.kind === "ducked" || disposition.kind === "forfeited")
              ? [
                  {
                    audience: "artist" as const,
                    userId: disposition.affectedUserId,
                  },
                ]
              : []),
            ...audienceUserIds.map((userId) => ({
              audience: "viewer" as const,
              userId,
            })),
          ];

        await Promise.all(
          notificationRecipients.map(({ audience, userId }) =>
            notify(
              {
                actorUserId: null,
                data: {
                  affectedArtistName,
                  affectedUserId: disposition.affectedUserId ?? null,
                  audience,
                  battleId: battle.id,
                  battleTitle: battle.title,
                  kind: disposition.kind,
                  reason: disposition.reason,
                },
                entity: { id: battle.id, type: "battle" },
                eventId: `${battle.id}:outcome:${outcomeRecordedAt}:${audience}:${userId}`,
                recipientUserId: userId,
                type: "battle.outcome",
              },
              { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
            )
          )
        );
      }
    }
    return c.json(room, HttpStatusCodes.OK);
  } catch (error) {
    return c.json(
      {
        message:
          error instanceof Error ? error.message : "Battle outcome failed.",
      },
      HttpStatusCodes.CONFLICT
    );
  }
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
      .limit(1),
    [existingRound] = await db
      .select({ id: battleRounds.id })
      .from(battleRounds)
      .where(eq(battleRounds.battleId, battle?.id ?? battleId))
      .limit(1),
    canRepairLiveBattle = battle?.status === "live" && !existingRound;
  if (!battle || (battle.status !== "scheduled" && !canRepairLiveBattle)) {
    return c.json(
      {
        message:
          "Battle lineup can only be selected before the battle starts, or while repairing a live room without rounds.",
      },
      HttpStatusCodes.CONFLICT
    );
  }

  const roomState = await c.env.LIVE_ROOMS?.getByName(roomId)
    .getState(roomId)
    .catch(() => null);
  if (
    roomState?.status === "ended" ||
    roomState?.battle?.coordination?.phase === "ended"
  ) {
    return c.json(
      {
        message: "This battle has ended. The artist room is now read-only.",
      },
      HttpStatusCodes.CONFLICT
    );
  }

  const role = resolveBattleArtistRole({
    challengerArtistUserId: battle.challengerArtistUserId,
    opponentArtistUserId: battle.opponentArtistUserId,
    userId: user.id,
  });
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

  if (c.env.LIVE_ROOMS) {
    try {
      await c.env.LIVE_ROOMS.getByName(roomId).chooseBattleKit(
        roomId,
        user.id,
        kit.id,
        kitTracks.map((track) => track.trackId)
      );
    } catch {
      // The lineup snapshot remains authoritative if the room is not seeded yet.
    }
  }

  // Older battles may have been created before round rows were provisioned.
  // Rebuild the room snapshot here so the second artist's kit immediately
  // connects the public battle page to playable rounds.
  const refreshedRoom = await buildBattleRoomSnapshot(roomId);
  if (refreshedRoom) {
    await seedDurableRoom({ c, room: refreshedRoom, roomId });
  }

  return c.json(
    { battleId: battle.id, kitId: kit.id, role },
    HttpStatusCodes.OK
  );
});

const persistBattleTrackSelection = async ({
  battleId,
  db,
  role,
  trackId,
}: {
  battleId: string;
  db: ReturnType<typeof createDb>;
  role: "artist_a" | "artist_b";
  trackId: string;
}) => {
  const rounds = await db
      .select({
        id: battleRounds.id,
        status: battleRounds.status,
        trackOneId: battleRounds.trackOneId,
        trackTwoId: battleRounds.trackTwoId,
      })
      .from(battleRounds)
      .where(eq(battleRounds.battleId, battleId))
      .orderBy(asc(battleRounds.roundNumber)),
    targetRound =
      rounds.find((round) => round.status === "upcoming") ??
      rounds.find((round) => round.status === "active"),
    trackKey = role === "artist_a" ? "trackOneId" : "trackTwoId",
    sourceRound = rounds.find((round) => round[trackKey] === trackId),
    targetTrackId = targetRound?.[trackKey];

  if (!targetRound || targetTrackId === trackId) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(battleRounds)
      .set(
        role === "artist_a" ? { trackOneId: trackId } : { trackTwoId: trackId }
      )
      .where(eq(battleRounds.id, targetRound.id));

    if (sourceRound && sourceRound.id !== targetRound.id && targetTrackId) {
      await tx
        .update(battleRounds)
        .set(
          role === "artist_a"
            ? { trackOneId: targetTrackId }
            : { trackTwoId: targetTrackId }
        )
        .where(eq(battleRounds.id, sourceRound.id));
    }
  });
};

app.post("/rooms/:roomId/battle/track", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user) || !c.env.LIVE_ROOMS) {
    return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
  }
  const roomId = c.req.param("roomId"),
    body = (await c.req.json().catch(() => ({}))) as { trackId?: string },
    identity = await resolveLiveRoomIdentity(c, roomId);

  if (isDatabaseConfigured()) {
    const experience = await loadLiveExperienceById(roomId),
      battleId = experience?.battleId ?? roomId,
      db = createDb(),
      [battle] = await db
        .select({ status: battles.status })
        .from(battles)
        .where(
          or(
            eq(battles.id, battleId),
            eq(battles.externalBattleId, battleId),
            eq(battles.externalBattleId, roomId)
          )
        )
        .limit(1);
    if (isBattleTerminalState({ status: battle?.status })) {
      return c.json(
        {
          message: "This battle has ended. The artist room is now read-only.",
        },
        HttpStatusCodes.CONFLICT
      );
    }
  }

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
      ),
      experience = await loadLiveExperienceById(roomId),
      battleId = experience?.battleId ?? roomId;
    await persistBattleTrackSelection({
      battleId,
      db: createDb(),
      role: identity.role,
      trackId: body.trackId,
    });
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
    [rows, participatingRows] = await Promise.all([
      db
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
        .orderBy(asc(battles.startsAt)),
      db
        .select({
          battleId: battles.id,
          challengerArtistUserId: battles.challengerArtistUserId,
          opponentArtistUserId: battles.opponentArtistUserId,
          startsAt: battles.startsAt,
          status: battles.status,
          title: battles.title,
        })
        .from(battles)
        .where(
          and(
            eq(battles.status, "live"),
            or(
              eq(battles.challengerArtistUserId, user.id),
              eq(battles.opponentArtistUserId, user.id)
            )
          )
        )
        .orderBy(asc(battles.startsAt)),
    ]);

  return c.json(
    {
      battles: rows.map((row) => ({
        battleId: row.battleId,
        startsAt: row.startsAt ? row.startsAt.toISOString() : null,
        status: row.status,
        title: row.title,
      })),
      participatingBattles: participatingRows.map((row) => ({
        battleId: row.battleId,
        role:
          row.challengerArtistUserId === user.id
            ? ("artist_a" as const)
            : ("artist_b" as const),
        startsAt: row.startsAt ? row.startsAt.toISOString() : null,
        status: row.status,
        title: row.title,
      })),
    },
    HttpStatusCodes.OK
  );
});

app.get("/rooms/:roomId/overlay", async (c) => {
  if (!c.env.LIVE_ROOMS) {
    return c.json(
      { message: "Live room overlays are not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const token = c.req.query("token")?.trim(),
    experience = await loadLiveExperienceById(c.req.param("roomId"));
  if (!token) {
    return c.json(
      forbiddenMessage("A valid stream overlay token is required."),
      HttpStatusCodes.FORBIDDEN
    );
  }
  if (
    !experience ||
    experience.kind !== "stream" ||
    experience.status === "ended"
  ) {
    return c.json(
      { message: "Stream overlay is unavailable for this room." },
      HttpStatusCodes.NOT_FOUND
    );
  }

  const room = await c.env.LIVE_ROOMS.getByName(
    c.req.param("roomId")
  ).getStreamOverlayState(c.req.param("roomId"), token);
  if (!room) {
    return c.json(
      forbiddenMessage("The stream overlay token is invalid or expired."),
      HttpStatusCodes.FORBIDDEN
    );
  }

  c.header("Cache-Control", "private, no-store");
  return c.json(room, HttpStatusCodes.OK);
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
    if (!(await hasLiveRoomAccess(c, realRoom.status === "live", roomId))) {
      return c.json(
        forbiddenMessage(
          "A Premium subscription is required to watch live rooms."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const seedResponse = await seedDurableRoom({ c, room: realRoom, roomId });

    if (seedResponse) {
      const personalizedRoom = await getDurableRoomStateForUser(c, roomId);
      if (personalizedRoom) {
        return c.json(personalizedRoom, HttpStatusCodes.OK);
      }
    }

    return c.json(
      { ...realRoom, role: (await resolveLiveRoomIdentity(c, roomId)).role },
      HttpStatusCodes.OK
    );
  }

  if (isDatabaseConfigured()) {
    return c.json(
      { message: "Live room not found." },
      HttpStatusCodes.NOT_FOUND
    );
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
    overlayToken = c.req.query("token")?.trim();
  if (overlayToken) {
    const experience = await loadLiveExperienceById(roomId),
      overlayRoom =
        experience &&
        experience.kind === "stream" &&
        experience.status !== "ended" &&
        c.env.LIVE_ROOMS
          ? await c.env.LIVE_ROOMS.getByName(roomId).getStreamOverlayState(
              roomId,
              overlayToken
            )
          : null;
    if (!overlayRoom) {
      return c.json(
        forbiddenMessage("The stream overlay token is invalid or expired."),
        HttpStatusCodes.FORBIDDEN
      );
    }
  } else {
    const room = await getDurableRoomState(c, roomId);
    if (!(await hasLiveRoomAccess(c, room?.status === "live", roomId))) {
      return c.json(
        forbiddenMessage(
          "A Premium subscription is required to join live rooms."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }
  }

  const response = await durableWebSocketRequest(
    c,
    roomId,
    c.req.raw,
    overlayToken
  );

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
  if (!(await hasLiveRoomAccess(c, room?.status === "live", roomId))) {
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
  if (!(await hasLiveRoomAccess(c, room?.status === "live", roomId))) {
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
    identity = await resolveLiveRoomIdentity(c, roomId),
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

  if (identity.role === "artist_a" || identity.role === "artist_b") {
    return c.json(
      {
        message:
          "Battle artists enter through the authenticated artist room; they do not join the viewer queue.",
      },
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

  if (c.env.BATTLE_DIRECTORY) {
    await c.env.BATTLE_DIRECTORY.getByName("public")
      .publish(battle.id)
      .catch(() => 0);
  }

  const room = conflictBattleId
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
      if (c.env.BATTLE_DIRECTORY) {
        await c.env.BATTLE_DIRECTORY.getByName("public")
          .publish(battle.id)
          .catch(() => 0);
      }
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

  const endedAt = new Date();
  await createDb()
    .update(liveExperiences)
    .set({
      endsAt: endedAt,
      ingestStatus: "disconnected",
      reconnectUntil: null,
      status: "ended",
      updatedAt: endedAt,
    })
    .where(eq(liveExperiences.id, experience.id));

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
          const synchronizedExperience = await syncCloudflareStreamStatus({
              env: c.env,
              experience,
            }),
            status = resolveCloudflareStreamInputStatus({
              experienceStatus: synchronizedExperience.status,
              fallbackStatus: streamInput.status,
              ingestStatus: synchronizedExperience.ingestStatus,
            });

          return c.json({ ...streamInput, status }, HttpStatusCodes.OK);
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
