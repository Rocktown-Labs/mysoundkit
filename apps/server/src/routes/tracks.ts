/* eslint-disable complexity */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfileRoles,
  artistProfiles,
  genres,
  purchases,
  trackAssets,
  trackLicenseOptions,
  trackLyrics,
  trackStemJobs,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { env } from "@soundkit/env/server";
import { and, desc, eq, ne } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { createWorkflowJobRow } from "@/lib/audio-processing";
import type { TrackProcessingWorkflowPayload } from "@/lib/audio-processing";
import {
  buildTrackDetail,
  buildTrackSummary,
  ownedTrackWhere,
} from "@/lib/dashboard-mappers";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { withRetry } from "@/lib/retry";
import { sampleCatalogItems, sampleTracks } from "@/lib/sample-data";
import {
  createTrackAssetBodySchema,
  createTrackBodySchema,
  createLyricsRevisionBodySchema,
  lyricsRevisionSchema,
  messageResponseSchema,
  reviewLyricsRevisionBodySchema,
  setupRequiredResponseSchema,
  trackCatalogDetailSchema,
  trackDashboardDetailSchema,
  trackProcessingStatusSchema,
  trackSummarySchema,
  updateTrackBodySchema,
} from "@/lib/schemas";
import { createSellerAccountLink, isSellerEnabled } from "@/lib/seller";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId, uniqueSlug } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

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

const assetKindLabels = {
  alternate_mix: "Alternate Mix",
  artwork: "Artwork",
  booklet: "Digital Booklet",
  clean: "Clean Version",
  instrumental: "Instrumental",
  license_pdf: "License Agreement",
  master: "High Quality Master",
  midi: "MIDI Files",
  stems: "Track Stems",
  tagged_mp3: "Tagged MP3",
  untagged_wav: "Untagged WAV",
} as const;

const catalogAssetKinds = new Set(Object.keys(assetKindLabels));

const getTrackProcessingWorkflow = () =>
  (
    env as unknown as {
      TRACK_PROCESSING_WORKFLOW?: Workflow<TrackProcessingWorkflowPayload>;
    }
  ).TRACK_PROCESSING_WORKFLOW ?? null;

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Tracks list"
      ),
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user) || !isDatabaseConfigured()) {
      return c.json(sampleTracks, HttpStatusCodes.OK);
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
          title: body.title,
          updatedAt: new Date().toISOString(),
        },
        HttpStatusCodes.CREATED
      );
    }

    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });

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

    const db = createDb();

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

    const genreSlug = body.genre.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
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
          name: body.genre,
          slug: genreSlug,
        })
      );
    }

    const trackId = crypto.randomUUID();
    const now = new Date();
    const [track] = await withRetry("create track", () =>
      db
        .insert(tracks)
        .values({
          bpm: body.bpm ?? null,
          catalogItemType: body.catalogItemType,
          createdAt: now,
          description: body.description ?? null,
          genreId,
          id: trackId,
          isForSale: body.isForSale,
          isPublic: body.isPublic,
          musicalKey: body.musicalKey ?? null,
          organizationId,
          ownerUserId: user.id,
          price: body.price?.toFixed(2) ?? null,
          priceCents: body.priceCents ?? null,
          productionStatus: body.productionStatus,
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

    if (!track) {
      throw new Error("Failed to create track.");
    }

    return c.json(await buildTrackSummary(track), HttpStatusCodes.CREATED);
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
    const [track] = await db
      .update(tracks)
      .set({
        bpm: body.bpm,
        description: body.description,
        isForSale: body.isForSale,
        isPublic: body.isPublic,
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

    return c.json(
      {
        jobId: job?.id ?? null,
        message:
          masterAsset.objectKey && getTrackProcessingWorkflow()
            ? "Track processing workflow started."
            : "Track processing queued. Configure TRACK_PROCESSING_WORKFLOW, STEMSPLIT_API_KEY, MEDIA_PUBLIC_URL, MEDIA_BUCKET, and GOOGLE_GENERATIVE_AI_API_KEY to run it.",
        status: "queued" as const,
      },
      HttpStatusCodes.ACCEPTED
    );
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
        { message: "Approved battle lyrics must include synchronized lines." },
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
    },
    tags: ["Tracks"],
  }),
  async (c) => {
    const { trackId } = c.req.valid("param");
    const [fallbackItem] = sampleCatalogItems;

    if (!fallbackItem) {
      throw new Error("Sample catalog is empty.");
    }

    const sampleItem =
      sampleCatalogItems.find((entry) => entry.id === trackId) ??
      sampleCatalogItems.find((entry) => entry.slug === trackId);

    if (sampleItem || !isDatabaseConfigured()) {
      return c.json(sampleItem ?? fallbackItem, HttpStatusCodes.OK);
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
        genreName: genres.name,
        id: tracks.id,
        isForSale: tracks.isForSale,
        isVerified: artistProfiles.isVerified,
        musicalKey: tracks.musicalKey,
        ownerUserId: tracks.ownerUserId,
        price: tracks.price,
        priceCents: tracks.priceCents,
        purchaseMode: tracks.purchaseMode,
        slug: tracks.slug,
        title: tracks.title,
      })
      .from(tracks)
      .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
      .leftJoin(artistProfiles, eq(artistProfiles.userId, tracks.ownerUserId))
      .leftJoin(authUser, eq(authUser.id, tracks.ownerUserId))
      .leftJoin(genres, eq(genres.id, tracks.genreId))
      .where(eq(tracks.id, trackId));

    if (!row) {
      return c.json(fallbackItem, HttpStatusCodes.OK);
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

    const purchaseRows = currentUser
      ? await db
          .select({ id: purchases.id })
          .from(purchases)
          .where(
            and(
              eq(purchases.buyerUserId, currentUser.id),
              eq(purchases.trackId, row.id)
            )
          )
      : [];
    const isOwned = purchaseRows.length > 0;

    const roles: ("musician" | "producer")[] =
      roleRows.length > 0
        ? roleRows.map((roleRow) => roleRow.role)
        : ["musician"];
    const coverAsset = assetRows.find(
      (asset) => asset.assetKind === "cover_art"
    );
    const firstAudioAsset = assetRows.find((asset) => asset.durationMs);
    const priceCents = priceCentsFromTrack({
      price: row.price,
      priceCents: row.priceCents,
    });

    const assets = assetRows
      .filter((asset) => catalogAssetKinds.has(asset.assetKind))
      .map((asset) => ({
        duration: formatDuration(asset.durationMs),
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
          genre: row.genreName,
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
        duration: formatDuration(firstAudioAsset?.durationMs ?? null),
        genre: row.genreName,
        id: row.id,
        isOwned,
        isPurchasable: row.isForSale,
        isStreamable: true,
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
        priceCents,
        priceLabel: formatPrice(priceCents),
        purchaseMode: row.purchaseMode,
        slug: row.slug,
        streamCount: null,
        tags: row.genreName ? [row.genreName] : [],
        title: row.title,
        visualContent: [],
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
