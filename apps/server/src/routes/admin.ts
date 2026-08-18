/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, prefer-named-capture-group, promise/avoid-new */
/* eslint-disable unicorn/max-nested-calls */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  fanProfiles,
  listeningParties,
  openVerseListings,
  platformSettings,
  projects,
  trackAssets,
  tracks,
  videos,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { communities } from "@soundkit/db/schema/communities";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { and, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import {
  backfillSearchEmbeddings,
  loadEmbeddingStatus,
} from "@/lib/audio-processing";
import {
  enqueueTrackDurationBackfills,
  loadTrackDurationBackfillStatus,
} from "@/lib/media-metadata";
import {
  loadPlatformSettings,
  platformDiscoverySettingsKey,
} from "@/lib/platform-settings";
import {
  adminAccessSchema,
  adminOverviewSchema,
  backfillTrackDurationsBodySchema,
  backfillTrackDurationsResponseSchema,
  messageResponseSchema,
  platformSettingsSchema,
  trackDurationBackfillStatusQuerySchema,
  trackDurationBackfillStatusSchema,
  updatePlatformSettingsBodySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

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

app.openapi(
  createRoute({
    method: "get",
    path: "/settings",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        platformSettingsSchema,
        "Platform settings"
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

    return c.json(await loadPlatformSettings(), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/settings",
    request: {
      body: {
        content: {
          "application/json": {
            schema: updatePlatformSettingsBodySchema,
          },
        },
      },
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        platformSettingsSchema,
        "Updated platform settings"
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

    const body = updatePlatformSettingsBodySchema.parse(await c.req.json()),
      nextSettings = platformSettingsSchema.parse({
        ...(await loadPlatformSettings()),
        ...body,
      });

    if (isDatabaseConfigured()) {
      await createDb()
        .insert(platformSettings)
        .values({
          key: platformDiscoverySettingsKey,
          updatedByUserId: c.get("user")?.id ?? null,
          value: nextSettings,
        })
        .onConflictDoUpdate({
          set: {
            updatedAt: new Date(),
            updatedByUserId: c.get("user")?.id ?? null,
            value: nextSettings,
          },
          target: platformSettings.key,
        });
    }

    return c.json(nextSettings, HttpStatusCodes.OK);
  }
);

export default app;
