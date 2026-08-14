/* eslint-disable complexity */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  genres,
  openVerseListings,
  playbackSessions,
  projectTracks,
  purchases,
  qualifiedStreams,
  trackAssets,
  trackCollaborators,
  trackLicenseOptions,
  trackLyrics,
  trackPreSaves,
  trackStemJobs,
  tracks,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, desc, eq, gt, ne, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { createWorkflowJobRow } from "@/lib/audio-processing";
import type { TrackProcessingWorkflowPayload } from "@/lib/audio-processing";
import {
  resolveDownloadAccess,
  resolveListeningAccess,
} from "@/lib/content-access";
import {
  buildTrackDetail,
  buildTrackSummary,
  ownedTrackWhere,
} from "@/lib/dashboard-mappers";
import { notifyCollaboratorInviteEmail } from "@/lib/email-events";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import {
  createTrackPlaybackSession,
  recordPlaybackProgress,
} from "@/lib/playback-qualification";
import {
  genreSlugFromExploreFilter,
  regionSlugFromUser,
  stateFromExploreRegion,
} from "@/lib/public-explore";
import { withRetry } from "@/lib/retry";
import { sampleTracks } from "@/lib/sample-data";
import {
  createTrackAssetBodySchema,
  createTrackBodySchema,
  createLyricsRevisionBodySchema,
  createPlaybackSessionBodySchema,
  lyricsRevisionSchema,
  messageResponseSchema,
  playbackProgressBodySchema,
  playbackProgressResponseSchema,
  SINGLE_TRACK_PRICE_CENTS,
  SINGLE_TRACK_PRICE_USD,
  playbackSessionResponseSchema,
  reviewLyricsRevisionBodySchema,
  setupRequiredResponseSchema,
  settleTrackBodySchema,
  trackCatalogDetailSchema,
  trackDashboardDetailSchema,
  trackProcessingStatusSchema,
  trackSummarySchema,
  publicExploreQuerySchema,
  updateTrackBodySchema,
} from "@/lib/schemas";
import { createSellerAccountLink, isSellerEnabled } from "@/lib/seller";
import { notifyTrackLive } from "@/lib/track-notifications";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>();
const databaseUnavailableMessage = {
  message: "Database is not configured.",
};

const formatDuration = (durationMs: number | null) => {
  if (!durationMs) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatPrice = (priceCents: number | null) => {
  if (typeof priceCents !== "number") {
    return "";
  }

  return `$${(priceCents / 100).toFixed(2)}`;
};

const priceCentsFromTrack = ({
  price,
  priceCents,
}: {
  price: string | null;
  priceCents: number | null;
}) => {
  if (typeof priceCents === "number") {
    return priceCents;
  }

  if (!price) {
    return null;
  }

  return Math.round(Number(price) * 100);
};

const objectUrlFromMetadata = (metadata: unknown) => {
  if (!(metadata && typeof metadata === "object" && "url" in metadata)) {
    return null;
  }

  const { url } = metadata as { url?: unknown };

  return typeof url === "string" ? url : null;
};

const publicTrackAssetUrl = (
  asset: typeof trackAssets.$inferSelect | undefined
) => {
  if (!asset) {
    return null;
  }

  const metadataUrl = objectUrlFromMetadata(asset.metadata);

  if (metadataUrl) {
    return metadataUrl;
  }

  const baseUrl = (
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .MEDIA_PUBLIC_URL ??
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .VITE_MEDIA_URL ??
    ""
  ).replace(/\/+$/u, "");

  return baseUrl && asset.objectKey ? `${baseUrl}/${asset.objectKey}` : null;
};

const trackAssetFileName = (
  asset: typeof trackAssets.$inferSelect | undefined
) => {
  if (!asset) {
    return null;
  }

  const metadata = asset.metadata as Record<string, unknown> | null | undefined;
  const metadataFileName = metadata?.originalFileName;
  if (typeof metadataFileName === "string" && metadataFileName.trim()) {
    return metadataFileName;
  }

  if (asset.objectKey) {
    return asset.objectKey.split("/").pop() ?? null;
  }

  return null;
};

const quotedDownloadFileName = (fileName: string) =>
  fileName.replaceAll(/[\\"]/gu, "_");

const getMediaBucket = (bindings: AppEnv["Bindings"]) =>
  bindings.MEDIA_BUCKET ??
  (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ??
  null;

const hasPurchasedTrack = async ({
  db,
  trackId,
  userId,
}: {
  db: ReturnType<typeof createDb>;
  trackId: string;
  userId: string;
}) => {
  const [directPurchase] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(eq(purchases.buyerUserId, userId), eq(purchases.trackId, trackId))
    )
    .limit(1);

  if (directPurchase) {
    return true;
  }

  const [projectPurchase] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .innerJoin(projectTracks, eq(projectTracks.projectId, purchases.projectId))
    .where(
      and(eq(purchases.buyerUserId, userId), eq(projectTracks.trackId, trackId))
    )
    .limit(1);

  return Boolean(projectPurchase);
};

const hasPlayedTrackOnce = async ({
  db,
  trackId,
  userId,
}: {
  db: ReturnType<typeof createDb>;
  trackId: string;
  userId: string;
}) => {
  const [qualified] = await db
    .select({ id: qualifiedStreams.id })
    .from(qualifiedStreams)
    .where(
      and(
        eq(qualifiedStreams.userId, userId),
        eq(qualifiedStreams.trackId, trackId),
        eq(qualifiedStreams.status, "qualified")
      )
    )
    .limit(1);

  if (qualified) {
    return true;
  }

  const [endedSession] = await db
    .select({ id: playbackSessions.id })
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.userId, userId),
        eq(playbackSessions.trackId, trackId),
        eq(playbackSessions.status, "ended"),
        gt(playbackSessions.playedSeconds, 0)
      )
    )
    .limit(1);

  return Boolean(endedSession);
};

const assetKindLabels = {
  alternate_mix: "Alternate Mix",
  artwork: "Artwork",
  booklet: "Digital Booklet",
  clean: "Clean Version",
  cover_art: "Cover Artwork",
  instrumental: "Instrumental",
  license_pdf: "License Agreement",
  master: "High Quality Master",
  midi: "MIDI Files",
  stems: "Track Stems",
  tagged_mp3: "Tagged MP3",
  untagged_wav: "Untagged WAV",
} as const;

const catalogAssetKinds = new Set(Object.keys(assetKindLabels));

const trackPlayCount = sql<number>`(
  select count(*)::int
  from ${playbackSessions}
  where ${playbackSessions.trackId} = ${tracks.id}
)`;

const publicTrackOrderBy = (sort?: string) => {
  if (sort === "title-asc") {
    return asc(tracks.title);
  }

  if (sort === "title-desc") {
    return desc(tracks.title);
  }

  if (sort === "date-asc") {
    return asc(tracks.updatedAt);
  }

  if (sort === "date-desc") {
    return desc(tracks.updatedAt);
  }

  if (sort === "plays-asc") {
    return asc(trackPlayCount);
  }

  return desc(trackPlayCount);
};

const getTrackProcessingWorkflow = () =>
  (
    env as unknown as {
      TRACK_PROCESSING_WORKFLOW?: Workflow<TrackProcessingWorkflowPayload>;
    }
  ).TRACK_PROCESSING_WORKFLOW ?? null;

const isLiveRelease = ({
  isPublic,
  releaseAt,
  releaseStrategy,
}: {
  isPublic: boolean;
  releaseAt: Date | null;
  releaseStrategy: "private" | "publish_when_ready" | "scheduled";
}) =>
  isPublic &&
  releaseStrategy !== "private" &&
  (!releaseAt || releaseAt.getTime() <= Date.now());

const queueTrackAudioProcessing = async ({
  masterAsset,
  trackId,
}: {
  masterAsset: typeof trackAssets.$inferSelect;
  trackId: string;
}) => {
  const db = createDb();
  const [existingJob] = await withRetry("find existing stem job", () =>
    db
      .select()
      .from(trackStemJobs)
      .where(eq(trackStemJobs.inputAssetId, masterAsset.id))
      .limit(1)
  );

  const [job] =
    existingJob?.status === "queued" || existingJob?.status === "processing"
      ? [existingJob]
      : await withRetry("create stem job", () =>
          db
            .insert(trackStemJobs)
            .values({
              id: crypto.randomUUID(),
              inputAssetId: masterAsset.id,
              outputFormat: "MP3",
              outputType: "BOTH",
              status: "queued" as const,
              trackId,
            })
            .returning()
        );

  if (job && !job.workflowInstanceId) {
    await withRetry("mark lyrics generating", () =>
      db
        .update(tracks)
        .set({
          lyricsStatus: "generating",
          updatedAt: new Date(),
        })
        .where(eq(tracks.id, trackId))
    );

    await withRetry("create workflow job row", () =>
      createWorkflowJobRow({
        input: {
          assetId: masterAsset.id,
          objectKey: masterAsset.objectKey,
          trackId,
        },
        jobType: "track_audio_processing",
        targetId: trackId,
        targetType: "track",
      })
    );

    const workflow = getTrackProcessingWorkflow();

    if (workflow && masterAsset.objectKey) {
      const instance = await workflow.create({
        id: job.id,
        params: {
          assetId: masterAsset.id,
          objectKey: masterAsset.objectKey,
          trackId,
        },
        retention: {
          errorRetention: "7 days",
          successRetention: "7 days",
        },
      });

      await withRetry("save workflow instance id", () =>
        db
          .update(trackStemJobs)
          .set({
            workflowInstanceId: instance.id,
          })
          .where(eq(trackStemJobs.id, job.id))
      );
    }
  }

  return {
    jobId: job?.id ?? null,
    message:
      masterAsset.objectKey && getTrackProcessingWorkflow()
        ? "Track processing workflow started."
        : "Track processing queued. Configure TRACK_PROCESSING_WORKFLOW, STEMSPLIT_API_KEY, MEDIA_PUBLIC_URL, MEDIA_BUCKET, and OPENAI_API_KEY to run it.",
    status: "queued" as const,
  };
};

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: publicExploreQuerySchema.partial() },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Tracks list"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const query = c.req.valid("query");
    const user = c.get("user");
    const isPublicScope = query.scope === "public";

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (isPublicScope || !isAuthenticatedUser(user)) {
      const db = createDb();
      const genreSlug = genreSlugFromExploreFilter(query.genre);
      const state = stateFromExploreRegion(query);
      const publicTrackConditions = [
        eq(tracks.isPublic, true),
        eq(tracks.productionStatus, "complete"),
      ];

      if (query.forSale) {
        publicTrackConditions.push(eq(tracks.isForSale, true));
      }

      if (genreSlug) {
        publicTrackConditions.push(eq(genres.slug, genreSlug));
      }

      if (state) {
        publicTrackConditions.push(
          sql`lower(${userProfiles.state}) in (${state.name.toLowerCase()}, ${state.abbreviation.toLowerCase()})`
        );
      }

      const order = publicTrackOrderBy(query.sort);
      const rows = await withRetry("list public tracks", () =>
        db
          .select({
            playCount: trackPlayCount,
            state: userProfiles.state,
            track: tracks,
          })
          .from(tracks)
          .leftJoin(genres, eq(genres.id, tracks.genreId))
          .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
          .where(and(...publicTrackConditions))
          .orderBy(order)
          .limit(query.limit ?? 24)
      );
      const summaries = [];

      for (const row of rows) {
        summaries.push({
          ...(await buildTrackSummary(row.track)),
          plays: row.playCount ?? 0,
          regionSlug: regionSlugFromUser(row.state) ?? null,
        });
      }

      return c.json(summaries, HttpStatusCodes.OK);
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const rows = await withRetry("list dashboard tracks", () =>
      db
        .select()
        .from(tracks)
        .where(
          organizationId
            ? eq(tracks.organizationId, organizationId)
            : eq(tracks.ownerUserId, user.id)
        )
        .orderBy(desc(tracks.updatedAt))
        .limit(100)
    );
    const summaries = [];

    for (const row of rows) {
      summaries.push(await buildTrackSummary(row));
    }

    return c.json(summaries, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/playback-sessions",
    request: {
      body: jsonContentRequired(
        createPlaybackSessionBodySchema,
        "Playback session payload"
      ),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        playbackSessionResponseSchema,
        "Playback session"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium access or a purchase is required"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Database unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
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

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [trackPolicy] = await db
      .select({
        exclusiveUntil: tracks.exclusiveUntil,
        isForSale: tracks.isForSale,
        listeningAccess: tracks.listeningAccess,
      })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);

    if (!trackPolicy) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const hasPurchase = await hasPurchasedTrack({
      db,
      trackId,
      userId: user.id,
    });
    const access = resolveListeningAccess({
      hasPurchase,
      isPremium: entitlements.isPremium,
      policy: trackPolicy,
    });

    if (!access.canListen) {
      return c.json(
        { message: "Premium access or a purchase is required to listen." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    try {
      const playbackSession = await createTrackPlaybackSession({
        db,
        input: {
          city: body.city,
          clientType: body.clientType,
          clientVersion: body.clientVersion,
          countryCode: body.countryCode,
          entitlementSnapshot: {
            activePlanCode: entitlements.activePlanCode,
            isPremium: entitlements.isPremium,
            status: entitlements.status,
          },
          listenerUserId: user.id,
          regionCode: body.regionCode,
          sourceId: body.sourceId,
          sourceType: body.sourceType,
          trackId,
        },
      });

      if (!playbackSession) {
        return c.json(
          {
            canQualify: false,
            durationSeconds: null,
            id: crypto.randomUUID(),
          },
          HttpStatusCodes.CREATED
        );
      }

      return c.json(playbackSession, HttpStatusCodes.CREATED);
    } catch {
      return c.json(
        {
          canQualify: false,
          durationSeconds: null,
          id: crypto.randomUUID(),
        },
        HttpStatusCodes.CREATED
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/playback-sessions/{sessionId}/progress",
    request: {
      body: jsonContentRequired(
        playbackProgressBodySchema,
        "Playback progress payload"
      ),
      params: z.object({
        sessionId: z.string(),
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        playbackProgressResponseSchema,
        "Playback progress result"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Database unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
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

    const { sessionId, trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await recordPlaybackProgress({
      db: createDb(),
      input: {
        durationSeconds: body.durationSeconds,
        ended: body.ended,
        isMuted: body.isMuted,
        listenerUserId: user.id,
        playedSeconds: body.playedSeconds,
        sessionId,
        trackId,
      },
    });

    return c.json(
      {
        qualifiedStreamId:
          "qualifiedStreamId" in result
            ? (result.qualifiedStreamId ?? null)
            : null,
        result: result.result,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/playback-sessions/{sessionId}/end",
    request: {
      body: jsonContentRequired(
        playbackProgressBodySchema.partial(),
        "Playback end payload"
      ),
      params: z.object({
        sessionId: z.string(),
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        playbackProgressResponseSchema,
        "Playback end result"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Database unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
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

    const { sessionId, trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await recordPlaybackProgress({
      db: createDb(),
      input: {
        durationSeconds: body.durationSeconds,
        ended: true,
        isMuted: body.isMuted,
        listenerUserId: user.id,
        playedSeconds: body.playedSeconds ?? 0,
        sessionId,
        trackId,
      },
    });

    return c.json(
      {
        qualifiedStreamId:
          "qualifiedStreamId" in result
            ? (result.qualifiedStreamId ?? null)
            : null,
        result: result.result,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}/lyrics",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        lyricsRevisionSchema.nullable(),
        "Approved lyrics revision"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { trackId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(null, HttpStatusCodes.OK);
    }

    const db = createDb();
    const [revision] = await db
      .select({
        approvedAt: trackLyrics.approvedAt,
        id: trackLyrics.id,
        language: trackLyrics.language,
        sourceType: trackLyrics.sourceType,
        status: trackLyrics.status,
        text: trackLyrics.text,
        timedLines: trackLyrics.timedLines,
        trackId: trackLyrics.trackId,
      })
      .from(trackLyrics)
      .innerJoin(tracks, eq(tracks.id, trackLyrics.trackId))
      .where(
        and(
          eq(trackLyrics.trackId, trackId),
          eq(trackLyrics.status, "approved"),
          eq(tracks.isPublic, true)
        )
      )
      .limit(1);

    if (!revision) {
      return c.json(null, HttpStatusCodes.OK);
    }

    return c.json(
      {
        ...revision,
        approvedAt: revision.approvedAt?.toISOString() ?? null,
        timedLines: revision.timedLines ?? null,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/lyrics/suggestions",
    request: {
      body: jsonContentRequired(
        createLyricsRevisionBodySchema,
        "Fan lyrics suggestion payload"
      ),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        lyricsRevisionSchema,
        "Fan lyrics suggestion submitted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Database is not configured." }, 404);
    }

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = createDb();
    const [track] = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(eq(tracks.id, trackId), eq(tracks.isPublic, true)))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [revision] = await db
      .insert(trackLyrics)
      .values({
        contributorUserId: user.id,
        id: crypto.randomUUID(),
        language: body.language,
        sourceType: "fan_submission",
        status: "pending_review",
        text: body.text,
        timedLines: body.timedLines ?? null,
        trackId,
      })
      .returning();

    if (!revision) {
      throw new Error("Failed to submit lyrics suggestion.");
    }

    return c.json(
      {
        approvedAt: null,
        id: revision.id,
        language: revision.language,
        sourceType: revision.sourceType,
        status: revision.status,
        text: revision.text,
        timedLines: revision.timedLines ?? null,
        trackId: revision.trackId,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createTrackBodySchema, "Track create payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        trackSummarySchema,
        "Track created"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        setupRequiredResponseSchema,
        "Seller onboarding required"
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        messageResponseSchema,
        "Internal server error"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const body = c.req.valid("json");
    const session = c.get("session");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          artistName: "Current Artist",
          bpm: body.bpm ?? null,
          catalogItemType: body.catalogItemType,
          collaboratorCount: 0,
          coverArtUrl: null,
          downloadsAllowed: body.downloadsAllowed,
          downloadsRequireFirstPlay: body.downloadsRequireFirstPlay,
          downloadsRequirePurchase: body.downloadsRequirePurchase,
          duration: "0:00",
          fileAvailability: {
            adlibs: false,
            coverArt: false,
            instrumental: false,
            master: false,
            reference: false,
            session: false,
            vocals: 0,
          },
          genre: body.genre,
          id: "track_new",
          isForSale: body.isForSale,
          isPublic: body.isPublic,
          isrc: body.isrc ?? null,
          lyricsStatus: "missing" as const,
          musicalKey: body.musicalKey ?? null,
          organizationId: null,
          playbackUrl: null,
          plays: 0,
          price: body.price ?? null,
          priceCents: body.priceCents ?? null,
          productionStatus: body.productionStatus,
          purchaseMode: body.purchaseMode,
          releaseAt: body.releaseAt ?? null,
          releaseStrategy: body.releaseStrategy,
          slug: body.title.toLowerCase().replaceAll(" ", "-"),
          streamingLinks: body.streamingLinks ?? {},
          title: body.title,
          updatedAt: new Date().toISOString(),
        },
        HttpStatusCodes.CREATED
      );
    }

    try {
      const db = createDb();
      const organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });
      const [profile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

      if (profile?.accountType !== "artist") {
        return c.json(
          {
            code: "setup_required" as const,
            message: "Convert to an artist account before creating tracks.",
          },
          HttpStatusCodes.FORBIDDEN
        );
      }

      if (body.isForSale) {
        const sellerEnabled = await isSellerEnabled({
          organizationId,
          userId: user.id,
        });

        if (!sellerEnabled) {
          const accountLink = await createSellerAccountLink({
            organizationId,
            refreshUrl: new URL(
              "/dashboard/settings/payouts",
              c.req.url
            ).toString(),
            returnUrl: new URL("/dashboard", c.req.url).toString(),
            user,
          });

          return c.json(
            {
              code: "setup_required" as const,
              message:
                accountLink.accountLinkUrl ??
                "Stripe Connect onboarding is required before publishing tracks for sale.",
            },
            HttpStatusCodes.FORBIDDEN
          );
        }
      }

      if (body.sourceObjectKey) {
        const [existingTrack] = await withRetry(
          "find track by source object",
          () =>
            db
              .select({ track: tracks })
              .from(trackAssets)
              .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
              .where(
                and(
                  eq(trackAssets.objectKey, body.sourceObjectKey ?? ""),
                  eq(tracks.ownerUserId, user.id)
                )
              )
              .limit(1)
        );

        if (existingTrack) {
          return c.json(
            await buildTrackSummary(existingTrack.track),
            HttpStatusCodes.CREATED
          );
        }
      }

      const genreSlug = canonicalGenreSlug(body.genre);
      const [genreRow] = await withRetry("find track genre", () =>
        db
          .select({ id: genres.id })
          .from(genres)
          .where(eq(genres.slug, genreSlug))
          .limit(1)
      );
      const genreId = genreRow?.id ?? crypto.randomUUID();

      if (!genreRow) {
        await withRetry("create track genre", () =>
          db.insert(genres).values({
            id: genreId,
            name: canonicalGenreName(body.genre),
            slug: genreSlug,
          })
        );
      }

      const trackId = crypto.randomUUID();
      const now = new Date();
      const isSingle = body.catalogItemType === "single";
      const rawPriceNum =
        typeof body.price === "number"
          ? body.price
          : (body.price
            ? Number(body.price)
            : null);
      const salePriceUsd =
        body.isForSale && isSingle
          ? SINGLE_TRACK_PRICE_USD
          : (rawPriceNum !== null && !isNaN(rawPriceNum)
            ? rawPriceNum
            : null);
      const salePriceCents =
        body.isForSale && isSingle
          ? SINGLE_TRACK_PRICE_CENTS
          : (body.priceCents ??
            (salePriceUsd === null ? null : Math.round(salePriceUsd * 100)));
      const [track] = await withRetry("create track", () =>
        db
          .insert(tracks)
          .values({
            bpm: body.bpm ?? null,
            catalogItemType: body.catalogItemType,
            createdAt: now,
            description: body.description ?? null,
            downloadsAllowed: body.downloadsAllowed,
            downloadsRequireFirstPlay: body.downloadsRequireFirstPlay,
            downloadsRequirePurchase: body.downloadsRequirePurchase,
            exclusiveUntil: body.exclusiveUntil
              ? new Date(body.exclusiveUntil)
              : null,
            genreId,
            id: trackId,
            isForSale: body.isForSale,
            isPublic: body.isPublic,
            isrc: body.isrc ?? null,
            listeningAccess: body.listeningAccess,
            musicalKey: body.musicalKey ?? null,
            organizationId,
            ownerUserId: user.id,
            price:
              typeof salePriceUsd === "number" ? salePriceUsd.toFixed(2) : null,
            priceCents: salePriceCents,
            productionStatus: body.productionStatus,
            publishedAt: body.isPublic ? now : null,
            purchaseMode: body.purchaseMode,
            releaseAt: body.releaseAt ? new Date(body.releaseAt) : null,
            releaseStrategy: body.releaseStrategy,
            slug: uniqueSlug(body.title),
            title: body.title,
            updatedAt: now,
          })
          .returning()
      );

      if (body.assetIds.length > 0) {
        await withRetry("attach existing track asset", () =>
          db
            .update(trackAssets)
            .set({
              trackId,
              updatedAt: now,
              uploaderUserId: user.id,
            })
            .where(eq(trackAssets.id, body.assetIds[0] ?? ""))
        );
      }

      if (body.collaborators.length > 0) {
        const collaboratorRows = body.collaborators.map((collaborator) => ({
          canDelete: false,
          canEdit: true,
          canUpload: true,
          collaboratorRole: collaborator.role,
          collaboratorUserId: collaborator.userId ?? null,
          createdAt: now,
          id: crypto.randomUUID(),
          invitationStatus: collaborator.userId
            ? ("accepted" as const)
            : ("pending" as const),
          inviteEmail: collaborator.inviteEmail ?? null,
          invitedByUserId: user.id,
          trackId,
        }));

        await withRetry("insert track collaborators", () =>
          db.insert(trackCollaborators).values(collaboratorRows)
        );

        for (const collaborator of collaboratorRows) {
          if (collaborator.collaboratorUserId) {
            await db
              .insert(userNotifications)
              .values({
                id: `track_collaborator:${collaborator.id}`,
                link: `/dashboard/tracks/${trackId}`,
                message: `${user.name ?? "Someone"} added you as a collaborator on ${body.title}.`,
                title: "New Collaboration",
                type: "collaborator_invite",
                userId: collaborator.collaboratorUserId,
              })
              .onConflictDoNothing();
          }

          if (collaborator.inviteEmail) {
            await notifyCollaboratorInviteEmail({
              actionPath: `/dashboard/tracks/${trackId}`,
              inviteEmail: collaborator.inviteEmail,
              inviteId: collaborator.id,
              inviterName: user.name ?? "Someone",
              queue: c.env.EMAIL_DELIVERY_QUEUE,
              workTitle: body.title,
              workType: "track",
            });
          }
        }
      }

      if (!track) {
        throw new Error("Failed to create track.");
      }

      return c.json(await buildTrackSummary(track), HttpStatusCodes.CREATED);
    } catch (error: unknown) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        message: "POST /v1/tracks error",
        userId: user.id,
      });
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Failed to create track record.",
        },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{trackId}",
    request: {
      body: jsonContentRequired(updateTrackBodySchema, "Track update payload"),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackDashboardDetailSchema,
        "Track updated"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();

    let updatedGenreId: string | undefined;
    if (body.genre) {
      const genreSlug = canonicalGenreSlug(body.genre);
      const [genreRow] = await db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, genreSlug));
      if (genreRow) {
        updatedGenreId = genreRow.id;
      } else {
        updatedGenreId = crypto.randomUUID();
        await db.insert(genres).values({
          id: updatedGenreId,
          name: canonicalGenreName(body.genre),
          slug: genreSlug,
        });
      }
    }

    let exclusiveUntil: Date | null | undefined;
    if (body.exclusiveUntil === "") {
      exclusiveUntil = null;
    } else if (body.exclusiveUntil) {
      exclusiveUntil = new Date(body.exclusiveUntil);
    }

    const [track] = await db
      .update(tracks)
      .set({
        bpm: body.bpm,
        description: body.description,
        downloadsAllowed: body.downloadsAllowed,
        downloadsRequireFirstPlay: body.downloadsRequireFirstPlay,
        downloadsRequirePurchase: body.downloadsRequirePurchase,
        exclusiveUntil,
        genreId: updatedGenreId,
        isForSale: body.isForSale,
        isPublic: body.isPublic,
        isrc: body.isrc,
        listeningAccess: body.listeningAccess,
        musicalKey: body.musicalKey,
        price: body.price?.toFixed(2),
        priceCents: body.priceCents,
        productionStatus: body.productionStatus,
        purchaseMode: body.purchaseMode,
        releaseAt: body.releaseAt ? new Date(body.releaseAt) : undefined,
        releaseStrategy: body.releaseStrategy,
        title: body.title,
        updatedAt: new Date(),
      })
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .returning();

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    if (body.isOpenVerse !== undefined) {
      if (body.isOpenVerse) {
        const [existingListing] = await db
          .select({ id: openVerseListings.id })
          .from(openVerseListings)
          .where(eq(openVerseListings.trackId, trackId))
          .limit(1);

        if (existingListing) {
          await db
            .update(openVerseListings)
            .set({ status: "open", updatedAt: new Date() })
            .where(eq(openVerseListings.id, existingListing.id));
        } else {
          await db.insert(openVerseListings).values({
            bpm: track.bpm,
            description:
              track.description ?? `Open verse slot for ${track.title}`,
            genreId: track.genreId,
            id: crypto.randomUUID(),
            maxSubmissions: 50,
            musicalKey: track.musicalKey,
            organizationId,
            ownerUserId: user.id,
            status: "open",
            title: `${track.title} - open verse`,
            trackId: track.id,
          });
        }
      } else {
        await db
          .update(openVerseListings)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(openVerseListings.trackId, trackId));
      }
    }

    return c.json(await buildTrackDetail(track), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageResponseSchema, "Track deleted"),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Track deleted." }, HttpStatusCodes.OK);
    }

    const { trackId } = c.req.valid("param");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();

    await db
      .delete(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }));

    return c.json({ message: "Track deleted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/assets",
    request: {
      body: jsonContentRequired(
        createTrackAssetBodySchema,
        "Track asset payload"
      ),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        trackDashboardDetailSchema,
        "Track asset saved"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      const [sampleTrack] = sampleTracks;

      if (!sampleTrack) {
        throw new Error("Sample track fallback is missing.");
      }

      return c.json(
        {
          ...sampleTrack,
          assets: [],
          collaborators: [],
          createdAt: new Date().toISOString(),
          description: null,
          lyrics: null,
        },
        HttpStatusCodes.CREATED
      );
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [track] = await db
      .select()
      .from(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [existingAsset] = await withRetry("find existing track asset", () =>
      db
        .select({ id: trackAssets.id })
        .from(trackAssets)
        .where(
          and(
            eq(trackAssets.trackId, trackId),
            eq(trackAssets.objectKey, body.objectKey)
          )
        )
        .limit(1)
    );

    if (existingAsset) {
      return c.json(await buildTrackDetail(track), HttpStatusCodes.CREATED);
    }

    // A track should have a single cover art and a single master; replace any
    // prior rows of the same kind instead of accumulating duplicates.
    if (body.assetKind === "cover_art" || body.assetKind === "master") {
      await withRetry("replace track asset kind", () =>
        db
          .delete(trackAssets)
          .where(
            and(
              eq(trackAssets.trackId, trackId),
              eq(trackAssets.assetKind, body.assetKind)
            )
          )
      );
    }

    await withRetry("create track asset", () =>
      db.insert(trackAssets).values({
        assetKind: body.assetKind,
        bucketName: body.bucketName ?? null,
        durationMs: body.durationMs ?? null,
        id: crypto.randomUUID(),
        metadata: body.metadata,
        mimeType: body.mimeType ?? null,
        objectKey: body.objectKey,
        sizeBytes: body.sizeBytes ?? null,
        status: body.status,
        storageProvider: body.storageProvider,
        trackId,
        uploaderUserId: user.id,
      })
    );

    return c.json(await buildTrackDetail(track), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/settle",
    request: {
      body: jsonContentRequired(
        settleTrackBodySchema,
        "Track settlement payload"
      ),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackDashboardDetailSchema,
        "Track settled"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Required assets missing"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is required before settling track media." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [track] = await db
      .select()
      .from(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const assetRows = await db
      .select()
      .from(trackAssets)
      .where(eq(trackAssets.trackId, trackId));
    const masterAsset = assetRows.find(
      (asset) =>
        asset.assetKind === "master" &&
        Boolean(asset.objectKey) &&
        (asset.status === "ready" || asset.status === "uploaded")
    );
    const coverAsset = assetRows.find(
      (asset) => asset.assetKind === "cover_art" && Boolean(asset.objectKey)
    );

    if (!masterAsset) {
      return c.json(
        {
          message:
            "Master audio must finish uploading before this track can be settled.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (body.requireCoverArt && !coverAsset) {
      return c.json(
        {
          message:
            "Cover art must finish uploading before this track can go live.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await withRetry("mark master asset ready", () =>
      db
        .update(trackAssets)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(trackAssets.id, masterAsset.id))
    );

    const releaseAt = body.releaseAt ? new Date(body.releaseAt) : null;
    const shouldPublish = body.isPublic;
    const [settledTrack] = await withRetry("settle track", () =>
      db
        .update(tracks)
        .set({
          isPublic: shouldPublish,
          productionStatus: body.productionStatus,
          publishedAt: shouldPublish ? (track.publishedAt ?? new Date()) : null,
          releaseAt,
          releaseStrategy: body.releaseStrategy,
          updatedAt: new Date(),
        })
        .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
        .returning()
    );

    if (!settledTrack) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    if (
      isLiveRelease({
        isPublic: shouldPublish,
        releaseAt,
        releaseStrategy: body.releaseStrategy,
      })
    ) {
      const bindings = c.env as AppEnv["Bindings"];
      await notifyTrackLive({
        emailQueue: bindings.EMAIL_DELIVERY_QUEUE,
        trackId,
      });
    }

    if (entitlements.isPremium) {
      await queueTrackAudioProcessing({
        masterAsset: { ...masterAsset, status: "ready" },
        trackId,
      });
    }

    return c.json(await buildTrackDetail(settledTrack), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/process",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.ACCEPTED]: jsonContent(
        trackProcessingStatusSchema,
        "Track processing queued"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium subscription required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          jobId: null,
          message: "Database is required before queueing track processing.",
          status: "failed" as const,
        },
        HttpStatusCodes.ACCEPTED
      );
    }

    const { trackId } = c.req.valid("param");
    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    if (!entitlements.isPremium) {
      return c.json(
        {
          message:
            "A premium artist subscription is required for automated StemSplit and transcription processing.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [track] = await db
      .select()
      .from(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [masterAsset] = await db
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.assetKind, "master")
        )
      )
      .limit(1);

    if (!masterAsset) {
      return c.json(
        { message: "Upload a master audio asset before processing stems." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const processing = await queueTrackAudioProcessing({
      masterAsset,
      trackId,
    });

    return c.json(processing, HttpStatusCodes.ACCEPTED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/lyrics",
    request: {
      body: jsonContentRequired(
        createLyricsRevisionBodySchema,
        "Lyrics revision payload"
      ),
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        lyricsRevisionSchema,
        "Lyrics revision submitted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Database is not configured." }, 404);
    }

    const { trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [track] = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [revision] = await db
      .insert(trackLyrics)
      .values({
        contributorUserId: user.id,
        id: crypto.randomUUID(),
        language: body.language,
        sourceType: "artist",
        status: "pending_review",
        text: body.text,
        timedLines: body.timedLines ?? null,
        trackId,
      })
      .returning();

    await db
      .update(tracks)
      .set({ lyricsStatus: "pending_review", updatedAt: new Date() })
      .where(and(eq(tracks.id, trackId), ne(tracks.lyricsStatus, "approved")));

    if (!revision) {
      throw new Error("Failed to submit lyrics revision.");
    }

    return c.json(
      {
        approvedAt: null,
        id: revision.id,
        language: revision.language,
        sourceType: revision.sourceType,
        status: revision.status,
        text: revision.text,
        timedLines: revision.timedLines ?? null,
        trackId: revision.trackId,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{trackId}/lyrics/{lyricsId}",
    request: {
      body: jsonContentRequired(
        reviewLyricsRevisionBodySchema,
        "Lyrics review payload"
      ),
      params: z.object({
        lyricsId: z.string(),
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Synchronized lyrics required"
      ),
      [HttpStatusCodes.OK]: jsonContent(
        lyricsRevisionSchema,
        "Lyrics revision reviewed"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Lyrics revision not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Database is not configured." }, 404);
    }

    const { lyricsId, trackId } = c.req.valid("param");
    const body = c.req.valid("json");
    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const db = createDb();
    const [track] = await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [existing] = await db
      .select()
      .from(trackLyrics)
      .where(
        and(eq(trackLyrics.id, lyricsId), eq(trackLyrics.trackId, trackId))
      )
      .limit(1);

    if (!existing) {
      return c.json(
        { message: "Lyrics revision not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (
      body.status === "approved" &&
      (!existing.timedLines || existing.timedLines.length === 0)
    ) {
      return c.json(
        { message: "Approved lyrics must include synchronized lines." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const approvedAt = body.status === "approved" ? new Date() : null;

    if (body.status === "approved") {
      await db
        .update(trackLyrics)
        .set({
          approvedAt: null,
          approvedByUserId: null,
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(trackLyrics.trackId, trackId),
            eq(trackLyrics.status, "approved")
          )
        );
    }

    const [revision] = await db
      .update(trackLyrics)
      .set({
        approvedAt,
        approvedByUserId: body.status === "approved" ? user.id : null,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(trackLyrics.id, lyricsId))
      .returning();

    const [remainingApproved] =
      body.status === "approved"
        ? [revision]
        : await db
            .select({ id: trackLyrics.id })
            .from(trackLyrics)
            .where(
              and(
                eq(trackLyrics.trackId, trackId),
                eq(trackLyrics.status, "approved")
              )
            )
            .limit(1);
    const nextLyricsStatus = remainingApproved ? "approved" : "missing";

    await db
      .update(tracks)
      .set({
        lyricsStatus: nextLyricsStatus,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId));

    if (!revision) {
      throw new Error("Failed to review lyrics revision.");
    }

    return c.json(
      {
        approvedAt: revision.approvedAt?.toISOString() ?? null,
        id: revision.id,
        language: revision.language,
        sourceType: revision.sourceType,
        status: revision.status,
        text: revision.text,
        timedLines: revision.timedLines ?? null,
        trackId: revision.trackId,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}/assets/{assetId}/download",
    request: {
      params: z.object({
        assetId: z.string(),
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary" }),
          },
        },
        description: "Authorized track asset download",
      },
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Download not allowed"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track asset not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Download storage unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
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

    const bucket = getMediaBucket(c.env as AppEnv["Bindings"]);

    if (!bucket) {
      return c.json(
        { message: "Download storage is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const { assetId, trackId } = c.req.valid("param");
    const db = createDb();
    const [row] = await db
      .select({
        asset: trackAssets,
        track: {
          downloadsAllowed: tracks.downloadsAllowed,
          downloadsRequireFirstPlay: tracks.downloadsRequireFirstPlay,
          downloadsRequirePurchase: tracks.downloadsRequirePurchase,
          id: tracks.id,
          isForSale: tracks.isForSale,
          ownerUserId: tracks.ownerUserId,
          title: tracks.title,
        },
      })
      .from(trackAssets)
      .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
      .where(and(eq(trackAssets.id, assetId), eq(tracks.id, trackId)))
      .limit(1);

    if (!(row?.asset.objectKey && row.asset.status === "ready")) {
      return c.json(
        { message: "Downloadable asset not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const isOwner = row.track.ownerUserId === user.id;
    const hasPurchase = await hasPurchasedTrack({
      db,
      trackId,
      userId: user.id,
    });

    if (!isOwner) {
      if (!row.track.downloadsAllowed) {
        return c.json(
          { message: "The artist has disabled downloads for this track." },
          HttpStatusCodes.FORBIDDEN
        );
      }

      const downloadAccess = resolveDownloadAccess({
        hasPlayed: await hasPlayedTrackOnce({ db, trackId, userId: user.id }),
        hasPurchase,
        isPremium: false,
        policy: row.track,
      });
      if (!downloadAccess.allowed) {
        const messageByReason = {
          downloads_disabled:
            "The artist has disabled downloads for this track.",
          first_play_required:
            "Play this track once before downloading its files.",
          purchase_required:
            "Purchase this track before downloading its files.",
        } as const;
        return c.json(
          { message: messageByReason[downloadAccess.reason] },
          HttpStatusCodes.FORBIDDEN
        );
      }
    }

    const object = await bucket.get(row.asset.objectKey);
    const canonicalMediaUrl = (
      env as unknown as { MEDIA_CANONICAL_URL?: string }
    ).MEDIA_CANONICAL_URL?.replace(/\/+$/u, "");
    const canonicalResponse =
      !object && canonicalMediaUrl
        ? await fetch(
            `${canonicalMediaUrl}/${row.asset.objectKey
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`
          ).catch(() => null)
        : null;

    if (!(object || canonicalResponse?.ok)) {
      return c.json(
        {
          message:
            "The download source is temporarily unavailable. The artist may need to re-upload this file.",
        },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (hasPurchase) {
      await db
        .update(purchases)
        .set({
          downloadCount: sql`${purchases.downloadCount} + 1`,
          lastDownloadedAt: new Date(),
        })
        .where(
          and(
            eq(purchases.buyerUserId, user.id),
            eq(purchases.trackId, trackId)
          )
        );
    }

    const fileName =
      trackAssetFileName(row.asset) ??
      `${uniqueSlug(row.track.title)}.download`;
    const headers = new Headers(canonicalResponse?.headers);
    object?.writeHttpMetadata(headers);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${quotedDownloadFileName(fileName)}"`
    );
    headers.set(
      "Content-Type",
      row.asset.mimeType ?? "application/octet-stream"
    );
    headers.set("Cache-Control", "private, no-store");
    const contentLength =
      object?.size ?? canonicalResponse?.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", String(contentLength));
    }

    return new Response(object?.body ?? canonicalResponse?.body, {
      headers,
      status: HttpStatusCodes.OK,
    });
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.union([trackCatalogDetailSchema, trackDashboardDetailSchema]),
        "Track catalog detail"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not found"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { trackId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const db = createDb();
    const currentUser = c.get("user");

    if (isAuthenticatedUser(currentUser)) {
      const session = c.get("session");
      const organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user: currentUser,
      });
      const [ownedTrack] = await db
        .select()
        .from(tracks)
        .where(
          ownedTrackWhere({
            organizationId,
            trackId,
            userId: currentUser.id,
          })
        )
        .limit(1);

      if (ownedTrack) {
        return c.json(await buildTrackDetail(ownedTrack), HttpStatusCodes.OK);
      }
    }

    const [row] = await db
      .select({
        artistAvatarUrl: userProfiles.avatarUrl,
        artistBio: userProfiles.bio,
        artistDisplayName: userProfiles.displayName,
        artistName: authUser.name,
        artistUsername: userProfiles.username,
        bpm: tracks.bpm,
        catalogItemType: tracks.catalogItemType,
        currency: tracks.currency,
        description: tracks.description,
        downloadsAllowed: tracks.downloadsAllowed,
        downloadsRequireFirstPlay: tracks.downloadsRequireFirstPlay,
        downloadsRequirePurchase: tracks.downloadsRequirePurchase,
        exclusiveUntil: tracks.exclusiveUntil,
        genreName: genres.name,
        id: tracks.id,
        isForSale: tracks.isForSale,
        isVerified: artistProfiles.isVerified,
        isrc: tracks.isrc,
        listeningAccess: tracks.listeningAccess,
        musicalKey: tracks.musicalKey,
        ownerUserId: tracks.ownerUserId,
        price: tracks.price,
        priceCents: tracks.priceCents,
        purchaseMode: tracks.purchaseMode,
        slug: tracks.slug,
        state: userProfiles.state,
        title: tracks.title,
      })
      .from(tracks)
      .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
      .leftJoin(artistProfiles, eq(artistProfiles.userId, tracks.ownerUserId))
      .leftJoin(authUser, eq(authUser.id, tracks.ownerUserId))
      .leftJoin(genres, eq(genres.id, tracks.genreId))
      .where(or(eq(tracks.id, trackId), eq(tracks.slug, trackId)))
      .limit(1);

    if (!row) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [roleRows, assetRows, licenseRows] = await Promise.all([
      db
        .select({ role: artistProfileRoles.role })
        .from(artistProfileRoles)
        .where(eq(artistProfileRoles.userId, row.ownerUserId)),
      db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
      db
        .select()
        .from(trackLicenseOptions)
        .where(eq(trackLicenseOptions.trackId, row.id)),
    ]);

    const isAuthenticated = isAuthenticatedUser(currentUser);
    const entitlements = isAuthenticated
      ? await resolveEntitlements({
          session: isAuthenticatedSession(c.get("session"))
            ? c.get("session")
            : null,
          user: currentUser,
        })
      : null;
    const hasPurchase = isAuthenticated
      ? await hasPurchasedTrack({
          db,
          trackId: row.id,
          userId: currentUser.id,
        })
      : false;
    const access = resolveListeningAccess({
      hasPurchase,
      isPremium: entitlements?.isPremium ?? false,
      policy: row,
    });
    const isOwned = hasPurchase;

    const roles: ("musician" | "producer")[] =
      roleRows.length > 0
        ? roleRows.map((roleRow) => roleRow.role)
        : ["musician"];
    const coverAsset =
      assetRows.find(
        (asset) => asset.assetKind === "cover_art" && asset.status === "ready"
      ) ?? assetRows.find((asset) => asset.assetKind === "cover_art");
    const firstAudioAsset =
      assetRows.find((asset) => asset.assetKind === "master") ??
      assetRows.find((asset) => asset.durationMs);
    const previewAsset = assetRows.find((asset) => {
      if (asset.assetKind !== "variant_audio") {
        return false;
      }

      return (
        typeof asset.metadata === "object" &&
        asset.metadata !== null &&
        "variant" in asset.metadata &&
        asset.metadata.variant === "preview_30s"
      );
    });
    const priceCents = priceCentsFromTrack({
      price: row.price,
      priceCents: row.priceCents,
    });

    const assets = assetRows
      .filter((asset) => catalogAssetKinds.has(asset.assetKind))
      .map((asset) => ({
        downloadUrl: `/v1/tracks/${row.id}/assets/${asset.id}/download`,
        duration: formatDuration(asset.durationMs),
        fileName: trackAssetFileName(asset),
        format: asset.mimeType,
        id: asset.id,
        included: asset.status === "ready",
        kind: asset.assetKind as keyof typeof assetKindLabels,
        label:
          assetKindLabels[asset.assetKind as keyof typeof assetKindLabels] ??
          "Track Asset",
        subtitle: asset.mimeType,
      }));

    return c.json(
      {
        artist: {
          avatarUrl: row.artistAvatarUrl,
          followers: null,
          genre: row.genreName ? canonicalGenreName(row.genreName) : null,
          handle: row.artistUsername ?? row.ownerUserId,
          id: row.ownerUserId,
          listeners: null,
          location: null,
          name: row.artistDisplayName ?? row.artistName ?? "SoundKit Artist",
          roles,
          verified: row.isVerified ?? false,
        },
        assets,
        bpm: row.bpm,
        catalogItemType: row.catalogItemType,
        coverArtUrl:
          typeof coverAsset?.metadata === "object" &&
          coverAsset.metadata &&
          "url" in coverAsset.metadata
            ? String(coverAsset.metadata.url)
            : "/placeholder.svg",
        currency: row.currency,
        description: row.description,
        downloadsAllowed: row.downloadsAllowed,
        downloadsRequireFirstPlay: row.downloadsRequireFirstPlay,
        downloadsRequirePurchase: row.downloadsRequirePurchase,
        duration: formatDuration(firstAudioAsset?.durationMs ?? null),
        durationMs: firstAudioAsset?.durationMs ?? null,
        genre: row.genreName ? canonicalGenreName(row.genreName) : null,
        id: row.id,
        isForSale: row.isForSale,
        isOwned,
        isPreviewAvailable: Boolean(previewAsset),
        isPurchasable: row.isForSale,
        isStreamable: access.canListen,
        isrc: row.isrc,
        licenseOptions: licenseRows.map((license) => ({
          currency: license.currency,
          id: license.id,
          includesStems: license.includesStems,
          isExclusive: license.isExclusive,
          name: license.name,
          priceCents: license.priceCents,
          priceLabel: formatPrice(license.priceCents),
          rightsSummary: license.rightsSummary,
        })),
        musicalKey: row.musicalKey,
        playbackUrl: access.canListen
          ? publicTrackAssetUrl(firstAudioAsset)
          : null,
        previewUrl: publicTrackAssetUrl(previewAsset),
        priceCents,
        priceLabel: formatPrice(priceCents),
        purchaseMode: row.purchaseMode,
        regionSlug: regionSlugFromUser(row.state) ?? null,
        slug: row.slug,
        streamCount: null,
        tags: row.genreName ? [canonicalGenreName(row.genreName)] : [],
        title: row.title,
        visualContent: [],
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/:trackId/pre-save",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          isPreSaved: z.boolean(),
          message: z.string(),
        }),
        "Pre-save status"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { trackId } = c.req.valid("param");
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(
        { message: "Authentication is required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    try {
      const db = createDb();
      await db
        .insert(trackPreSaves)
        .values({
          createdAt: new Date(),
          trackId,
          userId: user.id,
        })
        .onConflictDoNothing();
    } catch {
      // Best effort
    }

    return c.json(
      {
        isPreSaved: true,
        message: "Track pre-saved! We'll notify you on release date.",
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
