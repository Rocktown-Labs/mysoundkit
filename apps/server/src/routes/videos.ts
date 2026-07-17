import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Mux } from "@mux/mux-node";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  muxUploads,
  playbackSessions,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import {
  forbiddenMessage,
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  genreSlugFromExploreFilter,
  stateFromExploreRegion,
} from "@/lib/public-explore";
import { sampleVideos } from "@/lib/sample-data";
import {
  createVideoBodySchema,
  directVideoUploadBodySchema,
  directVideoUploadResponseSchema,
  messageResponseSchema,
  publicExploreQuerySchema,
  videoSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { videoPlaybackSourceType } from "@/lib/video-playback";

const app = new OpenAPIHono<AppEnv>();

const getMuxClient = () => {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    return null;
  }

  return new Mux({
    tokenId: env.MUX_TOKEN_ID,
    tokenSecret: env.MUX_TOKEN_SECRET,
  });
};

const videoViewCount = sql<number>`(
  select count(*)::int
  from ${playbackSessions}
  where ${playbackSessions.sourceType} = ${videoPlaybackSourceType}
    and ${playbackSessions.sourceId} = ${videos.id}
)`;

const publicVideoOrderBy = (sort?: string) => {
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
};

const getSampleVideoFallback = (
  videoId?: string
): (typeof sampleVideos)[number] => {
  const fallback =
    sampleVideos.find((entry) => entry.id === videoId) ?? sampleVideos[0];

  if (!fallback) {
    throw new Error("Sample video fallback is missing.");
  }

  return fallback;
};

const formatVideoDuration = (durationMs?: number | null) => {
  if (!durationMs) {
    return "0:00";
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const mapVideo = (
  video:
    | {
        creatorName?: string;
        creatorUsername?: string | null;
        duration?: string;
        durationMs?: number | null;
        externalPlaybackUrl?: string | null;
        id: string;
        muxPlaybackId?: string | null;
        playbackPolicy: "public" | "signed";
        sourceProjectId?: string | null;
        sourceProvider?: "external" | "mux";
        sourceTrackId?: string | null;
        status: string;
        thumbnailUrl?: string | null;
        title: string;
        verifiedOnPlatform?: boolean;
        videoKind:
          | "music_video"
          | "promo"
          | "teaser"
          | "battle_replay"
          | "battle_clip"
          | "live_recording";
        viewCount?: string;
      }
    | (typeof sampleVideos)[number]
) => ({
  creatorName: video.creatorName,
  creatorUsername: video.creatorUsername ?? null,
  duration:
    video.duration ??
    formatVideoDuration("durationMs" in video ? video.durationMs : null),
  externalPlaybackUrl: video.externalPlaybackUrl ?? null,
  id: video.id,
  muxPlaybackId: video.muxPlaybackId ?? null,
  playbackPolicy: video.playbackPolicy,
  sourceProjectId: video.sourceProjectId ?? null,
  sourceProvider: video.sourceProvider ?? "mux",
  sourceTrackId: video.sourceTrackId ?? null,
  status: video.status,
  thumbnailUrl: video.thumbnailUrl ?? "/placeholder.svg",
  title: video.title,
  verifiedOnPlatform: video.verifiedOnPlatform ?? false,
  videoKind: video.videoKind,
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

    const db = createDb();
    const genreSlug = genreSlugFromExploreFilter(query.genre);
    const state = stateFromExploreRegion(query);
    const publicVideoConditions = [eq(videos.isPublic, true)];

    if (genreSlug) {
      publicVideoConditions.push(eq(genres.slug, genreSlug));
    }

    if (state) {
      publicVideoConditions.push(
        sql`lower(${userProfiles.state}) in (${state.name.toLowerCase()}, ${state.abbreviation.toLowerCase()})`
      );
    }

    const order = publicVideoOrderBy(query.sort);
    const rows = await db
      .select({
        displayName: userProfiles.displayName,
        name: authUser.name,
        username: userProfiles.username,
        video: videos,
      })
      .from(videos)
      .leftJoin(userProfiles, eq(userProfiles.userId, videos.ownerUserId))
      .leftJoin(authUser, eq(authUser.id, videos.ownerUserId))
      .leftJoin(tracks, eq(tracks.id, videos.sourceTrackId))
      .leftJoin(genres, eq(genres.id, tracks.genreId))
      .where(and(...publicVideoConditions))
      .orderBy(order)
      .limit(query.limit ?? 24);

    return c.json(
      rows.map((row) => ({
        ...mapVideo(row.video),
        creatorName: row.displayName ?? row.name ?? "SoundKit Artist",
        creatorUsername: row.username ?? null,
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

    const body = c.req.valid("json");
    const session = c.get("session");
    const entitlements = await resolveEntitlements({
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

    const db = createDb();
    const videoId = crypto.randomUUID();

    const [video] = await db
      .insert(videos)
      .values({
        description: body.description,
        externalPlaybackUrl:
          body.sourceProvider === "external"
            ? (body.externalPlaybackUrl ?? null)
            : null,
        id: videoId,
        isPublic:
          body.sourceProvider === "external" ||
          body.playbackPolicy === "public",
        organizationId: isAuthenticatedSession(session)
          ? (session.activeOrganizationId ?? null)
          : null,
        ownerUserId: user.id,
        playbackPolicy: body.playbackPolicy,
        sourceProjectId: body.sourceProjectId ?? null,
        sourceProvider: body.sourceProvider,
        sourceTrackId: body.sourceTrackId ?? null,
        status: body.sourceProvider === "external" ? "ready" : "pending",
        title: body.title,
        verifiedOnPlatform: body.sourceProvider === "mux",
        videoKind: body.videoKind,
      })
      .returning();

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

    const mux = getMuxClient();

    if (!mux) {
      return c.json(
        { message: "Mux credentials are not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const session = c.get("session");
    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

    if (!entitlements.isPremium) {
      return c.json(
        forbiddenMessage(
          "A premium artist subscription is required to upload official music videos."
        ),
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json");
    const db = createDb();
    const videoId = crypto.randomUUID();
    const passthrough = videoId;
    const upload = await mux.video.uploads.create({
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
      id: videoId,
      isPublic: body.playbackPolicy === "public",
      muxPassthrough: passthrough,
      muxUploadId: upload.id,
      organizationId: isAuthenticatedSession(session)
        ? (session.activeOrganizationId ?? null)
        : null,
      ownerUserId: user.id,
      playbackPolicy: body.playbackPolicy,
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

    const db = createDb();
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video) {
      return c.json(
        mapVideo(getSampleVideoFallback(videoId)),
        HttpStatusCodes.OK
      );
    }

    return c.json(mapVideo(video), HttpStatusCodes.OK);
  }
);

export default app;
