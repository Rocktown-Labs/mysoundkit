/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group, promise/avoid-new */
/* eslint-disable unicorn/max-nested-calls */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  battles,
  fanProfiles,
  genres,
  listeningParties,
  openVerseAccessRequests,
  openVerseListings,
  openVerseSubmissions,
  projects,
  trackAssets,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { communities } from "@soundkit/db/schema/communities";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import {
  backfillSearchEmbeddings,
  loadEmbeddingStatus,
} from "@/lib/audio-processing";
import {
  canonicalGenreName,
  canonicalGenreSlug,
  mergePersistedGenreCatalog,
} from "@/lib/genre-catalog";
import {
  enqueueTrackDurationBackfills,
  loadTrackDurationBackfillStatus,
} from "@/lib/media-metadata";
import { countryFromProfileLocation } from "@/lib/public-explore";
import {
  adminAccessSchema,
  adminGenreSchema,
  adminOpenVerseListingSchema,
  adminOverviewSchema,
  adminRegionOverviewSchema,
  backfillTrackDurationsBodySchema,
  backfillTrackDurationsResponseSchema,
  createGenreBodySchema,
  messageResponseSchema,
  trackDurationBackfillStatusQuerySchema,
  trackDurationBackfillStatusSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  toCountMap = (
    rows: {
      count: number | string;
      genreId: string | null;
    }[]
  ) => new Map(rows.map((row) => [row.genreId, Number(row.count)]));

app.openapi(
  createRoute({
    method: "get",
    path: "/genres",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminGenreSchema.array(),
        "Genre catalog"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }
    const db = createDb(),
      [
        genreRows,
        trackRows,
        videoRows,
        projectRows,
        battleRows,
        partyRows,
        openVerseRows,
      ] = await Promise.all([
        db.select().from(genres).orderBy(genres.name),
        db
          .select({ count: count(), genreId: tracks.genreId })
          .from(tracks)
          .groupBy(tracks.genreId),
        db
          .select({ count: count(), genreId: videos.genreId })
          .from(videos)
          .groupBy(videos.genreId),
        db
          .select({ count: count(), genreId: projects.genreId })
          .from(projects)
          .groupBy(projects.genreId),
        db
          .select({ count: count(), genreId: battles.genreId })
          .from(battles)
          .groupBy(battles.genreId),
        db
          .select({ count: count(), genreId: listeningParties.genreId })
          .from(listeningParties)
          .groupBy(listeningParties.genreId),
        db
          .select({ count: count(), genreId: openVerseListings.genreId })
          .from(openVerseListings)
          .groupBy(openVerseListings.genreId),
      ]),
      trackCounts = toCountMap(trackRows),
      videoCounts = toCountMap(videoRows),
      projectCounts = toCountMap(projectRows),
      battleCounts = toCountMap(battleRows),
      partyCounts = toCountMap(partyRows),
      openVerseCounts = toCountMap(openVerseRows),
      allGenreRows = mergePersistedGenreCatalog(genreRows);
    return c.json(
      allGenreRows.map((genre) => {
        const trackCount = trackCounts.get(genre.id) ?? 0,
          videoCount = videoCounts.get(genre.id) ?? 0,
          projectCount = projectCounts.get(genre.id) ?? 0,
          battleCount = battleCounts.get(genre.id) ?? 0,
          partyCount = partyCounts.get(genre.id) ?? 0,
          openVerseCount = openVerseCounts.get(genre.id) ?? 0;
        return {
          battleCount,
          description: genre.description,
          id: genre.id,
          name: genre.name,
          openVerseCount,
          partyCount,
          projectCount,
          slug: genre.slug,
          totalCount:
            trackCount +
            videoCount +
            projectCount +
            battleCount +
            partyCount +
            openVerseCount,
          trackCount,
          videoCount,
        };
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/genres",
    request: { body: jsonContentRequired(createGenreBodySchema, "New genre") },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(adminGenreSchema, "Genre created"),
      [HttpStatusCodes.CONFLICT]: jsonContent(
        messageResponseSchema,
        "Genre already exists"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Genre management requires a configured database." },
        HttpStatusCodes.CONFLICT
      );
    }
    const body = c.req.valid("json"),
      name = canonicalGenreName(body.name),
      slug = canonicalGenreSlug(body.name),
      db = createDb(),
      [existing] = await db
        .select({ id: genres.id })
        .from(genres)
        .where(eq(genres.slug, slug))
        .limit(1);
    if (existing) {
      return c.json(
        { message: "That genre slug already exists." },
        HttpStatusCodes.CONFLICT
      );
    }
    const id = crypto.randomUUID();
    await db
      .insert(genres)
      .values({ description: body.description ?? null, id, name, slug });
    return c.json(
      {
        battleCount: 0,
        description: body.description ?? null,
        id,
        name,
        openVerseCount: 0,
        partyCount: 0,
        projectCount: 0,
        slug,
        totalCount: 0,
        trackCount: 0,
        videoCount: 0,
      },
      HttpStatusCodes.CREATED
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/open-verses",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminOpenVerseListingSchema.array(),
        "Open Verse catalog"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const rows = await createDb()
      .select({
        accessRequestCount: sql<number>`(
          select count(*)::int from ${openVerseAccessRequests}
          where ${openVerseAccessRequests.listingId} = ${openVerseListings.id}
        )`,
        baseMasterAssetId: openVerseListings.baseMasterAssetId,
        createdAt: openVerseListings.createdAt,
        genre: genres.name,
        id: openVerseListings.id,
        ownerDisplayName: sql<
          string | null
        >`coalesce(${userProfiles.displayName}, ${user.name})`,
        ownerUserId: openVerseListings.ownerUserId,
        ownerUsername: userProfiles.username,
        previewAssetId: openVerseListings.previewAssetId,
        status: openVerseListings.status,
        submissionCount: sql<number>`(
          select count(*)::int from ${openVerseSubmissions}
          where ${openVerseSubmissions.listingId} = ${openVerseListings.id}
        )`,
        title: openVerseListings.title,
        trackId: openVerseListings.trackId,
        trackTitle: tracks.title,
      })
      .from(openVerseListings)
      .leftJoin(tracks, eq(tracks.id, openVerseListings.trackId))
      .leftJoin(genres, eq(genres.id, openVerseListings.genreId))
      .leftJoin(user, eq(user.id, openVerseListings.ownerUserId))
      .leftJoin(
        userProfiles,
        eq(userProfiles.userId, openVerseListings.ownerUserId)
      )
      .orderBy(desc(openVerseListings.createdAt));

    return c.json(
      rows.map((row) => ({
        ...row,
        accessRequestCount: Number(row.accessRequestCount),
        createdAt: row.createdAt.toISOString(),
        submissionCount: Number(row.submissionCount),
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/regions",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminRegionOverviewSchema,
        "Regional catalog coverage"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }
    if (!isDatabaseConfigured()) {
      return c.json(
        {
          missingCountryCount: 0,
          missingStateCount: 0,
          regions: [],
          totalProfileCount: 0,
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      country = sql<string>`coalesce(nullif(trim(${userProfiles.country}), ''), 'Unknown')`,
      state = sql<string>`coalesce(nullif(trim(${userProfiles.state}), ''), 'Unknown')`,
      [regionRows, [coverage]] = await Promise.all([
        db
          .select({
            artistCount: sql<number>`count(distinct case when ${userProfiles.accountType} = 'artist' then ${userProfiles.userId} end)::int`,
            country,
            profileCount: countDistinct(userProfiles.userId),
            projectCount: countDistinct(projects.id),
            state,
            trackCount: countDistinct(tracks.id),
            videoCount: countDistinct(videos.id),
          })
          .from(userProfiles)
          .leftJoin(tracks, eq(tracks.ownerUserId, userProfiles.userId))
          .leftJoin(videos, eq(videos.ownerUserId, userProfiles.userId))
          .leftJoin(projects, eq(projects.ownerUserId, userProfiles.userId))
          .groupBy(userProfiles.country, userProfiles.state)
          .orderBy(country, state),
        db
          .select({
            missingStateCount: sql<number>`count(*) filter (where ${userProfiles.state} is null or trim(${userProfiles.state}) = '')::int`,
            totalProfileCount: sql<number>`count(*)::int`,
          })
          .from(userProfiles),
      ]);

    const regionsByLocation = new Map<
      string,
      {
        artistCount: number;
        country: string;
        profileCount: number;
        projectCount: number;
        state: string;
        totalUploadCount: number;
        trackCount: number;
        videoCount: number;
      }
    >();

    for (const row of regionRows) {
      const effectiveCountry = countryFromProfileLocation(
          row.country,
          row.state
        ),
        key = `${effectiveCountry}\u0000${row.state}`,
        existing = regionsByLocation.get(key),
        trackCount = Number(row.trackCount),
        videoCount = Number(row.videoCount),
        projectCount = Number(row.projectCount);
      regionsByLocation.set(key, {
        artistCount: (existing?.artistCount ?? 0) + Number(row.artistCount),
        country: effectiveCountry,
        profileCount: (existing?.profileCount ?? 0) + Number(row.profileCount),
        projectCount: (existing?.projectCount ?? 0) + projectCount,
        state: row.state,
        totalUploadCount:
          (existing?.totalUploadCount ?? 0) +
          trackCount +
          videoCount +
          projectCount,
        trackCount: (existing?.trackCount ?? 0) + trackCount,
        videoCount: (existing?.videoCount ?? 0) + videoCount,
      });
    }

    const regions = [...regionsByLocation.values()].toSorted(
        (first, second) =>
          first.country.localeCompare(second.country) ||
          first.state.localeCompare(second.state)
      ),
      missingCountryCount = regions
        .filter((region) => region.country === "Unknown")
        .reduce((total, region) => total + region.profileCount, 0);

    return c.json(
      {
        missingCountryCount,
        missingStateCount: Number(coverage?.missingStateCount ?? 0),
        regions,
        totalProfileCount: Number(coverage?.totalProfileCount ?? 0),
      },
      HttpStatusCodes.OK
    );
  }
);

app.post("/embeddings/backfill", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }
  const limit = Number(c.req.query("limit") ?? 100);
  return c.json(
    await backfillSearchEmbeddings(Number.isFinite(limit) ? limit : 100),
    HttpStatusCodes.OK
  );
});

app.get("/embeddings/status", async (c) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json(
      { message: "Admin access is required." },
      HttpStatusCodes.FORBIDDEN
    );
  }
  return c.json(await loadEmbeddingStatus(), HttpStatusCodes.OK);
});

const emptyOverview = () => ({
    commerce: {
      grossRevenueCents: 0,
      platformFeeCents: 0,
      successfulTransactions: 0,
    },
    content: {
      communities: 0,
      listeningParties: 0,
      openVerses: 0,
      projects: 0,
      tracks: 0,
      videos: 0,
    },
    operations: {
      activeOpenVerses: 0,
      publishedTracks: 0,
      readyVideos: 0,
      releasedProjects: 0,
      scheduledListeningParties: 0,
      tracksMissingDuration: 0,
    },
    people: {
      admins: 0,
      artists: 0,
      bannedUsers: 0,
      fans: 0,
      users: 0,
    },
  }),
  loadPeople = async () => {
    const db = createDb(),
      [[users], [artists], [fans], [admins], [bannedUsers]] = await Promise.all(
        [
          db.select({ value: count() }).from(user),
          db.select({ value: count() }).from(artistProfiles),
          db.select({ value: count() }).from(fanProfiles),
          db
            .select({ value: count() })
            .from(user)
            .where(eq(user.role, "admin")),
          db.select({ value: count() }).from(user).where(eq(user.banned, true)),
        ]
      );

    return {
      admins: admins?.value ?? 0,
      artists: artists?.value ?? 0,
      bannedUsers: bannedUsers?.value ?? 0,
      fans: fans?.value ?? 0,
      users: users?.value ?? 0,
    };
  },
  loadContent = async () => {
    const db = createDb(),
      [
        [trackCount],
        [projectCount],
        [videoCount],
        [communityCount],
        [partyCount],
        [openVerseCount],
      ] = await Promise.all([
        db.select({ value: count() }).from(tracks),
        db.select({ value: count() }).from(projects),
        db.select({ value: count() }).from(videos),
        db.select({ value: count() }).from(communities),
        db.select({ value: count() }).from(listeningParties),
        db.select({ value: count() }).from(openVerseListings),
      ]);

    return {
      communities: communityCount?.value ?? 0,
      listeningParties: partyCount?.value ?? 0,
      openVerses: openVerseCount?.value ?? 0,
      projects: projectCount?.value ?? 0,
      tracks: trackCount?.value ?? 0,
      videos: videoCount?.value ?? 0,
    };
  },
  loadOperations = async () => {
    const db = createDb(),
      [
        [publishedTracks],
        [releasedProjects],
        [readyVideos],
        [scheduledListeningParties],
        [activeOpenVerses],
        [tracksMissingDuration],
      ] = await Promise.all([
        db
          .select({ value: count() })
          .from(tracks)
          .where(eq(tracks.isPublic, true)),
        db
          .select({ value: count() })
          .from(projects)
          .where(eq(projects.status, "released")),
        db
          .select({ value: count() })
          .from(videos)
          .where(eq(videos.status, "ready")),
        db
          .select({ value: count() })
          .from(listeningParties)
          .where(eq(listeningParties.status, "scheduled")),
        db
          .select({ value: count() })
          .from(openVerseListings)
          .where(eq(openVerseListings.status, "open")),
        db
          .select({ value: count() })
          .from(trackAssets)
          .where(
            and(
              eq(trackAssets.assetKind, "master"),
              eq(trackAssets.storageProvider, "r2"),
              isNotNull(trackAssets.objectKey),
              isNull(trackAssets.durationMs)
            )
          ),
      ]);

    return {
      activeOpenVerses: activeOpenVerses?.value ?? 0,
      publishedTracks: publishedTracks?.value ?? 0,
      readyVideos: readyVideos?.value ?? 0,
      releasedProjects: releasedProjects?.value ?? 0,
      scheduledListeningParties: scheduledListeningParties?.value ?? 0,
      tracksMissingDuration: tracksMissingDuration?.value ?? 0,
    };
  },
  loadCommerce = async () => {
    const db = createDb(),
      [[transactionSummary], [feeSummary]] = await Promise.all([
        db
          .select({
            amountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
            count: count(),
          })
          .from(transactions)
          .where(eq(transactions.status, "succeeded")),
        db
          .select({
            amountCents: sql<number>`coalesce(sum(${platformFees.amountCents}), 0)`,
          })
          .from(platformFees),
      ]);

    return {
      grossRevenueCents: Number(transactionSummary?.amountCents ?? 0),
      platformFeeCents: Number(feeSummary?.amountCents ?? 0),
      successfulTransactions: Number(transactionSummary?.count ?? 0),
    };
  },
  overviewSectionTimeoutMs = 8000,
  loadOverviewSection = async <T>(
    task: Promise<T>,
    fallback: T,
    section: string
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.error("Admin overview section timed out", { section });
        resolve(fallback);
      }, overviewSectionTimeoutMs);
    });

    try {
      return await Promise.race([task, timeout]);
    } catch (error) {
      console.error("Admin overview section failed", { error, section });
      return fallback;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  },
  loadOverview = async () => {
    const empty = emptyOverview(),
      [people, content, operations, commerce] = await Promise.all([
        loadOverviewSection(loadPeople(), empty.people, "people"),
        loadOverviewSection(loadContent(), empty.content, "content"),
        loadOverviewSection(loadOperations(), empty.operations, "operations"),
        loadOverviewSection(loadCommerce(), empty.commerce, "commerce"),
      ]);

    return { commerce, content, operations, people };
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/access",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminAccessSchema,
        "Current user's administration access"
      ),
    },
    tags: ["Admin"],
  }),
  (c) => c.json({ isAdmin: isAdminUser(c.get("user")) }, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        adminOverviewSchema,
        "Platform administration overview"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json(emptyOverview(), HttpStatusCodes.OK);
    }

    return c.json(await loadOverview(), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/tracks/backfill-durations",
    request: {
      body: jsonContentRequired(
        backfillTrackDurationsBodySchema,
        "Track duration backfill options"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        backfillTrackDurationsResponseSchema,
        "Track duration backfill results"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const body = c.req.valid("json"),
      result = await enqueueTrackDurationBackfills({
        executionCtx: c.executionCtx,
        limit: body.limit,
        queue: c.env.TRACK_DURATION_BACKFILL_QUEUE,
        trackIds: body.trackIds,
      });

    return c.json(result, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/tracks/backfill-durations/status",
    request: {
      query: trackDurationBackfillStatusQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackDurationBackfillStatusSchema,
        "Track duration backfill job status"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        messageResponseSchema,
        "Admin required"
      ),
    },
    tags: ["Admin"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Admin access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    const { runId } = c.req.valid("query");
    return c.json(
      await loadTrackDurationBackfillStatus(runId),
      HttpStatusCodes.OK
    );
  }
);

export default app;
