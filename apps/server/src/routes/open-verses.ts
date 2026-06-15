import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  openVerseListings,
  openVerseSubmissions,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import {
  isAuthenticatedSession,
  isAuthenticatedUser,
  unauthorizedMessage,
} from "@/lib/entitlements";
import { sampleTracks } from "@/lib/sample-data";
import {
  createOpenVerseBodySchema,
  createOpenVerseSubmissionBodySchema,
  messageResponseSchema,
  openVerseListingSchema,
  openVersePageSchema,
  openVerseQuerySchema,
  openVerseSubmissionSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { resolveActiveOrganizationId } from "@/lib/workspace";

const app = new OpenAPIHono<AppEnv>();

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

const likeTerm = (value: string) => `%${value.replaceAll("%", "\\%")}%`;

const sampleOpenVersePage = ({
  cursor,
  genre,
  limit,
  q,
}: z.infer<typeof openVerseQuerySchema>) => {
  const needle = q?.toLowerCase();
  const genreNeedle = genre ? slugify(genre) : null;
  const rows = sampleTracks
    .filter((track) => {
      const trackGenreSlug = slugify(track.genre);
      const matchesGenre = !genreNeedle || trackGenreSlug === genreNeedle;
      const matchesQuery =
        !needle ||
        track.title.toLowerCase().includes(needle) ||
        track.artistName.toLowerCase().includes(needle);

      return matchesGenre && matchesQuery;
    })
    .slice(0, cursor ? 0 : limit)
    .map((track) => ({
      artistName: track.artistName,
      artistUsername: null,
      bpm: track.bpm ?? null,
      closesAt: null,
      coverArtUrl: track.coverArtUrl ?? null,
      createdAt: track.updatedAt ?? new Date().toISOString(),
      description: "Open verse slot available for artists looking to collab.",
      genre: track.genre,
      genreSlug: slugify(track.genre),
      id: `open_${track.id}`,
      maxSubmissions: 50,
      musicalKey: track.musicalKey ?? null,
      playbackUrl: track.playbackUrl ?? null,
      slotEndsAtMs: null,
      slotStartsAtMs: null,
      status: "open" as const,
      submissionCount: 0,
      title: `${track.title} - open verse`,
      trackId: track.id,
      trackTitle: track.title,
    }));

  return {
    items: rows,
    nextCursor: null,
  };
};

const listOpenVerses = async (query: z.infer<typeof openVerseQuerySchema>) => {
  if (!isDatabaseConfigured()) {
    return sampleOpenVersePage(query);
  }

  const db = createDb();
  const term = query.q ? likeTerm(query.q) : null;
  const genreTerm = query.genre ? slugify(query.genre) : null;
  const cursorDate = query.cursor ? new Date(query.cursor) : null;
  const rows = await db
    .select({
      artistName: userProfiles.displayName,
      artistUsername: userProfiles.username,
      bpm: openVerseListings.bpm,
      closesAt: openVerseListings.closesAt,
      createdAt: openVerseListings.createdAt,
      description: openVerseListings.description,
      genre: genres.name,
      genreSlug: genres.slug,
      id: openVerseListings.id,
      maxSubmissions: openVerseListings.maxSubmissions,
      musicalKey: openVerseListings.musicalKey,
      ownerUserId: openVerseListings.ownerUserId,
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
        eq(openVerseListings.status, "open"),
        eq(tracks.isPublic, true),
        cursorDate ? lt(openVerseListings.createdAt, cursorDate) : undefined,
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
      tracks.id,
      userProfiles.displayName,
      userProfiles.username,
      genres.name,
      genres.slug
    )
    .orderBy(desc(openVerseListings.createdAt))
    .limit(query.limit + 1);

  const pageRows = rows.slice(0, query.limit);
  const items = [];

  for (const row of pageRows) {
    const trackSummary = await buildTrackSummary(row.track);
    items.push({
      artistName: row.artistName ?? "SoundKit Artist",
      artistUsername: row.artistUsername,
      bpm: row.bpm ?? trackSummary.bpm ?? null,
      closesAt: row.closesAt?.toISOString() ?? null,
      coverArtUrl: trackSummary.coverArtUrl ?? null,
      createdAt: row.createdAt.toISOString(),
      description: row.description,
      genre: row.genre ?? trackSummary.genre,
      genreSlug: row.genreSlug ?? slugify(trackSummary.genre),
      id: row.id,
      maxSubmissions: row.maxSubmissions,
      musicalKey: row.musicalKey ?? trackSummary.musicalKey ?? null,
      playbackUrl: trackSummary.playbackUrl ?? null,
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

    const body = c.req.valid("json");
    const db = createDb();
    const [track] = await db
      .select()
      .from(tracks)
      .where(and(eq(tracks.id, body.trackId), eq(tracks.ownerUserId, user.id)))
      .limit(1);

    if (!track) {
      return c.json({ message: "Track not found." }, HttpStatusCodes.NOT_FOUND);
    }

    const session = c.get("session");
    const organizationId = await resolveActiveOrganizationId({
      session: isAuthenticatedSession(session) ? session : null,
      user,
    });
    const id = crypto.randomUUID();
    const now = new Date();
    const [listing] = await db
      .insert(openVerseListings)
      .values({
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
        slotEndsAtMs: body.slotEndsAtMs ?? null,
        slotStartsAtMs: body.slotStartsAtMs ?? null,
        title: body.title,
        trackId: body.trackId,
        updatedAt: now,
      })
      .returning();

    if (!listing) {
      throw new Error("Failed to create open verse listing.");
    }

    const page = await listOpenVerses({ limit: 1, q: body.title });
    const created = page.items.find((item) => item.id === listing.id);

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
    const { listingId } = c.req.valid("param");
    const page = await listOpenVerses({ limit: 50 });
    const listing = page.items.find((item) => item.id === listingId);

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
          assetId: null,
          createdAt: new Date().toISOString(),
          id: "submission_new",
          listingId: c.req.valid("param").listingId,
          message: c.req.valid("json").message ?? null,
          status: "submitted" as const,
          submitterUserId: user.id,
        },
        HttpStatusCodes.CREATED
      );
    }

    const { listingId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = createDb();
    const [submission] = await db
      .insert(openVerseSubmissions)
      .values({
        assetId: body.assetId ?? null,
        id: crypto.randomUUID(),
        listingId,
        message: body.message ?? null,
        submitterUserId: user.id,
      })
      .onConflictDoUpdate({
        set: {
          assetId: body.assetId ?? null,
          message: body.message ?? null,
          status: "submitted",
          updatedAt: new Date(),
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

    return c.json(
      {
        ...submission,
        createdAt: submission.createdAt.toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

export default app;
