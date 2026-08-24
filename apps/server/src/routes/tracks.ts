/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary */
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
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { guardedTrackPlaybackUrl, publicAssetUrl } from "@/lib/asset-urls";
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
  ENRICHMENT_PIPELINE_VERSION,
  MEDIA_PIPELINE_VERSION,
} from "@/lib/media-pipeline";
import type { TrackEnrichmentWorkflowPayload } from "@/lib/media-pipeline";
import { getTrackMediaProcessingStatus } from "@/lib/media-processing";
import {
  ensureMediaProcessingWorkflow,
  ensureMediaRetentionWorkflow,
  ensureTrackEnrichmentWorkflow,
} from "@/lib/media-processing-jobs";
import { verifySignedMediaSource } from "@/lib/media-signing";
import { notify } from "@/lib/notifications";
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
  finalizeTrackUploadBodySchema,
  createLyricsRevisionBodySchema,
  createPlaybackSessionBodySchema,
  lyricsRevisionSchema,
  mediaProcessingStatusSchema,
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
import {
  resolveTrackAsset,
  resolveTrackAssetFromRows,
} from "@/lib/track-asset-resolver";
import { notifyTrackLive } from "@/lib/track-notifications";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";
import { logError } from "@/middleware/structured-logging";
import { isAllowedUploadKeyForAssetKind } from "@/routes/uploads";

const TRACK_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000,
  DEFAULT_SELF_CREDIT_SPLIT_BPS = 5000,
  app = new OpenAPIHono<AppEnv>(),
  databaseUnavailableMessage = {
    message: "Database is not configured.",
  },
  formatDuration = (durationMs: number | null) => {
    if (!durationMs) {
      return null;
    }

    const totalSeconds = Math.round(durationMs / 1000),
      minutes = Math.floor(totalSeconds / 60),
      seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },
  formatPrice = (priceCents: number | null) => {
    if (typeof priceCents !== "number") {
      return "";
    }

    return `$${(priceCents / 100).toFixed(2)}`;
  },
  priceCentsFromTrack = ({
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
  },
  // Downloads are named after the track, never the raw uploaded file:
  // "blunt-22.wav", "blunt-22.m4a", "blunt-22-cover.jpg".
  trackDownloadBaseName = (trackTitle: string) => {
    const slug = uniqueSlug(trackTitle);

    return slug.length > 0 ? slug : "track";
  },
  assetDownloadExtension = (asset: typeof trackAssets.$inferSelect) => {
    if (asset.purpose === "lossless_download") {
      return ".flac";
    }
    if (
      asset.purpose === "streaming" ||
      asset.purpose === "battle" ||
      asset.purpose === "download" ||
      asset.purpose === "open_verse_snippet"
    ) {
      return ".m4a";
    }

    const objectKeyExtension = asset.objectKey?.includes(".")
      ? (asset.objectKey.split(".").pop() ?? "").toLowerCase()
      : "";
    if (/^[a-z0-9]{2,5}$/u.test(objectKeyExtension)) {
      return `.${objectKeyExtension}`;
    }

    const mimeByExtension: Record<string, string> = {
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
      },
      mimeType = asset.mimeType ?? "";

    return mimeByExtension[mimeType] ?? ".bin";
  },
  trackAssetDownloadFileName = ({
    asset,
    trackTitle,
  }: {
    asset: typeof trackAssets.$inferSelect;
    trackTitle: string;
  }) => {
    const baseName = trackDownloadBaseName(trackTitle),
      extension = assetDownloadExtension(asset),
      isArtwork =
        asset.assetKind === "cover_art" || asset.purpose === "artwork";

    return isArtwork
      ? `${baseName}-cover${extension}`
      : `${baseName}${extension}`;
  },
  quotedDownloadFileName = (fileName: string) =>
    fileName.replaceAll(/[\\"]/gu, "_"),
  // R2's get() requires a structured R2Range; passing raw request headers
  // produces unusable range metadata (Content-Range: bytes NaN-NaN/...).
  buildR2Range = (
    rangeHeader: string | undefined,
    objectSize: number
  ): R2Range | undefined => {
    if (!rangeHeader || !(objectSize > 0)) {
      return undefined;
    }

    const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(rangeHeader.trim());
    if (!match) {
      return undefined;
    }

    const startText = match.groups?.start ?? "",
      endText = match.groups?.end ?? "";
    if (startText === "" && endText === "") {
      return undefined;
    }

    // Suffix form: "bytes=-N" returns the final N bytes.
    if (startText === "") {
      const suffix = Number(endText);

      return Number.isInteger(suffix) && suffix > 0
        ? { suffix: Math.min(suffix, objectSize) }
        : undefined;
    }

    const offset = Number(startText);
    if (!Number.isInteger(offset) || offset < 0 || offset >= objectSize) {
      return undefined;
    }

    if (endText === "") {
      return { offset };
    }

    const end = Number(endText);
    if (!Number.isInteger(end) || end < offset) {
      return undefined;
    }

    return {
      length: Math.min(end - offset + 1, objectSize - offset),
      offset,
    };
  },
  getMediaBucket = (bindings: AppEnv["Bindings"]) =>
    bindings.MEDIA_BUCKET ??
    (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ??
    null,
  hasPurchasedTrack = async ({
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
      .innerJoin(
        projectTracks,
        eq(projectTracks.projectId, purchases.projectId)
      )
      .where(
        and(
          eq(purchases.buyerUserId, userId),
          eq(projectTracks.trackId, trackId)
        )
      )
      .limit(1);

    return Boolean(projectPurchase);
  },
  hasPlayedTrackOnce = async ({
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
  },
  assetPurposeForKind = (assetKind: string) => {
    if (assetKind === "master") {
      return "master" as const;
    }
    if (assetKind === "cover_art" || assetKind === "artwork") {
      return "artwork" as const;
    }
    if (assetKind === "variant_audio") {
      return "preview" as const;
    }
    if (assetKind === "open_verse_clip") {
      return "open_verse_snippet" as const;
    }
    if (
      assetKind === "vocal_stem" ||
      assetKind === "instrumental" ||
      assetKind === "stems"
    ) {
      return "stem" as const;
    }
    return "other" as const;
  },
  assetKindLabels = {
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
  } as const,
  catalogAssetKinds = new Set(Object.keys(assetKindLabels)),
  trackPlayCount = sql<number>`coalesce((
  select count(*)::int
  from ${playbackSessions}
  where ${playbackSessions.trackId} = ${tracks.id}
), 0)`,
  trackEffectiveDate = sql`coalesce(${tracks.publishedAt}, ${tracks.createdAt}, ${tracks.updatedAt})`,
  publicTrackOrderBy = (sort?: string) => {
    if (sort === "title-asc") {
      return asc(tracks.title);
    }

    if (sort === "title-desc") {
      return desc(tracks.title);
    }

    if (sort === "date-asc") {
      return asc(trackEffectiveDate);
    }

    if (sort === "date-desc") {
      return desc(trackEffectiveDate);
    }

    if (sort === "plays-asc") {
      return asc(trackPlayCount);
    }

    return desc(trackPlayCount);
  },
  getTrackEnrichmentWorkflow = () =>
    (
      env as unknown as {
        TRACK_ENRICHMENT_WORKFLOW?: Workflow<TrackEnrichmentWorkflowPayload>;
      }
    ).TRACK_ENRICHMENT_WORKFLOW ?? null,
  queueTrackAudioProcessing = async ({
    masterAsset,
    trackId,
  }: {
    masterAsset: typeof trackAssets.$inferSelect;
    trackId: string;
  }) => {
    if (!masterAsset.objectKey) {
      throw new Error("Current master object key is unavailable.");
    }

    const db = createDb(),
      stemJobId = `stem:${masterAsset.id}:v${ENRICHMENT_PIPELINE_VERSION}`;
    await withRetry("ensure current stem job", () =>
      db
        .insert(trackStemJobs)
        .values({
          id: stemJobId,
          inputAssetId: masterAsset.id,
          outputFormat: "MP3",
          outputType: "BOTH",
          status: "queued",
          trackId,
        })
        .onConflictDoNothing()
    );
    const [job] = await db
      .select()
      .from(trackStemJobs)
      .where(eq(trackStemJobs.inputAssetId, masterAsset.id))
      .limit(1);
    if (!job) {
      throw new Error("Unable to create track enrichment job.");
    }
    if (job.status === "completed") {
      return {
        jobId: job.id,
        message: "Track enrichment is already current.",
        status: "completed" as const,
      };
    }

    await withRetry("mark lyrics generating", () =>
      db
        .update(tracks)
        .set({
          lyricsStatus: "generating",
          updatedAt: new Date(),
        })
        .where(and(eq(tracks.id, trackId), ne(tracks.lyricsStatus, "approved")))
    );

    const ensured = await ensureTrackEnrichmentWorkflow({
      payload: {
        objectKey: masterAsset.objectKey,
        pipelineVersion: ENRICHMENT_PIPELINE_VERSION,
        sourceAssetId: masterAsset.id,
        trackId,
      },
      workflow: getTrackEnrichmentWorkflow(),
    });
    await withRetry("save enrichment workflow instance id", () =>
      db
        .update(trackStemJobs)
        .set({ workflowInstanceId: ensured.workflowInstanceId })
        .where(eq(trackStemJobs.id, job.id))
    );

    return {
      jobId: job.id,
      message:
        ensured.workflowStatus === "binding_unavailable"
          ? "Track enrichment is retryable when its Workflow binding is available."
          : "Track enrichment workflow started.",
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
    const query = c.req.valid("query"),
      user = c.get("user"),
      isPublicScope = query.scope === "public";

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (isPublicScope || !isAuthenticatedUser(user)) {
      const db = createDb(),
        genreSlug = genreSlugFromExploreFilter(query.genre),
        state = stateFromExploreRegion(query),
        publicTrackConditions = [
          eq(tracks.isPublic, true),
          // Soft-deleted tracks stay in the shared database for their recovery
          // window but must vanish from every listing immediately.
          isNull(tracks.deletedAt),
        ];

      if (query.forSale) {
        publicTrackConditions.push(eq(tracks.isForSale, true));
      }

      if (query.q) {
        publicTrackConditions.push(ilike(tracks.title, `%${query.q}%`));
      }

      if (genreSlug) {
        publicTrackConditions.push(eq(genres.slug, genreSlug));
      }

      if (state) {
        publicTrackConditions.push(
          sql`lower(${userProfiles.state}) in (${state.name.toLowerCase()}, ${state.abbreviation.toLowerCase()})`
        );
      }

      const limit = query.limit ?? 24,
        page = query.page ?? 1,
        offset = (page - 1) * limit,
        order = publicTrackOrderBy(query.sort),
        rows = await withRetry("list public tracks", () =>
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
            .limit(limit)
            .offset(offset)
        ),
        summaries = [];

      for (const row of rows) {
        summaries.push({
          ...(await buildTrackSummary(row.track)),
          plays: row.playCount ?? 0,
          regionSlug: regionSlugFromUser(row.state) ?? null,
        });
      }

      return c.json(summaries, HttpStatusCodes.OK);
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      rows = await withRetry("list dashboard tracks", () =>
        db
          .select({
            playCount: trackPlayCount,
            track: tracks,
          })
          .from(tracks)
          .where(
            and(
              // Soft-deleted tracks disappear from the dashboard immediately;
              // they remain recoverable server-side until purge.
              isNull(tracks.deletedAt),
              organizationId
                ? or(
                    eq(tracks.organizationId, organizationId),
                    eq(tracks.ownerUserId, user.id)
                  )
                : eq(tracks.ownerUserId, user.id)
            )
          )
          .orderBy(desc(tracks.updatedAt))
          .limit(100)
      ),
      summaries = [];

    for (const row of rows) {
      summaries.push(
        await buildTrackSummary(row.track, row.playCount ?? undefined)
      );
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [trackPolicy] = await db
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
      }),
      access = resolveListeningAccess({
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

    const { sessionId, trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      result = await recordPlaybackProgress({
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

    const { sessionId, trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      result = await recordPlaybackProgress({
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

    const db = createDb(),
      [revision] = await db
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [track] = await db
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

    const body = c.req.valid("json"),
      session = c.get("session");

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
      const db = createDb(),
        organizationId = await resolveActiveOrganizationId({
          session: isAuthenticatedSession(session) ? session : null,
          user,
        }),
        [profile] = await db
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

      const genreSlug = canonicalGenreSlug(body.genre),
        [genreRow] = await withRetry("find track genre", () =>
          db
            .select({ id: genres.id })
            .from(genres)
            .where(eq(genres.slug, genreSlug))
            .limit(1)
        ),
        genreId = genreRow?.id ?? crypto.randomUUID();

      if (!genreRow) {
        await withRetry("create track genre", () =>
          db.insert(genres).values({
            id: genreId,
            name: canonicalGenreName(body.genre),
            slug: genreSlug,
          })
        );
      }

      const trackId = crypto.randomUUID(),
        now = new Date(),
        isSingle = body.catalogItemType === "single",
        rawPriceNum =
          typeof body.price === "number"
            ? body.price
            : body.price
              ? Number(body.price)
              : null;
      const salePriceUsd =
        body.isForSale && isSingle
          ? SINGLE_TRACK_PRICE_USD
          : rawPriceNum !== null && !isNaN(rawPriceNum)
            ? rawPriceNum
            : null;
      const salePriceCents =
          body.isForSale && isSingle
            ? SINGLE_TRACK_PRICE_CENTS
            : (body.priceCents ??
              (salePriceUsd === null ? null : Math.round(salePriceUsd * 100))),
        [track] = await withRetry("create track", () =>
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
                typeof salePriceUsd === "number"
                  ? salePriceUsd.toFixed(2)
                  : null,
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
        const collaboratorRows = body.collaborators.flatMap((collaborator) => {
          const baseRow = {
              // Added collaborators get shared read-only access; owners can
              // grant edit/upload from the track dashboard later.
              canDelete: false,
              canEdit: false,
              canUpload: false,
              collaboratorRole: collaborator.role,
              collaboratorUserId: collaborator.userId ?? null,
              createdAt: now,
              creditSplitBps: collaborator.splitBps ?? null,
              id: crypto.randomUUID(),
              invitationStatus: collaborator.userId
                ? ("accepted" as const)
                : ("pending" as const),
              inviteEmail: collaborator.inviteEmail ?? null,
              invitedByUserId: user.id,
              trackId,
            },
            rows = [baseRow];

          // Featured artists and producers commonly receive a writer credit
          // too; persist it as its own songwriter row so credits group cleanly.
          if (
            collaborator.alsoCreditAsWriter &&
            collaborator.role !== "songwriter"
          ) {
            rows.push({
              ...baseRow,
              collaboratorRole: "songwriter" as const,
              id: crypto.randomUUID(),
            });
          }

          return rows;
        });

        await withRetry("insert track collaborators", () =>
          db.insert(trackCollaborators).values(collaboratorRows)
        );
        for (const collaborator of collaboratorRows) {
          if (collaborator.collaboratorUserId) {
            await notify(
              {
                actorUserId: user.id,
                data: {
                  actionPath: `/dashboard/tracks/${trackId}`,
                  actorName: user.name ?? "Someone",
                  workTitle: body.title,
                  workType: "track",
                },
                entity: { id: trackId, type: "track" },
                eventId: collaborator.id,
                recipientUserId: collaborator.collaboratorUserId,
                type: "collaboration.invited",
              },
              { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
            );
          } else if (
            collaborator.inviteEmail &&
            collaborator.inviteEmail.toLowerCase() !==
              (user.email ?? "").toLowerCase()
          ) {
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
      } else {
        // No explicit collaborators: credit the uploader as the track's
        // artist and songwriter with an even 50/50 split. These rows are
        // internal defaults, so no invitations or notifications are sent.
        const defaultCollaboratorRows = (["artist", "songwriter"] as const).map(
          (role) => ({
            canDelete: false,
            canEdit: false,
            canUpload: false,
            collaboratorRole: role,
            collaboratorUserId: user.id,
            createdAt: now,
            creditSplitBps: DEFAULT_SELF_CREDIT_SPLIT_BPS,
            id: crypto.randomUUID(),
            invitationStatus: "accepted" as const,
            inviteEmail: null,
            invitedByUserId: user.id,
            trackId,
          })
        );

        await withRetry("insert default track collaborators", () =>
          db.insert(trackCollaborators).values(defaultCollaboratorRows)
        );
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
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Stripe Connect onboarding required to sell"
      ),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Track media is not ready for release"
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb();

    let updatedGenreId: string | undefined;
    if (body.genre) {
      const genreSlug = canonicalGenreSlug(body.genre),
        [genreRow] = await db
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

    const [existingTrack] = await db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);

    if (!existingTrack) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const isOwner =
        existingTrack.ownerUserId === user.id ||
        (organizationId && existingTrack.organizationId === organizationId),
      isCollaborator =
        (
          await db
            .select({ id: trackCollaborators.id })
            .from(trackCollaborators)
            .where(
              and(
                eq(trackCollaborators.trackId, trackId),
                eq(trackCollaborators.collaboratorUserId, user.id),
                inArray(trackCollaborators.invitationStatus, [
                  "accepted",
                  "pending",
                ])
              )
            )
            .limit(1)
        ).length > 0;

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (body.isPublic === true && !existingTrack.isPublic) {
      const streamingAsset = await resolveTrackAsset({
        purpose: "streaming",
        trackId,
      });
      if (!streamingAsset) {
        return c.json(
          {
            code: "MEDIA_NOT_READY",
            message:
              "SoundKit is still preparing the streaming version. Retry processing before releasing this track.",
          },
          HttpStatusCodes.CONFLICT
        );
      }
    }

    if (body.isForSale === true) {
      const sellerEnabled = await isSellerEnabled({
        organizationId,
        userId: user.id,
      });

      if (!sellerEnabled) {
        return c.json(
          {
            code: "setup_required" as const,
            message:
              "Stripe Connect onboarding is required before selling this track.",
          },
          HttpStatusCodes.FORBIDDEN
        );
      }
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
        publishedAt:
          body.isPublic === true
            ? (existingTrack.publishedAt ?? new Date())
            : body.isPublic === false
              ? null
              : undefined,
        purchaseMode: body.purchaseMode,
        releaseAt: body.releaseAt ? new Date(body.releaseAt) : undefined,
        releaseStrategy:
          body.isPublic === true && existingTrack.releaseStrategy === "private"
            ? "publish_when_ready"
            : body.releaseStrategy,
        title: body.title,
        updatedAt: new Date(),
      })
      .where(eq(tracks.id, trackId))
      .returning();

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    // Replace the collaborator credits when the payload carries an explicit
    // collaborators array (including an empty one, which clears credits).
    if (body.collaborators !== undefined) {
      const replacedAt = new Date(),
        collaboratorRows = body.collaborators.flatMap((collaborator) => {
          const baseRow = {
              canDelete: false,
              canEdit: false,
              canUpload: false,
              collaboratorRole: collaborator.role,
              collaboratorUserId: collaborator.userId ?? null,
              createdAt: replacedAt,
              creditSplitBps: collaborator.splitBps ?? null,
              id: crypto.randomUUID(),
              invitationStatus: collaborator.userId
                ? ("accepted" as const)
                : ("pending" as const),
              inviteEmail: collaborator.inviteEmail ?? null,
              invitedByUserId: user.id,
              trackId,
            },
            rows = [baseRow];

          // Featured artists and producers commonly receive a writer credit
          // too; persist it as its own songwriter row so credits group cleanly.
          if (
            collaborator.alsoCreditAsWriter &&
            collaborator.role !== "songwriter"
          ) {
            rows.push({
              ...baseRow,
              collaboratorRole: "songwriter" as const,
              id: crypto.randomUUID(),
            });
          }

          return rows;
        });

      await withRetry("replace track collaborators", () =>
        db.transaction(async (transaction) => {
          await transaction
            .delete(trackCollaborators)
            .where(eq(trackCollaborators.trackId, trackId));
          if (collaboratorRows.length > 0) {
            await transaction
              .insert(trackCollaborators)
              .values(collaboratorRows);
          }
        })
      );
    }

    if (body.isPublic === true && !existingTrack.isPublic) {
      await notifyTrackLive({
        emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
        trackId,
      });
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

    const { trackId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb();

    const deletedAt = new Date(),
      purgeAfter = new Date(deletedAt.getTime() + TRACK_RECOVERY_WINDOW_MS),
      [deletedTrack] = await db
        .update(tracks)
        .set({
          deletedAt,
          isForSale: false,
          isPublic: false,
          purgeAfter,
          releaseStrategy: "private",
          updatedAt: deletedAt,
        })
        .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
        .returning({ id: tracks.id });
    if (!deletedTrack) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.OK);
    }

    try {
      await ensureMediaRetentionWorkflow({
        payload: {
          deletedAt: deletedAt.toISOString(),
          purgeAfter: purgeAfter.toISOString(),
          trackId,
        },
        workflow: c.env.MEDIA_RETENTION_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "media_retention_workflow_launch_failed",
        trackId,
      });
    }

    return c.json(
      { message: "Track deleted. Recovery is available for 30 days." },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/recover",
    request: { params: z.object({ trackId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Track recovered"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track not recoverable"
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
        { message: "Track recovery is unavailable." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const { trackId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      [recovered] = await createDb()
        .update(tracks)
        .set({ deletedAt: null, purgeAfter: null, updatedAt: new Date() })
        .where(
          and(
            ownedTrackWhere({ organizationId, trackId, userId: user.id }),
            gt(tracks.purgeAfter, new Date())
          )
        )
        .returning({ id: tracks.id });
    if (!recovered) {
      return c.json(
        { message: "Track is outside its recovery window." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    return c.json(
      { message: "Track recovered as a private draft." },
      HttpStatusCodes.OK
    );
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
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Validation error"
      ),
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json");

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

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
        .select()
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const isOwner =
        track.ownerUserId === user.id ||
        (organizationId && track.organizationId === organizationId),
      isCollaborator =
        (
          await db
            .select({ id: trackCollaborators.id })
            .from(trackCollaborators)
            .where(
              and(
                eq(trackCollaborators.trackId, trackId),
                eq(trackCollaborators.collaboratorUserId, user.id),
                inArray(trackCollaborators.invitationStatus, [
                  "accepted",
                  "pending",
                ])
              )
            )
            .limit(1)
        ).length > 0;

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (
      body.objectKey &&
      !isAllowedUploadKeyForAssetKind({
        assetKind: body.assetKind,
        objectKey: body.objectKey,
        userId: user.id,
      })
    ) {
      return c.json(
        {
          message:
            "Object key does not belong to the allowed upload route for this asset.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const bucket = getMediaBucket(c.env as AppEnv["Bindings"]);
    let verifiedSizeBytes = body.sizeBytes ?? null;

    if (bucket && body.objectKey) {
      const r2Object = await bucket.head(body.objectKey);
      if (!r2Object) {
        return c.json(
          {
            message:
              "Storage object not found in bucket. Upload must complete before registering asset.",
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      if (body.assetKind === "master" && r2Object.size === 0) {
        return c.json(
          {
            message: "Uploaded master audio file is empty.",
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      verifiedSizeBytes = r2Object.size;
    }

    const purpose = assetPurposeForKind(body.assetKind),
      [objectOwner] = await withRetry("find track asset object owner", () =>
        db
          .select({ id: trackAssets.id, trackId: trackAssets.trackId })
          .from(trackAssets)
          .where(
            and(
              eq(trackAssets.storageProvider, body.storageProvider),
              eq(trackAssets.objectKey, body.objectKey)
            )
          )
          .limit(1)
      );
    if (objectOwner && objectOwner.trackId !== trackId) {
      return c.json(
        { message: "Storage object is already registered to another track." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const assetId = objectOwner?.id ?? crypto.randomUUID();

    await withRetry("upsert current track asset", () =>
      db.transaction(async (transaction) => {
        await transaction
          .update(trackAssets)
          .set({ isCurrent: false, updatedAt: new Date() })
          .where(
            and(
              eq(trackAssets.trackId, trackId),
              eq(trackAssets.assetKind, body.assetKind),
              // Legacy rows may carry a NULL purpose; demote on assetKind so
              // an old current asset can never survive alongside its
              // replacement.
              or(eq(trackAssets.purpose, purpose), isNull(trackAssets.purpose)),
              eq(trackAssets.isCurrent, true),
              ne(trackAssets.objectKey, body.objectKey)
            )
          );
        await transaction
          .insert(trackAssets)
          .values({
            assetKind: body.assetKind,
            bucketName: body.bucketName ?? null,
            durationMs: body.durationMs ?? null,
            id: assetId,
            isCurrent: true,
            metadata: body.metadata,
            mimeType: body.mimeType ?? null,
            objectKey: body.objectKey,
            processingVersion:
              body.assetKind === "master" ? MEDIA_PIPELINE_VERSION : null,
            purpose,
            sizeBytes: verifiedSizeBytes,
            status: body.status,
            storageProvider: body.storageProvider,
            trackId,
            uploaderUserId: user.id,
          })
          .onConflictDoUpdate({
            set: {
              bucketName: body.bucketName ?? null,
              durationMs: body.durationMs ?? null,
              isCurrent: true,
              metadata: body.metadata,
              mimeType: body.mimeType ?? null,
              processingVersion:
                body.assetKind === "master" ? MEDIA_PIPELINE_VERSION : null,
              purpose,
              sizeBytes: verifiedSizeBytes,
              status: body.status,
              updatedAt: new Date(),
              uploaderUserId: user.id,
            },
            target: [trackAssets.storageProvider, trackAssets.objectKey],
          });
      })
    );

    // A swapped-in master must regenerate streaming/battle/download
    // derivatives; launch processing exactly like settlement does.
    if (body.assetKind === "master") {
      try {
        await ensureMediaProcessingWorkflow({
          payload: {
            mode: "final_track",
            objectKey: body.objectKey,
            pipelineVersion: MEDIA_PIPELINE_VERSION,
            sourceAssetId: assetId,
            trackId,
          },
          workflow: (c.env as AppEnv["Bindings"]).MEDIA_PROCESSING_WORKFLOW,
        });
      } catch (error) {
        logError({
          error: error instanceof Error ? error.message : String(error),
          event: "media_workflow_launch_failed",
          sourceAssetId: assetId,
          trackId,
        });
      }
    }

    return c.json(await buildTrackDetail(track), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/finalize-upload",
    request: {
      body: jsonContentRequired(
        finalizeTrackUploadBodySchema,
        "Uploaded track finalization payload"
      ),
      params: z.object({ trackId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackDashboardDetailSchema,
        "Uploaded track finalized"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Uploaded assets could not be verified"
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
        { message: "Database is required before finalizing track media." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { trackId } = c.req.valid("param"),
      { assets, settlement } = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
        .select()
        .from(tracks)
        .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
        .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const masterUploads = assets.filter(
        (asset) => asset.assetKind === "master"
      ),
      coverUpload = assets.find((asset) => asset.assetKind === "cover_art");
    if (masterUploads.length !== 1) {
      return c.json(
        { message: "Select exactly one master audio file before continuing." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    if (settlement.requireCoverArt && !coverUpload) {
      return c.json(
        { message: "Cover art is required before this track can be released." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const bucket = getMediaBucket(c.env as AppEnv["Bindings"]);
    if (!bucket) {
      throw new Error("Media bucket binding is unavailable.");
    }

    const verifiedAssets: {
      asset: (typeof assets)[number];
      existingId: string | null;
      sizeBytes: number;
    }[] = [];
    for (const asset of assets) {
      if (
        asset.storageProvider !== "r2" ||
        !isAllowedUploadKeyForAssetKind({
          assetKind: asset.assetKind,
          objectKey: asset.objectKey,
          userId: user.id,
        })
      ) {
        return c.json(
          { message: "An uploaded file is not authorized for this track." },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const storedObject = await bucket.head(asset.objectKey);
      if (
        !storedObject ||
        (asset.assetKind === "master" && storedObject.size === 0)
      ) {
        return c.json(
          {
            message:
              "An uploaded file could not be verified. Retry finalization without uploading it again.",
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      if (
        asset.sizeBytes !== undefined &&
        storedObject.size !== asset.sizeBytes
      ) {
        return c.json(
          { message: "An uploaded file did not match its expected size." },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const [objectOwner] = await db
        .select({ id: trackAssets.id, trackId: trackAssets.trackId })
        .from(trackAssets)
        .where(
          and(
            eq(trackAssets.storageProvider, "r2"),
            eq(trackAssets.objectKey, asset.objectKey)
          )
        )
        .limit(1);
      if (objectOwner && objectOwner.trackId !== trackId) {
        return c.json(
          { message: "An uploaded file is already attached to another track." },
          HttpStatusCodes.BAD_REQUEST
        );
      }
      verifiedAssets.push({
        asset,
        existingId: objectOwner?.id ?? null,
        sizeBytes: storedObject.size,
      });
    }

    const [currentMaster] = await db
        .select({ objectKey: trackAssets.objectKey })
        .from(trackAssets)
        .where(
          and(
            eq(trackAssets.trackId, trackId),
            eq(trackAssets.assetKind, "master"),
            eq(trackAssets.isCurrent, true)
          )
        )
        .limit(1),
      releaseAt = settlement.releaseAt ? new Date(settlement.releaseAt) : null,
      finalized = await withRetry("finalize uploaded track", () =>
        db.transaction(async (transaction) => {
          let masterAssetId = "";
          for (const verified of verifiedAssets) {
            const { asset } = verified,
              purpose = assetPurposeForKind(asset.assetKind),
              assetId = verified.existingId ?? crypto.randomUUID();

            await transaction
              .update(trackAssets)
              .set({ isCurrent: false, updatedAt: new Date() })
              .where(
                and(
                  eq(trackAssets.trackId, trackId),
                  eq(trackAssets.assetKind, asset.assetKind),
                  eq(trackAssets.isCurrent, true),
                  ne(trackAssets.objectKey, asset.objectKey)
                )
              );
            await transaction
              .insert(trackAssets)
              .values({
                assetKind: asset.assetKind,
                bucketName: asset.bucketName ?? null,
                durationMs: asset.durationMs ?? null,
                id: assetId,
                isCurrent: true,
                metadata: asset.metadata,
                mimeType: asset.mimeType ?? null,
                objectKey: asset.objectKey,
                processingVersion:
                  asset.assetKind === "master" ? MEDIA_PIPELINE_VERSION : null,
                purpose,
                sizeBytes: verified.sizeBytes,
                status: asset.assetKind === "master" ? "ready" : asset.status,
                storageProvider: "r2",
                trackId,
                uploaderUserId: user.id,
              })
              .onConflictDoUpdate({
                set: {
                  bucketName: asset.bucketName ?? null,
                  durationMs: asset.durationMs ?? null,
                  isCurrent: true,
                  metadata: asset.metadata,
                  mimeType: asset.mimeType ?? null,
                  processingVersion:
                    asset.assetKind === "master"
                      ? MEDIA_PIPELINE_VERSION
                      : null,
                  purpose,
                  sizeBytes: verified.sizeBytes,
                  status: asset.assetKind === "master" ? "ready" : asset.status,
                  updatedAt: new Date(),
                  uploaderUserId: user.id,
                },
                target: [trackAssets.storageProvider, trackAssets.objectKey],
              });

            if (asset.assetKind === "master") {
              masterAssetId = assetId;
            }
          }

          const masterObjectKey = masterUploads[0]?.objectKey ?? "",
            preservePublishedState =
              track.isPublic && currentMaster?.objectKey === masterObjectKey,
            [settledTrack] = await transaction
              .update(tracks)
              .set({
                isPublic: preservePublishedState,
                productionStatus: settlement.productionStatus,
                publishedAt: preservePublishedState ? track.publishedAt : null,
                releaseAt,
                releaseStrategy: settlement.releaseStrategy,
                updatedAt: new Date(),
              })
              .where(
                ownedTrackWhere({ organizationId, trackId, userId: user.id })
              )
              .returning();

          if (!(settledTrack && masterAssetId && masterObjectKey)) {
            throw new Error("Uploaded track could not be finalized.");
          }
          return { masterAssetId, masterObjectKey, settledTrack };
        })
      );

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "final_track",
          objectKey: finalized.masterObjectKey,
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: finalized.masterAssetId,
          trackId,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "media_workflow_launch_failed",
        sourceAssetId: finalized.masterAssetId,
        trackId,
      });
    }

    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    if (entitlements.isPremium && settlement.enrichLyrics) {
      const [masterAsset] = await db
        .select()
        .from(trackAssets)
        .where(eq(trackAssets.id, finalized.masterAssetId))
        .limit(1);
      if (masterAsset) {
        await queueTrackAudioProcessing({ masterAsset, trackId });
      }
    }

    return c.json(
      await buildTrackDetail(finalized.settledTrack),
      HttpStatusCodes.OK
    );
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
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
        .where(eq(trackAssets.trackId, trackId)),
      masterAsset = assetRows.find(
        (asset) =>
          asset.assetKind === "master" &&
          asset.isCurrent &&
          Boolean(asset.objectKey) &&
          (asset.status === "ready" || asset.status === "uploaded")
      ),
      coverAsset = assetRows.find(
        (asset) =>
          asset.assetKind === "cover_art" &&
          asset.isCurrent &&
          Boolean(asset.objectKey)
      ),
      streamingAsset = assetRows.find(
        (asset) =>
          asset.purpose === "streaming" &&
          asset.isCurrent &&
          asset.status === "ready" &&
          Boolean(asset.objectKey)
      );

    if (!masterAsset?.objectKey) {
      return c.json(
        {
          code: "MASTER_UPLOAD_PENDING",
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

    const releaseAt = body.releaseAt ? new Date(body.releaseAt) : null,
      shouldPublish = body.isPublic && Boolean(streamingAsset),
      [settledTrack] = await withRetry("settle track", () =>
        db
          .update(tracks)
          .set({
            isPublic: shouldPublish,
            productionStatus: body.productionStatus,
            publishedAt: shouldPublish
              ? (track.publishedAt ?? new Date())
              : null,
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

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "final_track",
          objectKey: masterAsset.objectKey,
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: masterAsset.id,
          trackId,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "media_workflow_launch_failed",
        sourceAssetId: masterAsset.id,
        trackId,
      });
    }

    if (entitlements.isPremium && body.enrichLyrics !== false) {
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
    method: "get",
    path: "/{trackId}/processing",
    request: {
      params: z.object({ trackId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        mediaProcessingStatusSchema,
        "SoundKit media processing state"
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
      return c.json(databaseUnavailableMessage, HttpStatusCodes.NOT_FOUND);
    }

    const { trackId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      [track] = await createDb()
        .select({ id: tracks.id })
        .from(tracks)
        .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
        .limit(1);
    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    return c.json(
      await getTrackMediaProcessingStatus(trackId),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{trackId}/processing/retry",
    request: {
      params: z.object({ trackId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.ACCEPTED]: jsonContent(
        mediaProcessingStatusSchema,
        "Media processing retry accepted"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Track or master not found"
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
      return c.json(databaseUnavailableMessage, HttpStatusCodes.NOT_FOUND);
    }

    const { trackId } = c.req.valid("param"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
        .select({ id: tracks.id })
        .from(tracks)
        .where(ownedTrackWhere({ organizationId, trackId, userId: user.id }))
        .limit(1);
    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const [master] = await db
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true)
        )
      )
      .orderBy(desc(trackAssets.updatedAt))
      .limit(1);
    if (!master?.objectKey) {
      return c.json(
        { message: "Current master is unavailable." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "final_track",
          objectKey: master.objectKey,
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: master.id,
          trackId,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "media_workflow_retry_failed",
        sourceAssetId: master.id,
        trackId,
      });
    }

    return c.json(
      await getTrackMediaProcessingStatus(trackId),
      HttpStatusCodes.ACCEPTED
    );
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

    const { trackId } = c.req.valid("param"),
      session = c.get("session"),
      entitlements = await resolveEntitlements({
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
      }),
      db = createDb(),
      [track] = await db
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

    const { trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
        .select({
          id: tracks.id,
          organizationId: tracks.organizationId,
          ownerUserId: tracks.ownerUserId,
        })
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const isOwner =
        track.ownerUserId === user.id ||
        (organizationId && track.organizationId === organizationId),
      isCollaborator =
        (
          await db
            .select({ id: trackCollaborators.id })
            .from(trackCollaborators)
            .where(
              and(
                eq(trackCollaborators.trackId, trackId),
                eq(trackCollaborators.collaboratorUserId, user.id),
                inArray(trackCollaborators.invitationStatus, [
                  "accepted",
                  "pending",
                ])
              )
            )
            .limit(1)
        ).length > 0;

    if (!isOwner && !isCollaborator) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
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

    const { lyricsId, trackId } = c.req.valid("param"),
      body = c.req.valid("json"),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      db = createDb(),
      [track] = await db
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
        .returning(),
      [remainingApproved] =
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
              .limit(1),
      nextLyricsStatus = remainingApproved ? "approved" : "missing";

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
    path: "/{trackId}/playback",
    request: {
      params: z.object({ trackId: z.string() }),
      query: z.object({
        context: z.enum(["ordinary", "battle"]).default("ordinary"),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary" }),
          },
        },
        description: "Guarded SoundKit playback media",
      },
      [HttpStatusCodes.PARTIAL_CONTENT]: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary" }),
          },
        },
        description: "Partial guarded SoundKit playback media",
      },
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Playback access denied"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Playback media not ready"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Playback storage unavailable"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(databaseUnavailableMessage, HttpStatusCodes.NOT_FOUND);
    }

    const bucket = getMediaBucket(c.env as AppEnv["Bindings"]);
    if (!bucket) {
      return c.json(
        { message: "Playback storage is unavailable." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const { trackId } = c.req.valid("param"),
      { context } = c.req.valid("query"),
      currentUser = c.get("user"),
      db = createDb(),
      [track] = await db
        .select()
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);
    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const isAuthenticated = isAuthenticatedUser(currentUser),
      isOwner = isAuthenticated && track.ownerUserId === currentUser.id,
      [collaboratorAccess] = isAuthenticated
        ? await db
            .select({ id: trackCollaborators.id })
            .from(trackCollaborators)
            .where(
              and(
                eq(trackCollaborators.trackId, trackId),
                eq(trackCollaborators.collaboratorUserId, currentUser.id),
                eq(trackCollaborators.invitationStatus, "accepted")
              )
            )
            .limit(1)
        : [],
      canManageTrack = isOwner || Boolean(collaboratorAccess),
      hasPurchase = isAuthenticated
        ? await hasPurchasedTrack({ db, trackId, userId: currentUser.id })
        : false,
      entitlements = isAuthenticated
        ? await resolveEntitlements({
            session: isAuthenticatedSession(c.get("session"))
              ? c.get("session")
              : null,
            user: currentUser,
          })
        : null,
      access = resolveListeningAccess({
        hasPurchase,
        isPremium: entitlements?.isPremium ?? false,
        policy: track,
      });
    if (!(canManageTrack || (track.isPublic && access.canListen))) {
      return c.json(
        { message: "Playback access is not available for this track." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    let asset = await resolveTrackAsset({
      allowLegacyFallback: true,
      purpose: context === "battle" ? "battle" : "streaming",
      trackId,
    });
    if (!asset && canManageTrack && context === "ordinary") {
      asset = await resolveTrackAsset({ purpose: "master", trackId });
    }
    if (!asset?.objectKey) {
      return c.json(
        { message: "SoundKit playback media is still processing." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const head = await bucket.head(asset.objectKey);
    if (!head) {
      return c.json(
        { message: "Playback media is unavailable." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const requestedRange = c.req.header("range"),
      r2Range = buildR2Range(requestedRange, head.size),
      object = await bucket.get(asset.objectKey, {
        range: r2Range,
      });
    if (!object) {
      return c.json(
        { message: "Playback media is unavailable." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", object.httpEtag);
    // Guarded, auth-scoped playback must never sit in the public CDN edge
    // cache: cached 206 responses poison range requests across users and
    // deploys (stale Content-Range breaks audio decoding).
    headers.set("Cache-Control", "private, no-store");

    // Derive response range headers from what WE requested — the runtime's
    // object.range metadata is unreliable across R2 runtime versions.
    if (!r2Range) {
      headers.set("Content-Length", String(head.size));
      return new Response(object.body, {
        headers,
        status: HttpStatusCodes.OK,
      });
    }

    let rangeOffset: number;
    let rangeEnd: number;

    if ("suffix" in r2Range && typeof r2Range.suffix === "number") {
      rangeOffset = Math.max(0, head.size - r2Range.suffix);
      rangeEnd = head.size - 1;
    } else {
      const range = r2Range as { length?: number; offset?: number },
        length =
          typeof range.length === "number"
            ? range.length
            : head.size - (range.offset ?? 0);
      rangeOffset = typeof range.offset === "number" ? range.offset : 0;
      rangeEnd = Math.min(head.size - 1, rangeOffset + length - 1);
    }

    headers.set(
      "Content-Range",
      `bytes ${rangeOffset}-${rangeEnd}/${head.size}`
    );
    headers.set("Content-Length", String(rangeEnd - rangeOffset + 1));
    return new Response(object.body, {
      headers,
      status: HttpStatusCodes.PARTIAL_CONTENT,
    });
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{trackId}/assets/{assetId}/source",
    request: {
      params: z.object({ assetId: z.string(), trackId: z.string() }),
      query: z.object({
        expires: z.coerce.number().int().positive(),
        signature: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: {
        content: {
          "application/octet-stream": {
            schema: z.string().openapi({ format: "binary" }),
          },
        },
        description: "Short-lived signed source media",
      },
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Signed media access denied"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Source media not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Source storage unavailable"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { assetId, trackId } = c.req.valid("param"),
      { expires, signature } = c.req.valid("query"),
      authorized = await verifySignedMediaSource({
        assetId,
        expires,
        signature,
        trackId,
      });
    if (!authorized) {
      return c.json(
        { message: "Signed media access expired or is invalid." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json(databaseUnavailableMessage, HttpStatusCodes.NOT_FOUND);
    }
    const bucket = getMediaBucket(c.env as AppEnv["Bindings"]);
    if (!bucket) {
      return c.json(
        { message: "Source storage is unavailable." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const [asset] = await createDb()
      .select()
      .from(trackAssets)
      .where(and(eq(trackAssets.id, assetId), eq(trackAssets.trackId, trackId)))
      .limit(1);
    if (
      !asset?.objectKey ||
      (asset.status !== "ready" && asset.status !== "uploaded")
    ) {
      return c.json(
        { message: "Source media not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const object = await bucket.get(asset.objectKey);
    if (!object) {
      return c.json(
        { message: "Source media not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Length": String(object.size),
      "Content-Type": asset.mimeType ?? "application/octet-stream",
    });
    return new Response(object.body, { headers });
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

    const { assetId, trackId } = c.req.valid("param"),
      db = createDb(),
      [row] = await db
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

    const isOwner = row.track.ownerUserId === user.id,
      isPrivateSourceAsset =
        row.asset.purpose === "master" ||
        row.asset.purpose === "stem" ||
        row.asset.assetKind === "master" ||
        row.asset.assetKind === "vocal_stem" ||
        row.asset.assetKind === "stems" ||
        row.asset.assetKind === "session_file" ||
        row.asset.assetKind === "verse_vocal" ||
        row.asset.assetKind === "adlib" ||
        row.asset.assetKind === "reference_audio",
      hasPurchase = await hasPurchasedTrack({
        db,
        trackId,
        userId: user.id,
      });

    if (!isOwner) {
      if (isPrivateSourceAsset) {
        return c.json(
          { message: "This source asset is private to the track owner." },
          HttpStatusCodes.FORBIDDEN
        );
      }
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

    const object = await bucket.get(row.asset.objectKey),
      canonicalMediaUrl = (
        env as unknown as { MEDIA_CANONICAL_URL?: string }
      ).MEDIA_CANONICAL_URL?.replace(/\/+$/u, ""),
      canonicalResponse =
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

    const fileName = trackAssetDownloadFileName({
        asset: row.asset,
        trackTitle: row.track.title,
      }),
      headers = new Headers(canonicalResponse?.headers);
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

    const db = createDb(),
      currentUser = c.get("user");

    if (isAuthenticatedUser(currentUser)) {
      const session = c.get("session"),
        organizationId = await resolveActiveOrganizationId({
          session: isAuthenticatedSession(session) ? session : null,
          user: currentUser,
        }),
        [ownedTrack] = await db
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

      const [collaboratorRow] = await db
        .select({ id: trackCollaborators.id })
        .from(trackCollaborators)
        .where(
          and(
            eq(trackCollaborators.trackId, trackId),
            eq(trackCollaborators.collaboratorUserId, currentUser.id),
            inArray(trackCollaborators.invitationStatus, [
              "accepted",
              "pending",
            ])
          )
        )
        .limit(1);

      if (collaboratorRow) {
        const [collaboratedTrack] = await db
          .select()
          .from(tracks)
          .where(eq(tracks.id, trackId))
          .limit(1);
        if (collaboratedTrack) {
          return c.json(
            await buildTrackDetail(collaboratedTrack),
            HttpStatusCodes.OK
          );
        }
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

    const [roleRows, assetRows, licenseRows, creditRows] = await Promise.all([
        db
          .select({ role: artistProfileRoles.role })
          .from(artistProfileRoles)
          .where(eq(artistProfileRoles.userId, row.ownerUserId)),
        db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
        db
          .select()
          .from(trackLicenseOptions)
          .where(eq(trackLicenseOptions.trackId, row.id)),
        db
          .select({
            avatarUrl: userProfiles.avatarUrl,
            displayName: userProfiles.displayName,
            id: trackCollaborators.id,
            legalName: authUser.name,
            role: trackCollaborators.collaboratorRole,
            splitBps: trackCollaborators.creditSplitBps,
            username: userProfiles.username,
          })
          .from(trackCollaborators)
          .leftJoin(
            userProfiles,
            eq(userProfiles.userId, trackCollaborators.collaboratorUserId)
          )
          .leftJoin(
            authUser,
            eq(authUser.id, trackCollaborators.collaboratorUserId)
          )
          .where(
            and(
              eq(trackCollaborators.trackId, row.id),
              eq(trackCollaborators.invitationStatus, "accepted")
            )
          ),
      ]),
      isAuthenticated = isAuthenticatedUser(currentUser),
      entitlements = isAuthenticated
        ? await resolveEntitlements({
            session: isAuthenticatedSession(c.get("session"))
              ? c.get("session")
              : null,
            user: currentUser,
          })
        : null,
      hasPurchase = isAuthenticated
        ? await hasPurchasedTrack({
            db,
            trackId: row.id,
            userId: currentUser.id,
          })
        : false,
      access = resolveListeningAccess({
        hasPurchase,
        isPremium: entitlements?.isPremium ?? false,
        policy: row,
      }),
      isOwned = hasPurchase,
      roles: ("musician" | "producer")[] =
        roleRows.length > 0
          ? roleRows.map((roleRow) => roleRow.role)
          : ["musician"],
      coverAsset =
        assetRows.find(
          (asset) => asset.assetKind === "cover_art" && asset.status === "ready"
        ) ?? assetRows.find((asset) => asset.assetKind === "cover_art"),
      firstAudioAsset = resolveTrackAssetFromRows({
        allowLegacyFallback: true,
        assets: assetRows,
        purpose: "streaming",
        trackId: row.id,
      }),
      previewAsset = assetRows.find((asset) => {
        if (asset.assetKind !== "variant_audio") {
          return false;
        }

        return (
          typeof asset.metadata === "object" &&
          asset.metadata !== null &&
          "variant" in asset.metadata &&
          asset.metadata.variant === "preview_30s"
        );
      }),
      priceCents = priceCentsFromTrack({
        price: row.price,
        priceCents: row.priceCents,
      }),
      credits = {
        artists: creditRows.filter((entry) => entry.role === "artist"),
        engineers: creditRows.filter((entry) => entry.role === "engineer"),
        producers: creditRows.filter((entry) => entry.role === "producer"),
        vocalists: creditRows.filter((entry) => entry.role === "vocalist"),
        writers: creditRows.filter((entry) => entry.role === "songwriter"),
      },
      assets = assetRows
        .filter((asset) => catalogAssetKinds.has(asset.assetKind))
        .map((asset) => ({
          downloadUrl: `/v1/tracks/${row.id}/assets/${asset.id}/download`,
          duration: formatDuration(asset.durationMs),
          fileName: trackAssetDownloadFileName({
            asset,
            trackTitle: row.title,
          }),
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
        coverArtUrl: coverAsset
          ? (publicAssetUrl(coverAsset) ?? "/placeholder.svg")
          : "/placeholder.svg",
        credits,
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
        playbackUrl:
          access.canListen && firstAudioAsset
            ? guardedTrackPlaybackUrl(row.id)
            : null,
        previewUrl: publicAssetUrl(previewAsset),
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
    const { trackId } = c.req.valid("param"),
      user = c.get("user");

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
