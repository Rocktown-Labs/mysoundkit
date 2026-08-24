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
  videos,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
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
  videoCommentSchema,
  videoSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { videoPlaybackSourceType } from "@/lib/video-playback";
import { resolveVideoThumbnailUrl } from "@/lib/video-thumbnails";
import { uniqueSlug } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

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
  videoViewCount = sql<number>`(
  select count(*)::int
  from ${playbackSessions}
  where ${playbackSessions.sourceType} = ${videoPlaybackSourceType}
    and ${playbackSessions.sourceId} = ${videos.id}
)`,
  publicVideoOrderBy = (sort?: string) => {
    if (sort === "title-asc") {
      return asc(videos.title);
    }

    if (sort === "title-desc") {
      return desc(videos.title);
    }

    if (sort === "views-asc") {
      return asc(videoViewCount);
    }

    return desc(videoViewCount);
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
    },
    tags: ["Videos"],
  }),
  async (c) => {
    const query = c.req.valid("query");

    if (!isDatabaseConfigured()) {
      return c.json(
        sampleVideos.map(mapVideo).slice(0, query.limit ?? 24),
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      genreSlug = genreSlugFromExploreFilter(query.genre),
      regionCondition = profileRegionCondition(query),
      publicVideoConditions = [
        eq(videos.isPublic, true),
        sql`(${videos.releaseAt} is null or ${videos.releaseAt} <= now())`,
      ];

    if (genreSlug) {
      publicVideoConditions.push(
        sql`(${videos.genreId} in (
          select id from genres where slug = ${genreSlug}
        ) or ${videos.sourceTrackId} in (
          select id from tracks
          where genre_id in (select id from genres where slug = ${genreSlug})
        ))`
      );
    }

    if (regionCondition) {
      publicVideoConditions.push(regionCondition);
    }

    const limit = query.limit ?? 24,
      page = query.page ?? 1,
      offset = (page - 1) * limit,
      order = publicVideoOrderBy(query.sort),
      rows = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          name: authUser.name,
          state: userProfiles.state,
          username: userProfiles.username,
          video: videos,
        })
        .from(videos)
        .leftJoin(userProfiles, eq(userProfiles.userId, videos.ownerUserId))
        .leftJoin(authUser, eq(authUser.id, videos.ownerUserId))
        .where(and(...publicVideoConditions))
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
      session = c.get("session"),
      entitlements = await resolveEntitlements({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      });

    if (body.sourceProvider === "mux" && !entitlements.isPremium) {
      return c.json(
        forbiddenMessage(
          "A premium artist subscription is required to upload official music videos."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

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

    const db = createDb(),
      [video] = await db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          genreName: genres.name,
          name: authUser.name,
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

    if (
      !video ||
      (video.video.isPublic === false && video.video.releaseAt === null)
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
        .orderBy(asc(videoComments.createdAt));

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
      { body } = c.req.valid("json");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          authorAvatarUrl: null,
          authorName: null,
          body,
          createdAt: new Date().toISOString(),
          id: `comment_${Date.now()}`,
          userId: currentUser.id,
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb(),
      commentId = crypto.randomUUID();
    await db.insert(videoComments).values({
      body,
      id: commentId,
      userId: currentUser.id,
      videoId,
    });

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

    if (video) {
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
            commentPreview: body,
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
        body,
        createdAt: new Date().toISOString(),
        id: commentId,
        userId: currentUser.id,
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
