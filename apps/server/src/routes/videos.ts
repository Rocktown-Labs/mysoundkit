/* eslint-disable one-var, sort-vars, complexity, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Mux } from "@mux/mux-node";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  muxUploads,
  playbackSessions,
  projectTracks,
  videoPreSaves,
  purchases,
  tracks,
  userProfiles,
  videoComments,
  videoViewSessions,
  videos,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { indexSearchEntity } from "@/lib/audio-processing";
import { resolveListeningAccess } from "@/lib/content-access";
import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { canonicalGenreName, canonicalGenreSlug } from "@/lib/genre-catalog";
import { notify } from "@/lib/notifications";
import { createTrackPlaybackSession } from "@/lib/playback-qualification";
import {
  genreSlugFromExploreFilter,
  profileRegionCondition,
  regionSlugFromUser,
} from "@/lib/public-explore";
import { sampleVideos } from "@/lib/sample-data";
import {
  createPlaybackSessionBodySchema,
  createVideoBodySchema,
  createVideoCommentBodySchema,
  directVideoUploadBodySchema,
  directVideoUploadResponseSchema,
  messageResponseSchema,
  playbackSessionResponseSchema,
  publicExploreQuerySchema,
  videoAnalyticsQuerySchema,
  videoAnalyticsSchema,
  videoViewSessionProgressBodySchema,
  videoViewSessionProgressResponseSchema,
  videoViewSessionResponseSchema,
  videoViewSessionStartBodySchema,
  videoCommentSchema,
  videoSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import {
  canManageVideo,
  filterSafeVideoLocations,
  MIN_VIDEO_LOCATION_VIEWERS,
  MIN_VIDEO_VIEW_SECONDS,
} from "@/lib/video-analytics";
import { videoPlaybackSourceType } from "@/lib/video-playback";
import { loadVideoSchemaCapabilities } from "@/lib/video-schema-capabilities";
import { resolveVideoThumbnailUrl } from "@/lib/video-thumbnails";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>(),
  sha256Hex = async (value: string) => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value)
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  },
  getRequestGeo = (request: Request) => {
    const { cf } = request as unknown as {
      cf?: {
        city?: string;
        country?: string;
        region?: string;
        regionCode?: string;
      };
    };

    return {
      city: cf?.city ?? request.headers.get("cf-ipcity"),
      countryCode:
        cf?.country ??
        request.headers.get("cf-ipcountry") ??
        request.headers.get("x-country-code"),
      regionCode:
        cf?.regionCode ??
        request.headers.get("cf-region-code") ??
        request.headers.get("x-region-code"),
      regionName:
        cf?.region ??
        request.headers.get("cf-region") ??
        request.headers.get("x-region"),
    };
  },
  emptyVideoAnalytics = (range: string, level: "country" | "region") => ({
    geography: {
      hasEnoughData: false,
      level,
      locations: [],
      totalViewers: 0,
    },
    range,
    summary: {
      averageWatchPercent: 0,
      completionRate: 0,
      totalWatchedSeconds: 0,
      uniqueViewers: 0,
      views: 0,
    },
    timeseries: [],
  }),
  getVideoRangeStart = (range: "7d" | "28d" | "90d" | "12m", now: Date) => {
    const start = new Date(now);
    if (range === "7d") {
      start.setUTCDate(start.getUTCDate() - 7);
    } else if (range === "28d") {
      start.setUTCDate(start.getUTCDate() - 28);
    } else if (range === "90d") {
      start.setUTCDate(start.getUTCDate() - 90);
    } else {
      start.setUTCFullYear(start.getUTCFullYear() - 1);
    }
    return start;
  };

const updateVideoViewSession = async ({
  db,
  durationSeconds,
  ended,
  playedSeconds,
  sessionId,
  token,
  videoId,
}: {
  db: ReturnType<typeof createDb>;
  durationSeconds?: number;
  ended: boolean;
  playedSeconds: number;
  sessionId: string;
  token: string;
  videoId: string;
}) => {
  const now = new Date(),
    tokenHash = await sha256Hex(token),
    updateSession = (includeDuration: boolean) =>
      db
        .update(videoViewSessions)
        .set({
          ...(includeDuration ? { durationSeconds } : {}),
          endedAt: ended ? now : undefined,
          lastHeartbeatAt: now,
          status: ended ? "ended" : "active",
          watchedSeconds: sql<number>`greatest(${videoViewSessions.watchedSeconds}, ${Math.floor(playedSeconds)})`,
        })
        .where(
          and(
            eq(videoViewSessions.id, sessionId),
            eq(videoViewSessions.sessionTokenHash, tokenHash),
            eq(videoViewSessions.videoId, videoId),
            or(
              eq(videoViewSessions.status, "started"),
              eq(videoViewSessions.status, "active")
            )
          )
        );

  const result =
    durationSeconds === undefined
      ? await updateSession(false)
      : await updateSession(true);

  return (result.rowCount ?? 0) > 0;
};

app.post("/:videoId/pre-save", async (c) => {
  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.json({ message: "Authentication is required." }, 401);
  }
  const videoId = c.req.param("videoId");
  if (isDatabaseConfigured()) {
    await createDb()
      .insert(videoPreSaves)
      .values({
        userId: user.id,
        videoId,
      })
      .onConflictDoNothing();
  }
  return c.json({ isPreSaved: true, videoId }, 200);
});

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
  getMuxClient = () => {
    if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
      return null;
    }

    return new Mux({
      tokenId: env.MUX_TOKEN_ID,
      tokenSecret: env.MUX_TOKEN_SECRET,
    });
  },
  legacyVideoViewCount = sql<number>`(
  select count(*)::int
  from ${playbackSessions}
  where ${playbackSessions.sourceType} = ${videoPlaybackSourceType}
    and ${playbackSessions.sourceId} = ${videos.id}
)`,
  videoViewQualificationCondition = sql`
  ${videoViewSessions.watchedSeconds} >= least(
    ${MIN_VIDEO_VIEW_SECONDS},
    coalesce(${videoViewSessions.durationSeconds}, ${MIN_VIDEO_VIEW_SECONDS})
  )`,
  videoViewSessionCount = sql<number>`(
  select count(*)::int
  from ${videoViewSessions}
  where ${videoViewSessions.videoId} = ${videos.id}
    and ${videoViewQualificationCondition}
)`,
  publicVideoOrderBy = (sort?: string, viewCount = legacyVideoViewCount) => {
    if (sort === "title-asc") {
      return asc(videos.title);
    }

    if (sort === "title-desc") {
      return desc(videos.title);
    }

    if (sort === "views-asc") {
      return asc(viewCount);
    }

    return desc(viewCount);
  },
  getSampleVideoFallback = (
    videoId?: string
  ): (typeof sampleVideos)[number] => {
    const fallback =
      sampleVideos.find((entry) => entry.id === videoId) ?? sampleVideos[0];

    if (!fallback) {
      throw new Error("Sample video fallback is missing.");
    }

    return fallback;
  },
  formatVideoDuration = (durationMs?: number | null) => {
    if (!durationMs) {
      return "0:00";
    }

    const minutes = Math.floor(durationMs / 60_000),
      seconds = Math.round((durationMs % 60_000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },
  resolveVideoGenreId = async (
    db: ReturnType<typeof createDb>,
    genre?: string
  ) => {
    if (!genre) {
      return null;
    }

    const genreSlug = canonicalGenreSlug(genre),
      [genreRow] = await db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, genreSlug))
        .limit(1);

    if (genreRow) {
      return genreRow.id;
    }

    const genreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: genreId,
      name: canonicalGenreName(genre),
      slug: genreSlug,
    });

    return genreId;
  };

interface VideoMapInput {
  creatorAvatarUrl?: string | null;
  creatorName?: string;
  creatorUsername?: string | null;
  description?: string | null;
  duration?: string;
  durationMs?: number | null;
  externalPlaybackUrl?: string | null;
  genre?: string | null;
  id: string;
  muxPlaybackId?: string | null;
  playbackPolicy?: "public" | "signed";
  releaseAt?: string | Date | null;
  slug?: string | null;
  sourceProjectId?: string | null;
  sourceProvider?: "external" | "mux";
  sourceTrackId?: string | null;
  status?: string;
  thumbnailUrl?: string | null;
  title: string;
  verifiedOnPlatform?: boolean;
  videoKind?:
    | "music_video"
    | "promo"
    | "teaser"
    | "battle_replay"
    | "battle_clip"
    | "live_recording";
  viewCount?: string;
}

const mapVideo = (video: VideoMapInput) => ({
  creatorAvatarUrl: video.creatorAvatarUrl ?? null,
  creatorName: video.creatorName,
  creatorUsername: video.creatorUsername ?? null,
  description: video.description ?? null,
  duration: video.duration ?? formatVideoDuration(video.durationMs ?? null),
  externalPlaybackUrl: video.externalPlaybackUrl ?? null,
  genre: video.genre ?? null,
  id: video.id,
  muxPlaybackId: video.muxPlaybackId ?? null,
  playbackPolicy: video.playbackPolicy ?? "public",
  releaseAt: video.releaseAt ? new Date(video.releaseAt).toISOString() : null,
  slug: video.slug ?? null,
  sourceProjectId: video.sourceProjectId ?? null,
  sourceProvider: video.sourceProvider ?? "mux",
  sourceTrackId: video.sourceTrackId ?? null,
  status: video.status ?? "ready",
  thumbnailUrl: resolveVideoThumbnailUrl({
    externalPlaybackUrl: video.externalPlaybackUrl,
    muxPlaybackId: video.muxPlaybackId,
    thumbnailUrl: video.thumbnailUrl,
  }),
  title: video.title,
  verifiedOnPlatform: video.verifiedOnPlatform ?? false,
  videoKind: video.videoKind ?? "music_video",
  viewCount: video.viewCount ?? "0",
});

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: publicExploreQuerySchema.partial() },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoSummarySchema.array(),
        "Videos list"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required for dashboard videos"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const query = c.req.valid("query"),
      user = c.get("user"),
      scope =
        query.scope ?? (isAuthenticatedUser(user) ? "dashboard" : "public");

    if (!isDatabaseConfigured()) {
      return c.json(
        sampleVideos.map(mapVideo).slice(0, query.limit ?? 24),
        HttpStatusCodes.OK
      );
    }

    if (query.scope === "dashboard" && !isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const userId = isAuthenticatedUser(user) ? user.id : "",
      db = createDb(),
      capabilities = await loadVideoSchemaCapabilities(),
      session = c.get("session"),
      organizationId =
        scope === "dashboard" && isAuthenticatedUser(user)
          ? await resolveActiveOrganizationId({
              session: isAuthenticatedSession(session) ? session : null,
              user,
            })
          : null,
      genreSlug =
        scope === "public" ? genreSlugFromExploreFilter(query.genre) : null,
      regionCondition =
        scope === "public" ? profileRegionCondition(query) : undefined,
      conditions =
        scope === "dashboard"
          ? [
              organizationId
                ? or(
                    eq(videos.ownerUserId, userId),
                    eq(videos.organizationId, organizationId)
                  )
                : eq(videos.ownerUserId, userId),
            ]
          : [
              eq(videos.isPublic, true),
              sql`(${videos.releaseAt} is null or ${videos.releaseAt} <= now())`,
            ];

    if (genreSlug) {
      conditions.push(
        sql`(${videos.genreId} in (
          select id from genres where slug = ${genreSlug}
        ) or ${videos.sourceTrackId} in (
          select id from tracks
          where genre_id in (select id from genres where slug = ${genreSlug})
        ))`
      );
    }

    if (regionCondition) {
      conditions.push(regionCondition);
    }

    const limit = query.limit ?? 24,
      page = query.page ?? 1,
      offset = (page - 1) * limit,
      viewCount = capabilities.viewSessions
        ? videoViewSessionCount
        : legacyVideoViewCount,
      order = publicVideoOrderBy(query.sort, viewCount),
      rows = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          name: authUser.name,
          state: userProfiles.state,
          username: userProfiles.username,
          video: videos,
          viewCount,
        })
        .from(videos)
        .leftJoin(userProfiles, eq(userProfiles.userId, videos.ownerUserId))
        .leftJoin(authUser, eq(authUser.id, videos.ownerUserId))
        .where(and(...conditions))
        .orderBy(order)
        .limit(limit)
        .offset(offset);

    return c.json(
      rows.map((row) => ({
        ...mapVideo(row.video),
        creatorAvatarUrl: row.avatarUrl ?? null,
        creatorName: row.displayName ?? row.name ?? "SoundKit Artist",
        creatorUsername: row.username ?? null,
        regionSlug: regionSlugFromUser(row.state) ?? null,
        viewCount: String(row.viewCount ?? 0),
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(createVideoBodySchema, "Video create payload"),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        videoSummarySchema,
        "Video created"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium artist access required"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Videos"],
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
        mapVideo({
          externalPlaybackUrl: body.externalPlaybackUrl ?? null,
          id: "video_new",
          muxPlaybackId: null,
          playbackPolicy: body.playbackPolicy,
          sourceProjectId: body.sourceProjectId ?? null,
          sourceProvider: body.sourceProvider,
          sourceTrackId: body.sourceTrackId ?? null,
          status: body.sourceProvider === "mux" ? "pending" : "ready",
          title: body.title,
          verifiedOnPlatform: body.sourceProvider === "mux",
          videoKind: body.videoKind,
        }),
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb(),
      videoId = crypto.randomUUID(),
      genreId = await resolveVideoGenreId(db, body.genre),
      releaseAt = body.releaseAt ? new Date(body.releaseAt) : null,
      publishedAt = releaseAt ?? (body.isPublic ? new Date() : null),
      [video] = await db
        .insert(videos)
        .values({
          description: body.description,
          externalPlaybackUrl:
            body.sourceProvider === "external"
              ? (body.externalPlaybackUrl ?? null)
              : null,
          genreId,
          id: videoId,
          isPublic: body.isPublic && !releaseAt,
          organizationId: isAuthenticatedSession(session)
            ? (session.activeOrganizationId ?? null)
            : null,
          ownerUserId: user.id,
          playbackPolicy: body.playbackPolicy,
          publishedAt,
          releaseAt,
          slug: uniqueSlug(body.title),
          sourceProjectId: body.sourceProjectId ?? null,
          sourceProvider: body.sourceProvider,
          sourceTrackId: body.sourceTrackId ?? null,
          status: body.sourceProvider === "external" ? "ready" : "pending",
          thumbnailUrl:
            body.sourceProvider === "external"
              ? resolveVideoThumbnailUrl({
                  externalPlaybackUrl: body.externalPlaybackUrl,
                })
              : null,
          title: body.title,
          verifiedOnPlatform: body.sourceProvider === "mux",
          videoKind: body.videoKind,
        })
        .returning();

    if (video) {
      await indexSearchEntity({
        entityId: video.id,
        entityType: "video",
        organizationId: video.organizationId,
        text: [video.title, video.description].filter(Boolean).join("\n"),
      });
    }

    return c.json(
      mapVideo(video ?? getSampleVideoFallback()),
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/direct-upload",
    request: {
      body: jsonContentRequired(
        directVideoUploadBodySchema,
        "Mux direct upload payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        directVideoUploadResponseSchema,
        "Mux direct upload created"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium artist access required"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Video upload service unavailable"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database configuration is required for direct uploads." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const session = c.get("session"),
      body = c.req.valid("json"),
      db = createDb(),
      videoId = crypto.randomUUID(),
      mux = getMuxClient(),
      genreId = await resolveVideoGenreId(db, body.genre),
      releaseAt = body.releaseAt ? new Date(body.releaseAt) : null,
      publishedAt = releaseAt ?? (body.isPublic ? new Date() : null);

    if (!mux) {
      if (isDatabaseConfigured()) {
        await db.insert(videos).values({
          description: body.description ?? null,
          genreId,
          id: videoId,
          isPublic: body.isPublic && !releaseAt,
          organizationId: isAuthenticatedSession(session)
            ? (session.activeOrganizationId ?? null)
            : null,
          ownerUserId: user.id,
          playbackPolicy: body.playbackPolicy,
          publishedAt,
          releaseAt,
          slug: uniqueSlug(body.title),
          sourceProjectId: body.sourceProjectId ?? null,
          sourceProvider: "external",
          sourceTrackId: body.sourceTrackId ?? null,
          status: "ready",
          title: body.title,
          verifiedOnPlatform: true,
          videoKind: body.videoKind,
        });
      }
      return c.json(
        {
          status: "ready" as const,
          uploadId: videoId,
          uploadUrl: "",
          videoId,
        },
        HttpStatusCodes.CREATED
      );
    }

    const passthrough = videoId,
      upload = await mux.video.uploads.create({
        cors_origin: env.CORS_ORIGIN,
        new_asset_settings: {
          meta: {
            creator_id: user.id,
            external_id: videoId,
            title: body.title,
          },
          normalize_audio: true,
          passthrough,
          playback_policies: [body.playbackPolicy],
          video_quality: "basic",
        },
        timeout: 60 * 60,
      });

    await db.insert(videos).values({
      description: body.description,
      genreId,
      id: videoId,
      isPublic: body.isPublic && !releaseAt,
      muxPassthrough: passthrough,
      muxUploadId: upload.id,
      organizationId: isAuthenticatedSession(session)
        ? (session.activeOrganizationId ?? null)
        : null,
      ownerUserId: user.id,
      playbackPolicy: body.playbackPolicy,
      publishedAt,
      releaseAt,
      slug: uniqueSlug(body.title),
      sourceProjectId: body.sourceProjectId ?? null,
      sourceProvider: "mux",
      sourceTrackId: body.sourceTrackId ?? null,
      status: "uploading",
      title: body.title,
      verifiedOnPlatform: true,
      videoKind: body.videoKind,
    });
    await db
      .insert(muxUploads)
      .values({
        muxUploadId: upload.id,
        status: "waiting",
        timeoutSeconds: 60 * 60,
        videoId,
      })
      .onConflictDoUpdate({
        set: {
          status: "waiting",
          timeoutSeconds: 60 * 60,
          videoId,
        },
        target: muxUploads.muxUploadId,
      });

    return c.json(
      {
        status: "uploading" as const,
        uploadId: upload.id,
        uploadUrl: upload.url,
        videoId,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{videoId}/analytics",
    request: {
      params: z.object({ videoId: z.string() }),
      query: videoAnalyticsQuerySchema,
    },
    responses: {
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Video ownership required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Video not found"
      ),
      [HttpStatusCodes.OK]: jsonContent(
        videoAnalyticsSchema,
        "Video analytics"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { range } = c.req.valid("query"),
      { videoId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(emptyVideoAnalytics(range, "country"), HttpStatusCodes.OK);
    }

    const db = createDb(),
      session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      [video] = await db
        .select({
          organizationId: videos.organizationId,
          ownerUserId: videos.ownerUserId,
        })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

    if (!video) {
      return c.json({ message: "Video not found." }, HttpStatusCodes.NOT_FOUND);
    }

    if (
      !canManageVideo({
        activeOrganizationId: organizationId,
        organizationId: video.organizationId,
        ownerUserId: video.ownerUserId,
        userId: user.id,
      })
    ) {
      return c.json(
        forbiddenMessage("You can only view analytics for your own videos."),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      level: "region" | "country" = entitlements.isPremium
        ? "region"
        : "country",
      capabilities = await loadVideoSchemaCapabilities();

    if (!capabilities.viewSessions) {
      return c.json(emptyVideoAnalytics(range, level), HttpStatusCodes.OK);
    }

    const now = new Date(),
      startDate = getVideoRangeStart(range, now),
      qualifiedViewCondition = videoViewQualificationCondition,
      [summaryRow] = await db
        .select({
          averageWatchPercent: sql<number>`coalesce(avg(case when ${qualifiedViewCondition} and ${videoViewSessions.durationSeconds} > 0 then least((${videoViewSessions.watchedSeconds}::numeric / nullif(${videoViewSessions.durationSeconds}, 0)) * 100, 100) end), 0)::float`,
          completionRate: sql<number>`coalesce((count(*) filter (where ${qualifiedViewCondition} and ${videoViewSessions.durationSeconds} > 0 and ${videoViewSessions.watchedSeconds} >= ${videoViewSessions.durationSeconds} * 0.9))::numeric / nullif(count(*) filter (where ${qualifiedViewCondition}), 0) * 100, 0)::float`,
          totalWatchedSeconds: sql<number>`coalesce(sum(${videoViewSessions.watchedSeconds}) filter (where ${qualifiedViewCondition}), 0)::int`,
          uniqueViewers: sql<number>`count(distinct ${videoViewSessions.viewerKey}) filter (where ${qualifiedViewCondition})::int`,
          views: sql<number>`count(*) filter (where ${qualifiedViewCondition})::int`,
        })
        .from(videoViewSessions)
        .where(
          and(
            eq(videoViewSessions.videoId, videoId),
            gte(videoViewSessions.startedAt, startDate)
          )
        ),
      uniqueViewers = Number(summaryRow?.uniqueViewers ?? 0),
      dateFormat = range === "12m" ? "YYYY-MM" : "YYYY-MM-DD",
      dateMap = new Map<
        string,
        { uniqueViewers: number; views: number; watchedSeconds: number }
      >();

    if (range === "12m") {
      for (let index = 11; index >= 0; index -= 1) {
        const date = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)
        );
        dateMap.set(date.toISOString().slice(0, 7), {
          uniqueViewers: 0,
          views: 0,
          watchedSeconds: 0,
        });
      }
    } else {
      let days = 90;
      if (range === "7d") {
        days = 7;
      } else if (range === "28d") {
        days = 28;
      }

      for (let index = days - 1; index >= 0; index -= 1) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - index);
        dateMap.set(date.toISOString().slice(0, 10), {
          uniqueViewers: 0,
          views: 0,
          watchedSeconds: 0,
        });
      }
    }

    const dateKey = sql<string>`to_char(${videoViewSessions.startedAt}, ${dateFormat})`,
      timeseriesRows = await db
        .select({
          dateKey,
          uniqueViewers: sql<number>`count(distinct ${videoViewSessions.viewerKey}) filter (where ${qualifiedViewCondition})::int`,
          views: sql<number>`count(*) filter (where ${qualifiedViewCondition})::int`,
          watchedSeconds: sql<number>`coalesce(sum(${videoViewSessions.watchedSeconds}) filter (where ${qualifiedViewCondition}), 0)::int`,
        })
        .from(videoViewSessions)
        .where(
          and(
            eq(videoViewSessions.videoId, videoId),
            gte(videoViewSessions.startedAt, startDate)
          )
        )
        .groupBy(dateKey);

    for (const row of timeseriesRows) {
      if (dateMap.has(row.dateKey)) {
        dateMap.set(row.dateKey, {
          uniqueViewers: Number(row.uniqueViewers),
          views: Number(row.views),
          watchedSeconds: Number(row.watchedSeconds),
        });
      }
    }

    const timeseries = [...dateMap.entries()].map(([date, values]) => {
      const dateValue =
        range === "12m"
          ? new Date(`${date}-01T00:00:00.000Z`)
          : new Date(`${date}T00:00:00.000Z`);
      return {
        date,
        label: dateValue.toLocaleDateString("en-US", {
          day: range === "12m" ? undefined : "numeric",
          month: "short",
        }),
        ...values,
      };
    });

    const locationRows =
        level === "region"
          ? await db
              .select({
                countryCode: videoViewSessions.countryCode,
                regionCode: videoViewSessions.regionCode,
                regionName: videoViewSessions.regionName,
                viewers: sql<number>`count(distinct ${videoViewSessions.viewerKey}) filter (where ${qualifiedViewCondition})::int`,
              })
              .from(videoViewSessions)
              .where(
                and(
                  eq(videoViewSessions.videoId, videoId),
                  gte(videoViewSessions.startedAt, startDate)
                )
              )
              .groupBy(
                videoViewSessions.countryCode,
                videoViewSessions.regionCode,
                videoViewSessions.regionName
              )
          : await db
              .select({
                countryCode: videoViewSessions.countryCode,
                regionCode: sql<string | null>`null`,
                regionName: sql<string | null>`null`,
                viewers: sql<number>`count(distinct ${videoViewSessions.viewerKey}) filter (where ${qualifiedViewCondition})::int`,
              })
              .from(videoViewSessions)
              .where(
                and(
                  eq(videoViewSessions.videoId, videoId),
                  gte(videoViewSessions.startedAt, startDate)
                )
              )
              .groupBy(videoViewSessions.countryCode),
      safeLocations = filterSafeVideoLocations(
        locationRows.map((row) => ({
          countryCode: row.countryCode,
          regionCode: row.regionCode,
          regionName: row.regionName,
          viewers: Number(row.viewers),
        })),
        uniqueViewers,
        level,
        MIN_VIDEO_LOCATION_VIEWERS
      );

    return c.json(
      {
        geography: {
          hasEnoughData: safeLocations.hasEnoughData,
          level,
          locations: safeLocations.locations,
          totalViewers: uniqueViewers,
        },
        range,
        summary: {
          averageWatchPercent: Number(summaryRow?.averageWatchPercent ?? 0),
          completionRate: Number(summaryRow?.completionRate ?? 0),
          totalWatchedSeconds: Number(summaryRow?.totalWatchedSeconds ?? 0),
          uniqueViewers,
          views: Number(summaryRow?.views ?? 0),
        },
        timeseries,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{videoId}/view-sessions",
    request: {
      body: jsonContentRequired(
        videoViewSessionStartBodySchema,
        "Video view session payload"
      ),
      params: z.object({ videoId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        videoViewSessionResponseSchema,
        "Video view session"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Video not found"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const { videoId } = c.req.valid("param"),
      body = c.req.valid("json"),
      user = c.get("user");

    if (!isDatabaseConfigured()) {
      return c.json(
        { id: crypto.randomUUID(), token: crypto.randomUUID() },
        HttpStatusCodes.CREATED
      );
    }

    const capabilities = await loadVideoSchemaCapabilities();
    if (!capabilities.viewSessions) {
      return c.json(
        { id: crypto.randomUUID(), token: crypto.randomUUID() },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb(),
      [video] = await db
        .select({
          isPublic: videos.isPublic,
          ownerUserId: videos.ownerUserId,
          releaseAt: videos.releaseAt,
        })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

    if (!video) {
      return c.json({ message: "Video not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const isOwner = isAuthenticatedUser(user) && video.ownerUserId === user.id,
      isReleased = Boolean(
        video.isPublic && (!video.releaseAt || video.releaseAt <= new Date())
      );

    if (!(isReleased || isOwner)) {
      return c.json({ message: "Video not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const anonymousId = body.anonymousId ?? crypto.randomUUID(),
      viewerKey = await sha256Hex(
        `video:${videoId}:${isAuthenticatedUser(user) ? `user:${user.id}` : `anonymous:${anonymousId}`}`
      ),
      token = crypto.randomUUID(),
      id = crypto.randomUUID(),
      geo = getRequestGeo(c.req.raw);

    await db.insert(videoViewSessions).values({
      city: geo.city?.trim() || null,
      countryCode: geo.countryCode?.trim().toUpperCase() || null,
      durationSeconds: body.durationSeconds ?? null,
      id,
      lastHeartbeatAt: new Date(),
      regionCode: geo.regionCode?.trim().toUpperCase() || null,
      regionName: geo.regionName?.trim() || null,
      sessionTokenHash: await sha256Hex(token),
      startedAt: new Date(),
      status: "started",
      videoId,
      viewerKey,
      viewerUserId: isAuthenticatedUser(user) ? user.id : null,
    });

    return c.json({ id, token }, HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{videoId}/view-sessions/{sessionId}/progress",
    request: {
      body: jsonContentRequired(
        videoViewSessionProgressBodySchema,
        "Video view progress payload"
      ),
      params: z.object({ sessionId: z.string(), videoId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoViewSessionProgressResponseSchema,
        "Video view progress"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const { sessionId, videoId } = c.req.valid("param"),
      body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json({ updated: false }, HttpStatusCodes.OK);
    }

    const capabilities = await loadVideoSchemaCapabilities();
    if (!capabilities.viewSessions) {
      return c.json({ updated: false }, HttpStatusCodes.OK);
    }

    const updated = await updateVideoViewSession({
      db: createDb(),
      durationSeconds: body.durationSeconds,
      ended: body.ended,
      playedSeconds: body.playedSeconds,
      sessionId,
      token: body.token,
      videoId,
    });

    return c.json({ updated }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{videoId}/view-sessions/{sessionId}/end",
    request: {
      body: jsonContentRequired(
        videoViewSessionProgressBodySchema,
        "Video view end payload"
      ),
      params: z.object({ sessionId: z.string(), videoId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoViewSessionProgressResponseSchema,
        "Video view end"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const { sessionId, videoId } = c.req.valid("param"),
      body = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json({ updated: false }, HttpStatusCodes.OK);
    }

    const capabilities = await loadVideoSchemaCapabilities();
    if (!capabilities.viewSessions) {
      return c.json({ updated: false }, HttpStatusCodes.OK);
    }

    const updated = await updateVideoViewSession({
      db: createDb(),
      durationSeconds: body.durationSeconds,
      ended: true,
      playedSeconds: body.playedSeconds,
      sessionId,
      token: body.token,
      videoId,
    });

    return c.json({ updated }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{videoId}",
    request: {
      params: z.object({
        videoId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoSummarySchema,
        "Video detail summary"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const { videoId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        mapVideo(getSampleVideoFallback(videoId)),
        HttpStatusCodes.OK
      );
    }

    const user = c.get("user"),
      session = c.get("session"),
      db = createDb(),
      organizationId = isAuthenticatedUser(user)
        ? await resolveActiveOrganizationId({
            session: isAuthenticatedSession(session) ? session : null,
            user,
          })
        : null,
      [video] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          genreName: genres.name,
          name: authUser.name,
          organizationId: videos.organizationId,
          ownerUserId: videos.ownerUserId,
          state: userProfiles.state,
          username: userProfiles.username,
          video: videos,
        })
        .from(videos)
        .leftJoin(userProfiles, eq(userProfiles.userId, videos.ownerUserId))
        .leftJoin(authUser, eq(authUser.id, videos.ownerUserId))
        .leftJoin(genres, eq(genres.id, videos.genreId))
        .where(or(eq(videos.id, videoId), eq(videos.slug, videoId)))
        .limit(1);

    if (!video) {
      return c.json(
        mapVideo(getSampleVideoFallback(videoId)),
        HttpStatusCodes.OK
      );
    }

    const ownerAccess =
      isAuthenticatedUser(user) &&
      canManageVideo({
        activeOrganizationId: organizationId,
        organizationId: video.organizationId,
        ownerUserId: video.ownerUserId,
        userId: user.id,
      });

    if (
      !ownerAccess &&
      (video.video.isPublic === false ||
        (video.video.releaseAt !== null && video.video.releaseAt > new Date()))
    ) {
      return c.json(
        mapVideo(getSampleVideoFallback(videoId)),
        HttpStatusCodes.OK
      );
    }

    return c.json(
      {
        ...mapVideo(video.video),
        creatorAvatarUrl: video.avatarUrl ?? null,
        creatorName: video.displayName ?? video.name ?? "SoundKit Artist",
        creatorUsername: video.username ?? null,
        genre: video.genreName ? canonicalGenreName(video.genreName) : null,
        regionSlug: regionSlugFromUser(video.state) ?? null,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{videoId}/comments",
    request: {
      params: z.object({
        videoId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        videoCommentSchema.array(),
        "Video comments"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const { videoId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      rows = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          body: videoComments.body,
          createdAt: videoComments.createdAt,
          displayName: userProfiles.displayName,
          id: videoComments.id,
          userId: videoComments.userId,
          username: userProfiles.username,
        })
        .from(videoComments)
        .leftJoin(userProfiles, eq(userProfiles.userId, videoComments.userId))
        .where(eq(videoComments.videoId, videoId))
        .orderBy(asc(videoComments.createdAt), asc(videoComments.id));

    return c.json(
      rows.map((row) => ({
        authorAvatarUrl: row.avatarUrl,
        authorName: row.displayName ?? row.username ?? "SoundKit User",
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        userId: row.userId,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{videoId}/comments",
    request: {
      body: jsonContentRequired(
        createVideoCommentBodySchema,
        "Comment create payload"
      ),
      params: z.object({
        videoId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Comment could not be persisted"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.CREATED]: jsonContent(
        videoCommentSchema,
        "Comment created"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const session = c.get("session"),
      currentUser = c.get("user");

    if (!isAuthenticatedSession(session) || !isAuthenticatedUser(currentUser)) {
      return c.json(
        forbiddenMessage("Authentication is required."),
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const { videoId } = c.req.valid("param"),
      commentInput = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          authorAvatarUrl: null,
          authorName: null,
          body: commentInput.body,
          createdAt: new Date().toISOString(),
          id: `comment_${Date.now()}`,
          userId: currentUser.id,
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb(),
      commentId = commentInput.clientCommentId ?? crypto.randomUUID(),
      [createdComment] = await db
        .insert(videoComments)
        .values({
          body: commentInput.body,
          id: commentId,
          userId: currentUser.id,
          videoId,
        })
        .onConflictDoNothing()
        .returning(),
      [storedComment] = await db
        .select()
        .from(videoComments)
        .where(
          and(
            eq(videoComments.id, commentId),
            eq(videoComments.userId, currentUser.id),
            eq(videoComments.videoId, videoId)
          )
        )
        .limit(1);

    if (!storedComment) {
      return c.json(
        { message: "Unable to persist comment." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [[author], [video]] = await Promise.all([
      db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(eq(userProfiles.userId, currentUser.id))
        .limit(1),
      db
        .select({
          ownerUserId: videos.ownerUserId,
          title: videos.title,
        })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1),
    ]);

    if (video && createdComment) {
      await notify(
        {
          actorUserId: currentUser.id,
          aggregationKey: `video_comments:${videoId}`,
          data: {
            actorName:
              author?.displayName ??
              author?.username ??
              currentUser.name ??
              "Someone",
            commentId,
            commentPreview: storedComment.body,
            videoId,
            videoTitle: video.title,
          },
          entity: { id: videoId, type: "video" },
          eventId: commentId,
          recipientUserId: video.ownerUserId,
          type: "video.comment.created",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    return c.json(
      {
        authorAvatarUrl: author?.avatarUrl ?? null,
        authorName: author?.displayName ?? author?.username ?? null,
        body: storedComment.body,
        createdAt: storedComment.createdAt.toISOString(),
        id: storedComment.id,
        userId: storedComment.userId,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{videoId}",
    request: {
      params: z.object({
        videoId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(messageResponseSchema, "Video deleted"),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Ownership required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Video not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { videoId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Video deleted." }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

    if (!video) {
      return c.json({ message: "Video not found." }, HttpStatusCodes.NOT_FOUND);
    }

    if (video.ownerUserId !== user.id) {
      return c.json(
        forbiddenMessage("You can only delete your own videos."),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const mux = getMuxClient();

    if (mux) {
      if (video.muxAssetId) {
        await mux.video.assets.delete(video.muxAssetId).catch(() => null);
      } else if (video.muxUploadId) {
        await mux.video.uploads.cancel(video.muxUploadId).catch(() => null);
      }
    }

    await db.delete(videos).where(eq(videos.id, videoId));

    return c.json({ message: "Video deleted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{videoId}/playback-sessions",
    request: {
      body: jsonContentRequired(
        createPlaybackSessionBodySchema,
        "Video playback session payload"
      ),
      params: z.object({ videoId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        playbackSessionResponseSchema,
        "Video playback session"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Premium access or a purchase is required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Video not found"
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
    tags: ["Videos"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const { videoId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [video] = await db
        .select({
          isPublic: videos.isPublic,
          releaseAt: videos.releaseAt,
          sourceTrackId: videos.sourceTrackId,
        })
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

    if (
      !video ||
      !video.isPublic ||
      (video.releaseAt && video.releaseAt > new Date())
    ) {
      return c.json({ message: "Video not found." }, HttpStatusCodes.NOT_FOUND);
    }

    if (!video.sourceTrackId) {
      return c.json(
        { canQualify: false, durationSeconds: null, id: crypto.randomUUID() },
        HttpStatusCodes.CREATED
      );
    }

    const [trackPolicy] = await db
        .select({
          exclusiveUntil: tracks.exclusiveUntil,
          isForSale: tracks.isForSale,
          listeningAccess: tracks.listeningAccess,
        })
        .from(tracks)
        .where(eq(tracks.id, video.sourceTrackId))
        .limit(1),
      session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      hasPurchase = await hasPurchasedTrack({
        db,
        trackId: video.sourceTrackId,
        userId: user.id,
      }),
      access = trackPolicy
        ? resolveListeningAccess({
            hasPurchase,
            isPremium: entitlements.isPremium,
            policy: trackPolicy,
          })
        : { canListen: false };

    if (!access.canListen) {
      return c.json(
        { message: "Premium access or a purchase is required to watch." },
        HttpStatusCodes.FORBIDDEN
      );
    }

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
        sourceId: videoId,
        sourceType: videoPlaybackSourceType,
        trackId: video.sourceTrackId,
      },
    });

    return c.json(
      playbackSession ?? {
        canQualify: false,
        durationSeconds: null,
        id: crypto.randomUUID(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
