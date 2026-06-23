import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  fanProfiles,
  listeningParties,
  openVerseListings,
  projects,
  tracks,
  videos,
} from "@soundkit/db/schema/app";
import { user } from "@soundkit/db/schema/auth";
import { communities } from "@soundkit/db/schema/communities";
import { platformFees, transactions } from "@soundkit/db/schema/payments";
import { count, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAdminUser } from "@/lib/admin";
import {
  adminAccessSchema,
  adminOverviewSchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

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
  },
  people: {
    admins: 0,
    artists: 0,
    bannedUsers: 0,
    fans: 0,
    users: 0,
  },
});

const loadPeople = async () => {
  const db = createDb();
  const [[users], [artists], [fans], [admins], [bannedUsers]] =
    await Promise.all([
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(artistProfiles),
      db.select({ value: count() }).from(fanProfiles),
      db.select({ value: count() }).from(user).where(eq(user.role, "admin")),
      db.select({ value: count() }).from(user).where(eq(user.banned, true)),
    ]);

  return {
    admins: admins?.value ?? 0,
    artists: artists?.value ?? 0,
    bannedUsers: bannedUsers?.value ?? 0,
    fans: fans?.value ?? 0,
    users: users?.value ?? 0,
  };
};

const loadContent = async () => {
  const db = createDb();
  const [
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
};

const loadOperations = async () => {
  const db = createDb();
  const [
    [publishedTracks],
    [releasedProjects],
    [readyVideos],
    [scheduledListeningParties],
    [activeOpenVerses],
  ] = await Promise.all([
    db.select({ value: count() }).from(tracks).where(eq(tracks.isPublic, true)),
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
  ]);

  return {
    activeOpenVerses: activeOpenVerses?.value ?? 0,
    publishedTracks: publishedTracks?.value ?? 0,
    readyVideos: readyVideos?.value ?? 0,
    releasedProjects: releasedProjects?.value ?? 0,
    scheduledListeningParties: scheduledListeningParties?.value ?? 0,
  };
};

const loadCommerce = async () => {
  const db = createDb();
  const [[transactionSummary], [feeSummary]] = await Promise.all([
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
};

const loadOverview = async () => {
  const [people, content, operations, commerce] = await Promise.all([
    loadPeople(),
    loadContent(),
    loadOperations(),
    loadCommerce(),
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

export default app;
