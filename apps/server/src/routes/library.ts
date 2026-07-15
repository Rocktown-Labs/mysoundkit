import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  librarySaves,
  orderItems,
  playbackSessions,
  playlists,
  purchases,
  recentPlays,
  tracks,
} from "@soundkit/db/schema/app";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import {
  fallbackArtistSlug,
  fallbackCover,
  toPurchasedCatalogItem,
  toWatchedItemType,
  watchedSourceTypes,
} from "@/lib/library-mappers";
import {
  sampleLibraryOverview,
  samplePurchasedCatalogItems,
  sampleTracks,
} from "@/lib/sample-data";
import {
  libraryRecentTrackSchema,
  libraryOverviewSchema,
  librarySavedTrackSchema,
  libraryWatchedItemSchema,
  purchasedCatalogItemSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const toRecentTrack = async ({
  lastPlayedAt,
  playCount,
  track,
}: {
  lastPlayedAt: Date;
  playCount: number;
  track: typeof tracks.$inferSelect;
}) => {
  const summary = await buildTrackSummary(track);

  return {
    artist: summary.artistName,
    artistSlug: summary.artistUsername ?? fallbackArtistSlug,
    cover: summary.coverArtUrl ?? fallbackCover,
    duration: summary.duration,
    id: summary.id,
    lastPlayed: lastPlayedAt.toISOString(),
    timesPlayed: playCount,
    title: summary.title,
  };
};

const toSavedTrack = async ({
  savedAt,
  track,
}: {
  savedAt: Date;
  track: typeof tracks.$inferSelect;
}) => {
  const summary = await buildTrackSummary(track);

  return {
    artist: summary.artistName,
    artistSlug: summary.artistUsername ?? fallbackArtistSlug,
    cover: summary.coverArtUrl ?? fallbackCover,
    duration: summary.duration,
    genre: summary.genre,
    id: summary.id,
    savedAt: savedAt.toISOString(),
    title: summary.title,
  };
};

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        libraryOverviewSchema,
        "Library overview"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(sampleLibraryOverview, HttpStatusCodes.OK);
    }

    const db = createDb();
    const [playlistRows, purchaseRows, recentRows, savedRows, watchedRows] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(playlists)
          .where(eq(playlists.ownerUserId, user.id)),
        db
          .select({ value: count() })
          .from(purchases)
          .where(eq(purchases.buyerUserId, user.id)),
        db
          .select({ value: count() })
          .from(recentPlays)
          .where(eq(recentPlays.userId, user.id)),
        db
          .select({ value: count() })
          .from(librarySaves)
          .where(eq(librarySaves.userId, user.id)),
        db
          .select({ value: count() })
          .from(playbackSessions)
          .where(
            and(
              eq(playbackSessions.userId, user.id),
              inArray(playbackSessions.sourceType, watchedSourceTypes)
            )
          ),
      ]);

    return c.json(
      {
        playlistCount: playlistRows[0]?.value ?? 0,
        purchaseCount: purchaseRows[0]?.value ?? 0,
        recentPlayCount: recentRows[0]?.value ?? 0,
        savedTrackCount: savedRows[0]?.value ?? 0,
        watchedCount: watchedRows[0]?.value ?? 0,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/recent",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        libraryRecentTrackSchema.array(),
        "Recent plays"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(
        sampleTracks.map((track, index) => ({
          artist: track.artistName,
          artistSlug: fallbackArtistSlug,
          cover: track.coverArtUrl ?? fallbackCover,
          duration: track.duration,
          id: track.id,
          lastPlayed: new Date(
            Date.now() - index * 60 * 60 * 1000
          ).toISOString(),
          timesPlayed: Math.max(1, 24 - index * 6),
          title: track.title,
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const rows = await db
      .select({
        lastPlayedAt: recentPlays.lastPlayedAt,
        playCount: recentPlays.playCount,
        track: tracks,
      })
      .from(recentPlays)
      .innerJoin(tracks, eq(tracks.id, recentPlays.trackId))
      .where(eq(recentPlays.userId, user.id))
      .orderBy(desc(recentPlays.lastPlayedAt))
      .limit(100);

    const items = await Promise.all(
      rows.map((row) =>
        toRecentTrack({
          lastPlayedAt: row.lastPlayedAt,
          playCount: row.playCount,
          track: row.track,
        })
      )
    );

    return c.json(items, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/saved",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        librarySavedTrackSchema.array(),
        "Saved tracks"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(
        sampleTracks.slice(0, 1).map((track) => ({
          artist: track.artistName,
          artistSlug: fallbackArtistSlug,
          cover: track.coverArtUrl ?? fallbackCover,
          duration: track.duration,
          genre: track.genre,
          id: track.id,
          savedAt: new Date().toISOString(),
          title: track.title,
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const rows = await db
      .select({
        savedAt: librarySaves.createdAt,
        track: tracks,
      })
      .from(librarySaves)
      .innerJoin(tracks, eq(tracks.id, librarySaves.trackId))
      .where(eq(librarySaves.userId, user.id))
      .orderBy(desc(librarySaves.createdAt))
      .limit(100);

    const items = await Promise.all(
      rows.map((row) =>
        toSavedTrack({ savedAt: row.savedAt, track: row.track })
      )
    );

    return c.json(items, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/watched",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        libraryWatchedItemSchema.array(),
        "Watched history"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(
        sampleTracks.map((track, index) => ({
          creator: track.artistName,
          creatorSlug: fallbackArtistSlug,
          duration: track.duration,
          id: track.id,
          thumbnail: track.coverArtUrl ?? fallbackCover,
          title: track.title,
          type: index % 2 === 0 ? ("battle" as const) : ("video" as const),
          watchedAt: new Date(
            Date.now() - index * 90 * 60 * 1000
          ).toISOString(),
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const rows = await db
      .select({
        session: playbackSessions,
        track: tracks,
      })
      .from(playbackSessions)
      .innerJoin(tracks, eq(tracks.id, playbackSessions.trackId))
      .where(
        and(
          eq(playbackSessions.userId, user.id),
          inArray(playbackSessions.sourceType, watchedSourceTypes)
        )
      )
      .orderBy(desc(playbackSessions.startedAt))
      .limit(100);

    const items = await Promise.all(
      rows.map(async (row) => {
        const summary = await buildTrackSummary(row.track);
        return {
          creator: summary.artistName,
          creatorSlug: summary.artistUsername ?? fallbackArtistSlug,
          duration: summary.duration,
          id: row.session.sourceId ?? summary.id,
          thumbnail: summary.coverArtUrl ?? fallbackCover,
          title: summary.title,
          type: toWatchedItemType(row.session.sourceType),
          watchedAt: row.session.startedAt.toISOString(),
        };
      })
    );

    return c.json(items, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/purchases",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        purchasedCatalogItemSchema.array(),
        "Purchased catalog items"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(samplePurchasedCatalogItems, HttpStatusCodes.OK);
    }

    const db = createDb();
    const rows = await db
      .select({
        id: purchases.id,
        licenseOptionId: orderItems.licenseOptionId,
        orderProjectId: orderItems.projectId,
        priceCents: orderItems.priceSnapshot,
        productType: orderItems.productType,
        purchaseProjectId: purchases.projectId,
        purchasedAt: purchases.purchasedAt,
        title: orderItems.titleSnapshot,
        trackId: purchases.trackId,
      })
      .from(purchases)
      .innerJoin(orderItems, eq(orderItems.id, purchases.orderItemId))
      .where(eq(purchases.buyerUserId, user.id));

    return c.json(
      rows.map((row) =>
        toPurchasedCatalogItem({
          ...row,
          projectId: row.purchaseProjectId ?? row.orderProjectId,
        })
      ),
      HttpStatusCodes.OK
    );
  }
);

export default app;
