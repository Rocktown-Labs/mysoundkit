import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  librarySaves,
  orderItems,
  playbackSessions,
  playlists,
  playlistTracks,
  purchases,
  trackAssets,
  tracks,
} from "@soundkit/db/schema/app";
import { and, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { unauthorizedMessage } from "@/lib/entitlements";
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
  samplePlaylists,
  sampleTracks,
} from "@/lib/sample-data";
import {
  libraryRecentTrackSchema,
  libraryOverviewSchema,
  librarySavedTrackSchema,
  libraryWatchedItemSchema,
  purchasedCatalogDetailSchema,
  playlistSchema,
  purchasedCatalogItemSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  toRecentTrack = async ({
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
      regionSlug: summary.regionSlug ?? null,
      slug: summary.slug,
      timesPlayed: playCount,
      title: summary.title,
    };
  },
  toSavedTrack = async ({
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
      regionSlug: summary.regionSlug ?? null,
      savedAt: savedAt.toISOString(),
      slug: summary.slug,
      title: summary.title,
    };
  },
  saveTrackStateSchema = z.object({
    saved: z.boolean(),
    trackId: z.string(),
  }),
  legacyDownloadableAssetKinds = ["tagged_mp3"] as const,
  getPurchasedCatalogRow = ({
    purchaseId,
    userId,
  }: {
    purchaseId?: string;
    userId: string;
  }) => {
    const db = createDb(),
      query = db
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
        .where(
          purchaseId
            ? and(
                eq(purchases.buyerUserId, userId),
                eq(purchases.id, purchaseId)
              )
            : eq(purchases.buyerUserId, userId)
        );

    return query;
  },
  getPurchaseDownloads = async ({ trackId }: { trackId: string | null }) => {
    if (!trackId) {
      return [];
    }

    const assetRows = await createDb()
      .select({
        assetKind: trackAssets.assetKind,
        id: trackAssets.id,
      })
      .from(trackAssets)
      .where(
        and(
          eq(trackAssets.trackId, trackId),
          eq(trackAssets.isCurrent, true),
          eq(trackAssets.status, "ready"),
          or(
            inArray(trackAssets.purpose, ["download", "lossless_download"]),
            inArray(trackAssets.assetKind, legacyDownloadableAssetKinds)
          )
        )
      )
      .orderBy(desc(trackAssets.durationMs));

    return assetRows.map((asset) => ({
      downloadUrl: `/v1/tracks/${trackId}/assets/${asset.id}/download`,
      id: asset.id,
      label: asset.assetKind.replaceAll("_", " "),
    }));
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

    if (!user) {
      return c.json(
        {
          playlistCount: 0,
          purchaseCount: 0,
          recentPlayCount: 0,
          savedTrackCount: 0,
          watchedCount: 0,
        },
        HttpStatusCodes.OK
      );
    }

    if (!isDatabaseConfigured()) {
      return c.json(sampleLibraryOverview, HttpStatusCodes.OK);
    }

    const db = createDb(),
      [playlistRows, purchaseRows, recentRows, savedRows, watchedRows] =
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
            .select({
              value: sql<number>`count(distinct ${playbackSessions.trackId})::int`,
            })
            .from(playbackSessions)
            .where(
              and(
                eq(playbackSessions.userId, user.id),
                eq(playbackSessions.riskStatus, "clear"),
                gte(playbackSessions.playedSeconds, 30)
              )
            ),
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
    path: "/playlists",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        playlistSchema.array(),
        "Library playlists"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (!isDatabaseConfigured()) {
      return c.json(samplePlaylists, HttpStatusCodes.OK);
    }

    const db = createDb(),
      rows = await db
        .select({
          description: playlists.description,
          id: playlists.id,
          isPublic: playlists.isPublic,
          title: playlists.title,
        })
        .from(playlists)
        .where(eq(playlists.ownerUserId, user.id))
        .orderBy(desc(playlists.updatedAt))
        .limit(100),
      items = await Promise.all(
        rows.map(async (playlist) => {
          const [trackCountRow] = await db
            .select({ value: count() })
            .from(playlistTracks)
            .where(eq(playlistTracks.playlistId, playlist.id));

          return {
            ...playlist,
            trackCount: trackCountRow?.value ?? 0,
          };
        })
      );

    return c.json(items, HttpStatusCodes.OK);
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

    if (!user) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      rows = await db
        .select({
          session: playbackSessions,
          track: tracks,
        })
        .from(playbackSessions)
        .innerJoin(tracks, eq(tracks.id, playbackSessions.trackId))
        .where(
          and(
            eq(playbackSessions.userId, user.id),
            eq(playbackSessions.riskStatus, "clear"),
            gte(playbackSessions.playedSeconds, 30)
          )
        )
        .orderBy(desc(playbackSessions.startedAt))
        .limit(500),
      recentRowsByTrackId = new Map<
        string,
        {
          lastPlayedAt: Date;
          playCount: number;
          track: (typeof rows)[number]["track"];
        }
      >();

    for (const row of rows) {
      const lastPlayedAt =
          row.session.endedAt ??
          row.session.lastHeartbeatAt ??
          row.session.startedAt,
        existing = recentRowsByTrackId.get(row.track.id);
      if (!existing) {
        recentRowsByTrackId.set(row.track.id, {
          lastPlayedAt,
          playCount: 1,
          track: row.track,
        });
        continue;
      }

      recentRowsByTrackId.set(row.track.id, {
        lastPlayedAt:
          lastPlayedAt > existing.lastPlayedAt
            ? lastPlayedAt
            : existing.lastPlayedAt,
        playCount: existing.playCount + 1,
        track: existing.track,
      });
    }

    const dedupedRows = [...recentRowsByTrackId.values()].toSorted(
        (a, b) => b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime()
      ),
      items = await Promise.all(
        dedupedRows.map((row) =>
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

    if (!user) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (!isDatabaseConfigured()) {
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

    const db = createDb(),
      rows = await db
        .select({
          savedAt: librarySaves.createdAt,
          track: tracks,
        })
        .from(librarySaves)
        .innerJoin(tracks, eq(tracks.id, librarySaves.trackId))
        .where(eq(librarySaves.userId, user.id))
        .orderBy(desc(librarySaves.createdAt))
        .limit(100),
      items = await Promise.all(
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

    if (!user) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (!isDatabaseConfigured()) {
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

    const db = createDb(),
      rows = await db
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
        .limit(100),
      watchedRowsBySource = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = `${row.session.sourceType}:${
          row.session.sourceId ?? row.track.id
        }`,
        existing = watchedRowsBySource.get(key);
      if (!existing || row.session.startedAt > existing.session.startedAt) {
        watchedRowsBySource.set(key, row);
      }
    }

    const dedupedRows = [...watchedRowsBySource.values()].toSorted(
        (a, b) => b.session.startedAt.getTime() - a.session.startedAt.getTime()
      ),
      items = await Promise.all(
        dedupedRows.map(async (row) => {
          const summary = await buildTrackSummary(row.track);
          return {
            creator: summary.artistName,
            creatorSlug: summary.artistUsername ?? fallbackArtistSlug,
            duration: summary.duration,
            id: row.session.sourceId ?? summary.id,
            regionSlug: summary.regionSlug ?? null,
            slug: summary.slug,
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

    if (!user) {
      return c.json([], HttpStatusCodes.OK);
    }

    if (!isDatabaseConfigured()) {
      return c.json(samplePurchasedCatalogItems, HttpStatusCodes.OK);
    }

    const rows = await getPurchasedCatalogRow({ userId: user.id }),
      items = await Promise.all(
        rows.map(async (row) => {
          const [download] = await getPurchaseDownloads({
            trackId: row.trackId,
          });

          return toPurchasedCatalogItem({
            ...row,
            projectId: row.purchaseProjectId ?? row.orderProjectId,
            trackDownloadUrl: download?.downloadUrl ?? null,
          });
        })
      );

    return c.json(items, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/purchases/{purchaseId}",
    request: {
      params: z.object({ purchaseId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        purchasedCatalogDetailSchema,
        "Purchased catalog item detail"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Purchase not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    const { purchaseId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      const purchase = samplePurchasedCatalogItems.find(
        (item) =>
          item.id === purchaseId ||
          ("productId" in item && item.productId === purchaseId)
      );

      if (!purchase) {
        return c.json(
          { message: "Purchase not found." },
          HttpStatusCodes.NOT_FOUND
        );
      }

      return c.json(
        {
          downloads: purchase.downloadUrl
            ? [
                {
                  downloadUrl: purchase.downloadUrl,
                  id: purchase.id,
                  label: "Download",
                },
              ]
            : [],
          purchase,
        },
        HttpStatusCodes.OK
      );
    }

    const [row] = await getPurchasedCatalogRow({
      purchaseId,
      userId: user.id,
    });

    if (!row) {
      return c.json(
        { message: "Purchase not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const downloads = await getPurchaseDownloads({
        trackId: row.trackId,
      }),
      [download] = downloads,
      purchase = toPurchasedCatalogItem({
        ...row,
        projectId: row.purchaseProjectId ?? row.orderProjectId,
        trackDownloadUrl: download?.downloadUrl ?? null,
      });

    return c.json({ downloads, purchase }, HttpStatusCodes.OK);
  }
);

// Toggle save track
app.openapi(
  createRoute({
    method: "post",
    path: "/saved/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        saveTrackStateSchema,
        "Saved track state"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Unauthorized"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { message: "Authentication required" },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const { trackId } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json({ saved: true, trackId }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      existing = await db
        .select()
        .from(librarySaves)
        .where(
          and(
            eq(librarySaves.userId, user.id),
            eq(librarySaves.trackId, trackId)
          )
        )
        .limit(1);

    if (existing.length > 0) {
      await db
        .delete(librarySaves)
        .where(
          and(
            eq(librarySaves.userId, user.id),
            eq(librarySaves.trackId, trackId)
          )
        );
      return c.json({ saved: false, trackId }, HttpStatusCodes.OK);
    }

    await db
      .insert(librarySaves)
      .values({
        trackId,
        userId: user.id,
      })
      .onConflictDoNothing();

    return c.json({ saved: true, trackId }, HttpStatusCodes.OK);
  }
);

// Remove saved track
app.openapi(
  createRoute({
    method: "delete",
    path: "/saved/{trackId}",
    request: {
      params: z.object({
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        saveTrackStateSchema,
        "Saved track state"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Unauthorized"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { message: "Authentication required" },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const { trackId } = c.req.valid("param");

    if (isDatabaseConfigured()) {
      await createDb()
        .delete(librarySaves)
        .where(
          and(
            eq(librarySaves.userId, user.id),
            eq(librarySaves.trackId, trackId)
          )
        );
    }

    return c.json({ saved: false, trackId }, HttpStatusCodes.OK);
  }
);

// Create playlist
app.openapi(
  createRoute({
    method: "post",
    path: "/playlists",
    request: {
      body: jsonContent(
        z.object({
          clientPlaylistId: z.string().uuid().optional(),
          description: z.string().optional(),
          isPublic: z.boolean().optional(),
          title: z.string().min(1),
        }),
        "New playlist details"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        playlistSchema,
        "Created playlist"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Unauthorized"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { message: "Authentication required" },
        HttpStatusCodes.UNAUTHORIZED
      );
    }
    const body = c.req.valid("json"),
      id =
        body.clientPlaylistId ??
        `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (!isDatabaseConfigured()) {
      return c.json(
        {
          coverArtUrl: null,
          createdAt: new Date().toISOString(),
          description: body.description ?? null,
          id,
          isPublic: body.isPublic ?? false,
          ownerUserId: user.id,
          title: body.title,
          trackCount: 0,
          updatedAt: new Date().toISOString(),
        },
        HttpStatusCodes.CREATED
      );
    }

    const db = createDb();
    await db.insert(playlists).values({
      description: body.description ?? null,
      id,
      isPublic: body.isPublic ?? false,
      ownerUserId: user.id,
      title: body.title,
    });

    return c.json(
      {
        coverArtUrl: null,
        createdAt: new Date().toISOString(),
        description: body.description ?? null,
        id,
        isPublic: body.isPublic ?? false,
        ownerUserId: user.id,
        title: body.title,
        trackCount: 0,
        updatedAt: new Date().toISOString(),
      },
      HttpStatusCodes.CREATED
    );
  }
);

// Get playlist by ID with tracks
app.openapi(
  createRoute({
    method: "get",
    path: "/playlists/{id}",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          playlist: playlistSchema,
          tracks: z.array(
            z.object({
              artist: z.string(),
              artistSlug: z.string(),
              cover: z.string(),
              duration: z.string(),
              genre: z.string().nullable(),
              id: z.string(),
              regionSlug: z.string().nullable(),
              slug: z.string().nullable(),
              title: z.string(),
            })
          ),
        }),
        "Playlist detail"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Playlist not found"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const { id } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      const sample = samplePlaylists.find((p) => p.id === id) ?? {
        coverArtUrl: null,
        createdAt: new Date().toISOString(),
        description: "My custom playlist",
        id,
        isPublic: false,
        ownerUserId: "user_demo",
        title: "My Playlist",
        trackCount: sampleTracks.slice(0, 3).length,
        updatedAt: new Date().toISOString(),
      };
      return c.json(
        {
          playlist: sample,
          tracks: sampleTracks.slice(0, 3).map((t) => ({
            artist: t.artistName,
            artistSlug: fallbackArtistSlug,
            cover: t.coverArtUrl ?? fallbackCover,
            duration: t.duration,
            genre: t.genre,
            id: t.id,
            regionSlug: "us-arkansas",
            slug: t.slug,
            title: t.title,
          })),
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      [playlistRow] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, id))
        .limit(1);

    if (!playlistRow) {
      return c.json(
        { message: "Playlist not found" },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const playlistTrackRows = await db
        .select({
          track: tracks,
        })
        .from(playlistTracks)
        .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
        .where(eq(playlistTracks.playlistId, id))
        .orderBy(desc(playlistTracks.createdAt)),
      trackItems = await Promise.all(
        playlistTrackRows.map(async (row) => {
          const savedTrack = await toSavedTrack({
            savedAt: row.track.createdAt,
            track: row.track,
          });
          return {
            artist: savedTrack.artist,
            artistSlug: savedTrack.artistSlug,
            cover: savedTrack.cover,
            duration: savedTrack.duration,
            genre: savedTrack.genre,
            id: savedTrack.id,
            regionSlug: null,
            slug: row.track.slug,
            title: savedTrack.title,
          };
        })
      );

    return c.json(
      {
        playlist: {
          coverArtUrl: null,
          createdAt: playlistRow.createdAt.toISOString(),
          description: playlistRow.description,
          id: playlistRow.id,
          isPublic: playlistRow.isPublic,
          ownerUserId: playlistRow.ownerUserId,
          title: playlistRow.title,
          trackCount: trackItems.length,
          updatedAt: playlistRow.updatedAt.toISOString(),
        },
        tracks: trackItems,
      },
      HttpStatusCodes.OK
    );
  }
);

// Add track to playlist
app.openapi(
  createRoute({
    method: "post",
    path: "/playlists/{id}/tracks",
    request: {
      body: jsonContent(
        z.object({
          trackId: z.string(),
        }),
        "Track to add to playlist"
      ),
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ added: z.boolean() }),
        "Track added to playlist"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const { id } = c.req.valid("param"),
      { trackId } = c.req.valid("json");

    if (isDatabaseConfigured()) {
      const db = createDb();
      await db
        .insert(playlistTracks)
        .values({
          playlistId: id,
          trackId,
        })
        .onConflictDoNothing();
    }

    return c.json({ added: true }, HttpStatusCodes.OK);
  }
);

// Remove track from playlist
app.openapi(
  createRoute({
    method: "delete",
    path: "/playlists/{id}/tracks/{trackId}",
    request: {
      params: z.object({
        id: z.string(),
        trackId: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ removed: z.boolean() }),
        "Track removed from playlist"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const { id, trackId } = c.req.valid("param");

    if (isDatabaseConfigured()) {
      const db = createDb();
      await db
        .delete(playlistTracks)
        .where(
          and(
            eq(playlistTracks.playlistId, id),
            eq(playlistTracks.trackId, trackId)
          )
        );
    }

    return c.json({ removed: true }, HttpStatusCodes.OK);
  }
);

// Delete playlist
app.openapi(
  createRoute({
    method: "delete",
    path: "/playlists/{id}",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ deleted: z.boolean() }),
        "Playlist deleted"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const { id } = c.req.valid("param");

    if (isDatabaseConfigured()) {
      const db = createDb();
      await db.delete(playlists).where(eq(playlists.id, id));
    }

    return c.json({ deleted: true }, HttpStatusCodes.OK);
  }
);

export default app;
