import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  genres,
  openVerseAccessRequests,
  openVerseListings,
  openVerseSubmissions,
  projects,
  trackAssets,
  trackCollaborators,
  trackStemJobs,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import { publicAssetUrl } from "@/lib/asset-urls";
import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { getDisplayNameForUser } from "@/lib/email-events";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  resolveEntitlements,
  unauthorizedMessage,
} from "@/lib/entitlements";
import {
  ENRICHMENT_PIPELINE_VERSION,
  MEDIA_PIPELINE_VERSION,
} from "@/lib/media-pipeline";
import {
  ensureMediaProcessingWorkflow,
  ensureTrackEnrichmentWorkflow,
} from "@/lib/media-processing-jobs";
import { notify } from "@/lib/notifications";
import { sampleTracks } from "@/lib/sample-data";
import {
  createOpenVerseAccessRequestBodySchema,
  createOpenVerseBodySchema,
  createOpenVerseSubmissionBodySchema,
  messageResponseSchema,
  openVerseAccessRequestSchema,
  openVerseListingSchema,
  openVersePageSchema,
  openVerseQuerySchema,
  openVerseSubmissionSchema,
  respondOpenVerseAccessRequestBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>(),
  listingIdParams = z.object({ listingId: z.string() }),
  slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, ""),
  likeTerm = (value: string) => `%${value.replaceAll("%", "\\%")}%`,
  sampleOpenVersePage = ({
    cursor,
    genre,
    limit,
    q,
  }: z.infer<typeof openVerseQuerySchema>) => {
    const needle = q?.toLowerCase(),
      genreNeedle = genre ? slugify(genre) : null,
      rows = sampleTracks
        .filter((track) => {
          const trackGenreSlug = slugify(track.genre),
            matchesGenre = !genreNeedle || trackGenreSlug === genreNeedle,
            matchesQuery =
              !needle ||
              track.title.toLowerCase().includes(needle) ||
              track.artistName.toLowerCase().includes(needle);

          return matchesGenre && matchesQuery;
        })
        .slice(0, cursor ? 0 : limit)
        .map((track) => ({
          accessMode: "open" as const,
          artistName: track.artistName,
          artistUsername: null,
          bpm: track.bpm ?? null,
          closesAt: null,
          coverArtUrl: track.coverArtUrl ?? "/open-verse-placeholder.svg",
          createdAt: track.updatedAt ?? new Date().toISOString(),
          description:
            "Open verse slot available for artists looking to collab.",
          genre: track.genre,
          genreSlug: slugify(track.genre),
          id: `open_${track.id}`,
          isPublic: true,
          maxSubmissions: 50,
          musicalKey: track.musicalKey ?? null,
          ownerUserId: track.id,
          playbackUrl: track.playbackUrl ?? "/open-verse-placeholder.svg",
          previewAssetId: null,
          slotEndsAtMs: null,
          slotStartsAtMs: null,
          status: "open" as const,
          submissionCount: 0,
          title: `${track.title} - Open Verse`,
          trackId: track.id,
          trackTitle: track.title,
        }));

    return {
      items: rows,
      nextCursor: null,
    };
  },
  listOpenVerses = async (
    query: z.infer<typeof openVerseQuerySchema>,
    listingId?: string
  ) => {
    if (!isDatabaseConfigured()) {
      return sampleOpenVersePage(query);
    }

    const db = createDb(),
      term = query.q ? likeTerm(query.q) : null,
      genreTerm = query.genre ? slugify(query.genre) : null,
      cursorDate = query.cursor ? new Date(query.cursor) : null,
      rows = await db
        .select({
          accessMode: openVerseListings.accessMode,
          artistName: userProfiles.displayName,
          artistUsername: userProfiles.username,
          bpm: openVerseListings.bpm,
          closesAt: openVerseListings.closesAt,
          createdAt: openVerseListings.createdAt,
          description: openVerseListings.description,
          genre: genres.name,
          genreSlug: genres.slug,
          id: openVerseListings.id,
          isPublic: tracks.isPublic,
          maxSubmissions: openVerseListings.maxSubmissions,
          musicalKey: openVerseListings.musicalKey,
          ownerUserId: openVerseListings.ownerUserId,
          previewAssetId: openVerseListings.previewAssetId,
          slotEndsAtMs: openVerseListings.slotEndsAtMs,
          slotStartsAtMs: openVerseListings.slotStartsAtMs,
          status: openVerseListings.status,
          submissionCount: sql<number>`count(${openVerseSubmissions.id})::int`,
          title: openVerseListings.title,
          track: tracks,
          trackId: openVerseListings.trackId,
          trackTitle: tracks.title,
        })
        .from(openVerseListings)
        .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
        .innerJoin(
          userProfiles,
          eq(userProfiles.userId, openVerseListings.ownerUserId)
        )
        .leftJoin(genres, eq(genres.id, openVerseListings.genreId))
        .leftJoin(
          openVerseSubmissions,
          eq(openVerseSubmissions.listingId, openVerseListings.id)
        )
        .where(
          and(
            listingId
              ? eq(openVerseListings.id, listingId)
              : eq(openVerseListings.status, "open"),
            listingId ? undefined : eq(tracks.isPublic, true),
            cursorDate
              ? lt(openVerseListings.createdAt, cursorDate)
              : undefined,
            genreTerm ? eq(genres.slug, genreTerm) : undefined,
            term
              ? or(
                  ilike(openVerseListings.title, term),
                  ilike(tracks.title, term),
                  ilike(userProfiles.displayName, term),
                  ilike(genres.name, term)
                )
              : undefined
          )
        )
        .groupBy(
          openVerseListings.id,
          openVerseListings.accessMode,
          openVerseListings.previewAssetId,
          tracks.id,
          userProfiles.displayName,
          userProfiles.username,
          genres.name,
          genres.slug
        )
        .orderBy(desc(openVerseListings.createdAt))
        .limit(query.limit + 1),
      pageRows = rows.slice(0, query.limit),
      items = [];

    for (const row of pageRows) {
      const trackSummary = await buildTrackSummary(row.track),
        [clipAsset] = row.previewAssetId
          ? await db
              .select()
              .from(trackAssets)
              .where(eq(trackAssets.id, row.previewAssetId))
              .limit(1)
          : [];
      items.push({
        accessMode: row.accessMode,
        artistName: row.artistName ?? "SoundKit Artist",
        artistUsername: row.artistUsername,
        bpm: row.bpm ?? trackSummary.bpm ?? null,
        closesAt: row.closesAt?.toISOString() ?? null,
        coverArtUrl: trackSummary.coverArtUrl ?? "/open-verse-placeholder.svg",
        createdAt: row.createdAt.toISOString(),
        description: row.description,
        genre: row.genre ?? trackSummary.genre,
        genreSlug: row.genreSlug ?? slugify(trackSummary.genre),
        id: row.id,
        isPublic: row.isPublic,
        maxSubmissions: row.maxSubmissions,
        musicalKey: row.musicalKey ?? trackSummary.musicalKey ?? null,
        ownerUserId: row.ownerUserId,
        playbackUrl: publicAssetUrl(clipAsset),
        previewAssetId: row.previewAssetId,
        slotEndsAtMs: row.slotEndsAtMs,
        slotStartsAtMs: row.slotStartsAtMs,
        status: row.status,
        submissionCount: row.submissionCount,
        title: row.title,
        trackId: row.trackId,
        trackTitle: row.trackTitle,
      });
    }

    const nextRow = rows[query.limit];

    return {
      items,
      nextCursor: nextRow?.createdAt.toISOString() ?? null,
    };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: openVerseQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(openVersePageSchema, "Open verses"),
    },
    tags: ["Open Verses"],
  }),
  async (c) => c.json(await listOpenVerses(c.req.valid("query")))
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        createOpenVerseBodySchema,
        "Open verse listing payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        openVerseListingSchema,
        "Open verse listing"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Open Verse media is incomplete"
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
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const body = c.req.valid("json"),
      db = createDb(),
      [track] = await db
        .select()
        .from(tracks)
        .where(
          and(eq(tracks.id, body.trackId), eq(tracks.ownerUserId, user.id))
        )
        .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }
    if (
      body.slotStartsAtMs === undefined ||
      body.slotEndsAtMs === undefined ||
      body.slotEndsAtMs <= body.slotStartsAtMs
    ) {
      return c.json(
        { message: "Select a valid Open Verse start and end time." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [masterAsset] = await db
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, track.id),
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true)
        )
      )
      .limit(1);
    if (!masterAsset?.objectKey) {
      return c.json(
        { message: "Upload and register the Open Verse base master first." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const session = c.get("session"),
      organizationId = await resolveActiveOrganizationId({
        session: isAuthenticatedSession(session) ? session : null,
        user,
      }),
      id = crypto.randomUUID(),
      now = new Date(),
      [listing] = await db
        .insert(openVerseListings)
        .values({
          accessMode: body.accessMode,
          baseMasterAssetId: masterAsset.id,
          bpm: track.bpm,
          closesAt: body.closesAt ? new Date(body.closesAt) : null,
          createdAt: now,
          description: body.description ?? null,
          genreId: track.genreId,
          id,
          maxSubmissions: body.maxSubmissions,
          musicalKey: track.musicalKey,
          organizationId,
          ownerUserId: user.id,
          previewAssetId: null,
          slotEndsAtMs: body.slotEndsAtMs ?? null,
          slotStartsAtMs: body.slotStartsAtMs ?? null,
          title: `${track.title} - Open Verse`,
          trackId: body.trackId,
          updatedAt: now,
        })
        .returning();

    if (!listing) {
      throw new Error("Failed to create open verse listing.");
    }

    await db.transaction(async (transaction) => {
      await transaction
        .update(trackAssets)
        .set({ status: "ready", updatedAt: now })
        .where(eq(trackAssets.id, masterAsset.id));
      await transaction
        .update(tracks)
        .set({
          isPublic: true,
          productionStatus: "demo",
          publishedAt: track.publishedAt ?? now,
          releaseStrategy: "publish_when_ready",
          updatedAt: now,
        })
        .where(eq(tracks.id, track.id));
    });

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "open_verse_base",
          objectKey: masterAsset.objectKey,
          openVerse: {
            listingId: listing.id,
            slotEndsAtMs: body.slotEndsAtMs,
            slotStartsAtMs: body.slotStartsAtMs,
          },
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: masterAsset.id,
          trackId: track.id,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "open_verse_snippet_workflow_launch_failed",
        listingId: listing.id,
        sourceAssetId: masterAsset.id,
        trackId: track.id,
      });
    }

    const artistFollowers = await db
      .select({ userId: artistFollows.followerUserId })
      .from(artistFollows)
      .innerJoin(
        userProfiles,
        eq(userProfiles.userId, artistFollows.followerUserId)
      )
      .where(
        and(
          eq(artistFollows.artistUserId, user.id),
          eq(userProfiles.accountType, "artist")
        )
      );

    for (const follower of artistFollowers) {
      await notify(
        {
          actorUserId: user.id,
          aggregationKey: `open_verse:${user.id}`,
          data: {
            actorName: user.name ?? "An artist",
            listingId: listing.id,
            listingTitle: `${track.title} - Open Verse`,
          },
          entity: { id: listing.id, type: "open_verse" },
          eventId: listing.id,
          recipientUserId: follower.userId,
          type: "open_verse.published",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    const page = await listOpenVerses({ limit: 50 }),
      created = page.items.find((item) => item.id === listing.id);

    return c.json(created ?? page.items[0], HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{listingId}",
    request: { params: z.object({ listingId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        openVerseListingSchema,
        "Open verse listing"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open verse not found"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const { listingId } = c.req.valid("param"),
      page = await listOpenVerses({ limit: 1 }, listingId),
      listing = page.items[0];

    if (!listing) {
      return c.json(
        { message: "Open verse not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(listing, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/{listingId}",
    request: { params: listingIdParams },
    responses: {
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin access required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open verse not found"
      ),
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Open verse deleted"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const currentUser = c.get("user"),
      session = c.get("session");

    if (!isAuthenticatedSession(session) || !isAuthenticatedUser(currentUser)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isAdminUser(currentUser)) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { listingId } = c.req.valid("param"),
      db = createDb(),
      [listing] = await db
        .select({ id: openVerseListings.id })
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1);

    if (!listing) {
      return c.json(
        { message: "Open verse not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db.transaction(async (transaction) => {
      await transaction
        .delete(openVerseAccessRequests)
        .where(eq(openVerseAccessRequests.listingId, listingId));
      await transaction
        .delete(openVerseSubmissions)
        .where(eq(openVerseSubmissions.listingId, listingId));
      await transaction
        .delete(openVerseListings)
        .where(eq(openVerseListings.id, listingId));
    });

    logError({
      event: "open_verse_listing_deleted",
      listingId,
      message: "Open verse listing deleted by administrator",
      userId: currentUser.id,
    });

    return c.json(
      { message: "Open verse listing deleted." },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{listingId}/access-requests",
    request: {
      body: jsonContentRequired(
        createOpenVerseAccessRequestBodySchema,
        "Access request"
      ),
      params: z.object({ listingId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid access request"
      ),
      [HttpStatusCodes.CREATED]: jsonContent(
        openVerseAccessRequestSchema,
        "Access request"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Artist account required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open verse not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const { listingId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [submitterProfile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);
    if (submitterProfile?.accountType !== "artist") {
      return c.json(
        { message: "Only artist accounts can participate in Open Verses." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const [trackCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tracks)
        .where(eq(tracks.ownerUserId, user.id)),
      [projectCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.ownerUserId, user.id));
    if ((trackCount?.count ?? 0) + (projectCount?.count ?? 0) < 1) {
      return c.json(
        {
          message:
            "Upload at least one Track or Project before requesting access.",
        },
        HttpStatusCodes.FORBIDDEN
      );
    }
    const [listing] = await db
      .select({
        accessMode: openVerseListings.accessMode,
        ownerUserId: openVerseListings.ownerUserId,
        title: openVerseListings.title,
      })
      .from(openVerseListings)
      .where(eq(openVerseListings.id, listingId))
      .limit(1);
    if (!listing) {
      return c.json(
        { message: "Open verse not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (listing.accessMode === "open") {
      return c.json(
        { message: "This listing does not require access approval." },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    const [request] = await db
      .insert(openVerseAccessRequests)
      .values({
        id: crypto.randomUUID(),
        listingId,
        message: body.message ?? null,
        requesterUserId: user.id,
        status: "pending",
      })
      .onConflictDoUpdate({
        set: {
          message: body.message ?? null,
          reviewedAt: null,
          reviewedByUserId: null,
          status: "pending",
          updatedAt: new Date(),
        },
        target: [
          openVerseAccessRequests.listingId,
          openVerseAccessRequests.requesterUserId,
        ],
      })
      .returning();
    if (!request) {
      throw new Error("Failed to save access request.");
    }
    await notify(
      {
        actorUserId: user.id,
        data: {
          actorName: user.name ?? "An artist",
          listingId,
          listingTitle: listing.title,
          requestId: request.id,
        },
        entity: { id: listingId, type: "open_verse" },
        eventId: request.id,
        recipientUserId: listing.ownerUserId,
        type: "open_verse.access.requested",
      },
      { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
    );
    return c.json(
      {
        ...request,
        createdAt: request.createdAt.toISOString(),
        reviewedAt: request.reviewedAt?.toISOString() ?? null,
        updatedAt: request.updatedAt.toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{listingId}/access-requests/me",
    request: { params: z.object({ listingId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        openVerseAccessRequestSchema.nullable(),
        "My access request"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(null, HttpStatusCodes.OK);
    }
    if (!isDatabaseConfigured()) {
      return c.json(null, HttpStatusCodes.OK);
    }
    const [request] = await createDb()
      .select()
      .from(openVerseAccessRequests)
      .where(
        and(
          eq(openVerseAccessRequests.listingId, c.req.valid("param").listingId),
          eq(openVerseAccessRequests.requesterUserId, user.id)
        )
      )
      .limit(1);
    return c.json(
      request
        ? {
            ...request,
            createdAt: request.createdAt.toISOString(),
            reviewedAt: request.reviewedAt?.toISOString() ?? null,
            updatedAt: request.updatedAt.toISOString(),
          }
        : null,
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{listingId}/access-requests",
    request: { params: z.object({ listingId: z.string() }) },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        openVerseAccessRequestSchema.array(),
        "Access requests"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user"),
      { listingId } = c.req.valid("param");
    if (!isAuthenticatedUser(user) || !isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }
    const db = createDb(),
      [listing] = await db
        .select({ ownerUserId: openVerseListings.ownerUserId })
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1);
    if (!listing || listing.ownerUserId !== user.id) {
      return c.json([], HttpStatusCodes.OK);
    }
    const requests = await db
      .select()
      .from(openVerseAccessRequests)
      .where(eq(openVerseAccessRequests.listingId, listingId))
      .orderBy(desc(openVerseAccessRequests.createdAt));
    return c.json(
      requests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
        reviewedAt: request.reviewedAt?.toISOString() ?? null,
        updatedAt: request.updatedAt.toISOString(),
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{listingId}/access-requests/{requestId}",
    request: {
      body: jsonContentRequired(
        respondOpenVerseAccessRequestBodySchema,
        "Access request response"
      ),
      params: z.object({ listingId: z.string(), requestId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Access request not found"
      ),
      [HttpStatusCodes.OK]: jsonContent(
        openVerseAccessRequestSchema,
        "Updated access request"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user) || !isDatabaseConfigured()) {
      return c.json(
        { message: "Authentication is required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const { listingId, requestId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [listing] = await db
        .select({
          ownerUserId: openVerseListings.ownerUserId,
          title: openVerseListings.title,
        })
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1),
      [request] = await db
        .select()
        .from(openVerseAccessRequests)
        .where(
          and(
            eq(openVerseAccessRequests.id, requestId),
            eq(openVerseAccessRequests.listingId, listingId)
          )
        )
        .limit(1);
    if (!listing || !request) {
      return c.json(
        { message: "Access request not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (
      listing.ownerUserId !== user.id &&
      request.requesterUserId !== user.id
    ) {
      return c.json(
        { message: "You cannot change this request." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    if (body.action !== "cancel" && listing.ownerUserId !== user.id) {
      return c.json(
        { message: "Only the listing owner can approve requests." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const status =
      body.action === "approve"
        ? "approved"
        : (body.action === "decline"
          ? "declined"
          : "canceled");
    const [updated] = await db
      .update(openVerseAccessRequests)
      .set({
        reviewedAt: body.action === "cancel" ? null : new Date(),
        reviewedByUserId: body.action === "cancel" ? null : user.id,
        status,
        updatedAt: new Date(),
      })
      .where(eq(openVerseAccessRequests.id, requestId))
      .returning();
    if (!updated) {
      return c.json(
        { message: "Access request not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (status === "approved" || status === "declined") {
      await notify(
        {
          actorUserId: user.id,
          data: {
            actorName: user.name ?? "The listing owner",
            listingId,
            listingTitle: listing.title,
            requestId,
          },
          entity: { id: listingId, type: "open_verse" },
          eventId: requestId,
          recipientUserId: request.requesterUserId,
          type:
            status === "approved"
              ? "open_verse.access.approved"
              : "open_verse.access.declined",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }
    return c.json(
      {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{listingId}/submissions",
    request: {
      body: jsonContentRequired(
        createOpenVerseSubmissionBodySchema,
        "Open verse submission payload"
      ),
      params: z.object({ listingId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        openVerseSubmissionSchema,
        "Open verse submission"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Submission eligibility or approval required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open verse not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          adlibAssetId: null,
          assetId: null,
          createdAt: new Date().toISOString(),
          id: "submission_new",
          listingId: c.req.valid("param").listingId,
          message: c.req.valid("json").message ?? null,
          status: "submitted" as const,
          submitterUserId: user.id,
          vocalStemAssetId: null,
        },
        HttpStatusCodes.CREATED
      );
    }

    const { listingId } = c.req.valid("param"),
      body = c.req.valid("json"),
      db = createDb(),
      [submitterProfile] = await db
        .select({ accountType: userProfiles.accountType })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1),
      [accessListing] = await db
        .select({
          accessMode: openVerseListings.accessMode,
          trackId: openVerseListings.trackId,
        })
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1),
      [trackCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tracks)
        .where(eq(tracks.ownerUserId, user.id)),
      [projectCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.ownerUserId, user.id));

    if (!accessListing) {
      return c.json(
        { message: "Open verse not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    if (submitterProfile?.accountType !== "artist") {
      return c.json(
        { message: "Only artist accounts can submit Open Verse takes." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if ((trackCount?.count ?? 0) + (projectCount?.count ?? 0) < 1) {
      return c.json(
        { message: "Upload at least one Track or Project before submitting." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (accessListing.accessMode === "approval_required") {
      const [approvedRequest] = await db
        .select({ id: openVerseAccessRequests.id })
        .from(openVerseAccessRequests)
        .where(
          and(
            eq(openVerseAccessRequests.listingId, listingId),
            eq(openVerseAccessRequests.requesterUserId, user.id),
            eq(openVerseAccessRequests.status, "approved")
          )
        )
        .limit(1);
      if (!approvedRequest) {
        return c.json(
          { message: "Creator approval is required before submitting." },
          HttpStatusCodes.FORBIDDEN
        );
      }
    }

    const createSubmissionAsset = async ({
        asset,
        assetKind,
      }: {
        asset: typeof body.audition | undefined;
        assetKind: "adlib" | "reference_audio" | "verse_vocal";
      }) => {
        if (!asset) {
          return null;
        }
        const [createdAsset] = await db
          .insert(trackAssets)
          .values({
            assetKind,
            id: crypto.randomUUID(),
            metadata: {
              originalFileName: asset.assetOriginalFileName ?? null,
              url: asset.assetUrl ?? null,
            },
            mimeType: asset.assetMimeType ?? null,
            objectKey: asset.assetObjectKey,
            sizeBytes: asset.assetSizeBytes ?? null,
            status: "ready",
            storageProvider: "r2",
            trackId: accessListing.trackId,
            uploaderUserId: user.id,
          })
          .returning({ id: trackAssets.id });
        return createdAsset?.id ?? null;
      },
      auditionAssetId = await createSubmissionAsset({
        asset: body.audition,
        assetKind: "reference_audio",
      }),
      vocalStemAssetId = await createSubmissionAsset({
        asset: body.vocalStem,
        assetKind: "verse_vocal",
      }),
      adlibAssetId = await createSubmissionAsset({
        asset: body.adlibs,
        assetKind: "adlib",
      }),
      [submission] = await db
        .insert(openVerseSubmissions)
        .values({
          adlibAssetId,
          assetId: auditionAssetId,
          id: crypto.randomUUID(),
          listingId,
          message: body.message ?? null,
          submitterUserId: user.id,
          vocalStemAssetId,
        })
        .onConflictDoUpdate({
          set: {
            adlibAssetId,
            assetId: auditionAssetId,
            message: body.message ?? null,
            status: "submitted",
            updatedAt: new Date(),
            vocalStemAssetId,
          },
          target: [
            openVerseSubmissions.listingId,
            openVerseSubmissions.submitterUserId,
          ],
        })
        .returning();

    if (!submission) {
      throw new Error("Failed to submit open verse.");
    }

    const submitterName = await getDisplayNameForUser(user.id),
      [listingOwner] = await db
        .select({
          ownerUserId: openVerseListings.ownerUserId,
          trackTitle: tracks.title,
        })
        .from(openVerseListings)
        .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
        .where(eq(openVerseListings.id, listingId))
        .limit(1);

    if (listingOwner) {
      await notify(
        {
          actorUserId: user.id,
          data: {
            actorName: submitterName,
            listingId,
            submissionId: submission.id,
            trackTitle: listingOwner.trackTitle,
          },
          entity: { id: submission.id, type: "open_verse_submission" },
          eventId: submission.id,
          recipientUserId: listingOwner.ownerUserId,
          type: "open_verse.submission.created",
        },
        { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
      );
    }

    return c.json(
      {
        ...submission,
        createdAt: submission.createdAt.toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{listingId}/submissions",
    request: {
      params: z.object({ listingId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(
          openVerseSubmissionSchema.extend({
            submitterAvatarUrl: z.string().nullable().optional(),
            submitterDisplayName: z.string().optional(),
            submitterUsername: z.string().optional(),
          })
        ),
        "List of open verse submissions"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const { listingId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        [
          {
            adlibAssetId: null,
            assetId: "asset_vocal_1",
            createdAt: new Date().toISOString(),
            id: "sub_1",
            listingId,
            message: "Fire verse recorded over the 16-bar hook!",
            status: "submitted" as const,
            submitterAvatarUrl: "/placeholder-user.jpg",
            submitterDisplayName: "Marcus Key",
            submitterUserId: "user_marcus",
            submitterUsername: "marcuskey",
            vocalStemAssetId: "asset_vocal_1",
          },
          {
            adlibAssetId: null,
            assetId: "asset_vocal_2",
            createdAt: new Date().toISOString(),
            id: "sub_2",
            listingId,
            message: "Smooth R&B vocal take for your second verse slot.",
            status: "submitted" as const,
            submitterAvatarUrl: "/placeholder-user.jpg",
            submitterDisplayName: "Aria Vance",
            submitterUserId: "user_aria",
            submitterUsername: "ariavance",
            vocalStemAssetId: "asset_vocal_2",
          },
        ],
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      rows = await db
        .select({
          adlibAssetId: openVerseSubmissions.adlibAssetId,
          assetId: openVerseSubmissions.assetId,
          createdAt: openVerseSubmissions.createdAt,
          id: openVerseSubmissions.id,
          listingId: openVerseSubmissions.listingId,
          message: openVerseSubmissions.message,
          status: openVerseSubmissions.status,
          submitterAvatarUrl: userProfiles.avatarUrl,
          submitterDisplayName: userProfiles.displayName,
          submitterUserId: openVerseSubmissions.submitterUserId,
          submitterUsername: userProfiles.username,
          vocalStemAssetId: openVerseSubmissions.vocalStemAssetId,
        })
        .from(openVerseSubmissions)
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, openVerseSubmissions.submitterUserId)
        )
        .where(eq(openVerseSubmissions.listingId, listingId))
        .orderBy(desc(openVerseSubmissions.createdAt));

    return c.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        submitterDisplayName: r.submitterDisplayName ?? "Contender Artist",
        submitterUsername: r.submitterUsername ?? r.submitterUserId,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{listingId}/final-master",
    request: {
      body: jsonContentRequired(
        z.object({ sourceAssetId: z.string().min(1) }),
        "Authoritative Open Verse final master"
      ),
      params: z.object({ listingId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.ACCEPTED]: jsonContent(
        z.object({ message: z.string(), status: z.string() }),
        "Final master processing started"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Final master is invalid"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open Verse or final master not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const { listingId } = c.req.valid("param"),
      { sourceAssetId } = c.req.valid("json"),
      db = createDb(),
      [listing] = await db
        .select()
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1);
    if (!listing) {
      return c.json(
        { message: "Open Verse listing not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (listing.ownerUserId !== user.id) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }
    if (listing.status !== "awaiting_final_master") {
      return c.json(
        { message: "Accept a submission before uploading the final master." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const [finalMaster] = await db
      .select()
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.id, sourceAssetId),
          eq(trackAssets.trackId, listing.trackId),
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.purpose, "master"),
          eq(trackAssets.isCurrent, true)
        )
      )
      .limit(1);
    if (!finalMaster?.objectKey) {
      return c.json(
        { message: "Register a new final master before finalizing." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (finalMaster.id === listing.baseMasterAssetId) {
      return c.json(
        { message: "The final master must be a newly completed recording." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await db.transaction(async (transaction) => {
      await transaction
        .update(trackAssets)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(trackAssets.id, finalMaster.id));
      await transaction
        .update(openVerseListings)
        .set({ status: "fulfilled", updatedAt: new Date() })
        .where(eq(openVerseListings.id, listing.id));
      await transaction
        .update(tracks)
        .set({ productionStatus: "mastered", updatedAt: new Date() })
        .where(eq(tracks.id, listing.trackId));
    });

    try {
      await ensureMediaProcessingWorkflow({
        payload: {
          mode: "final_track",
          objectKey: finalMaster.objectKey,
          pipelineVersion: MEDIA_PIPELINE_VERSION,
          sourceAssetId: finalMaster.id,
          trackId: listing.trackId,
        },
        workflow: c.env.MEDIA_PROCESSING_WORKFLOW,
      });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        event: "open_verse_final_media_workflow_launch_failed",
        listingId,
        sourceAssetId: finalMaster.id,
        trackId: listing.trackId,
      });
    }

    const entitlements = await resolveEntitlements({
      session: isAuthenticatedSession(c.get("session"))
        ? c.get("session")
        : null,
      user,
    });
    if (entitlements.isPremium) {
      const stemJobId = `stem:${finalMaster.id}:v${ENRICHMENT_PIPELINE_VERSION}`;
      await db
        .insert(trackStemJobs)
        .values({
          id: stemJobId,
          inputAssetId: finalMaster.id,
          outputFormat: "MP3",
          outputType: "BOTH",
          status: "queued",
          trackId: listing.trackId,
        })
        .onConflictDoNothing();
      try {
        const enrichment = await ensureTrackEnrichmentWorkflow({
          payload: {
            objectKey: finalMaster.objectKey,
            pipelineVersion: ENRICHMENT_PIPELINE_VERSION,
            sourceAssetId: finalMaster.id,
            trackId: listing.trackId,
          },
          workflow: c.env.TRACK_ENRICHMENT_WORKFLOW,
        });
        await db
          .update(trackStemJobs)
          .set({ workflowInstanceId: enrichment.workflowInstanceId })
          .where(eq(trackStemJobs.inputAssetId, finalMaster.id));
      } catch (error) {
        logError({
          error: error instanceof Error ? error.message : String(error),
          event: "open_verse_final_enrichment_workflow_launch_failed",
          listingId,
          sourceAssetId: finalMaster.id,
          trackId: listing.trackId,
        });
      }
    }

    return c.json(
      {
        message:
          "Final master registered. SoundKit media processing has started.",
        status: "processing",
      },
      HttpStatusCodes.ACCEPTED
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{listingId}/submissions/{submissionId}/accept",
    request: {
      params: z.object({
        listingId: z.string(),
        submissionId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          message: z.string(),
          status: z.string(),
        }),
        "Submission accepted and added to track credits"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Open verse or submission not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        messageResponseSchema,
        "Authentication required"
      ),
    },
    tags: ["Open Verses"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { listingId, submissionId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          message:
            "Vocal submission accepted! Artist added to song credits & splits.",
          status: "accepted",
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [listing] = await db
        .select()
        .from(openVerseListings)
        .where(eq(openVerseListings.id, listingId))
        .limit(1);

    if (!listing) {
      return c.json(
        { message: "Open verse listing not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }
    if (listing.ownerUserId !== user.id) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const [submission] = await db
      .select()
      .from(openVerseSubmissions)
      .where(
        and(
          eq(openVerseSubmissions.id, submissionId),
          eq(openVerseSubmissions.listingId, listingId)
        )
      )
      .limit(1);

    if (!submission) {
      return c.json(
        { message: "Submission not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    await db.transaction(async (transaction) => {
      await transaction
        .update(openVerseSubmissions)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(openVerseSubmissions.id, submissionId));
      await transaction
        .update(openVerseListings)
        .set({ status: "awaiting_final_master", updatedAt: new Date() })
        .where(eq(openVerseListings.id, listingId));
    });

    // Preserve the accepted artist relationship while the owner finishes the
    // mix/master outside SoundKit.
    await db
      .insert(trackCollaborators)
      .values({
        canDelete: false,
        canEdit: true,
        canUpload: true,
        collaboratorRole: "songwriter",
        collaboratorUserId: submission.submitterUserId,
        id: crypto.randomUUID(),
        invitationStatus: "accepted",
        invitedByUserId: user.id,
        trackId: listing.trackId,
      })
      .onConflictDoNothing();

    const [track] = await db
      .select({ title: tracks.title })
      .from(tracks)
      .where(eq(tracks.id, listing.trackId))
      .limit(1);

    await notify(
      {
        actorUserId: user.id,
        data: {
          actorName: user.name ?? "The listing owner",
          listingId,
          submissionId,
          trackTitle: track?.title ?? "the Open Verse track",
        },
        entity: { id: submissionId, type: "open_verse_submission" },
        eventId: submissionId,
        recipientUserId: submission.submitterUserId,
        type: "open_verse.submission.accepted",
      },
      { emailQueue: c.env.EMAIL_DELIVERY_QUEUE }
    );

    return c.json(
      {
        message:
          "Submission accepted. Collaborator files are preserved while this track awaits a new final master.",
        status: "awaiting_final_master",
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
