import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { and, desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { canonicalGenreName, genreCatalog } from "@/lib/genre-catalog";
import { loadPlatformSettings } from "@/lib/platform-settings";
import { sampleArtists, sampleBattles, sampleTracks } from "@/lib/sample-data";
import { discoverHomeResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  genreCatalogSchema = z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      totalCount: z.number().int().nonnegative(),
      trackCount: z.number().int().nonnegative(),
      videoCount: z.number().int().nonnegative(),
    })
  );

app.openapi(
  createRoute({
    method: "get",
    path: "/home",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        discoverHomeResponseSchema,
        "Discovery home feed payload"
      ),
    },
    tags: ["Discover"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(
        {
          featuredArtists: sampleArtists,
          featuredBattles: sampleBattles,
          featuredTracks: sampleTracks,
          settings: await loadPlatformSettings(),
        },
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      trackRows = await db
        .select()
        .from(tracks)
        .where(eq(tracks.isPublic, true))
        .orderBy(desc(tracks.updatedAt))
        .limit(12),
      featuredTracks = [];
    for (const row of trackRows) {
      featuredTracks.push(await buildTrackSummary(row));
    }

    const artistRows = await db
        .select({
          followerCount: artistProfiles.followerCount,
          id: artistProfiles.userId,
          isVerified: artistProfiles.isVerified,
          name: userProfiles.displayName,
          stageName: artistProfiles.stageName,
          username: userProfiles.username,
        })
        .from(artistProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
        .where(eq(artistProfiles.publicProfileEnabled, true))
        .orderBy(desc(artistProfiles.followerCount))
        .limit(12),
      featuredArtists = artistRows.map((row) => ({
        followers: row.followerCount,
        genre: "Music",
        id: row.id,
        location: "",
        name: row.stageName ?? row.name ?? row.username ?? "Artist",
        roles: ["musician"] as ("musician" | "producer")[],
        username: row.username ?? row.id,
        verified: row.isVerified,
      }));

    return c.json(
      {
        featuredArtists:
          featuredArtists.length > 0 ? featuredArtists : sampleArtists,
        featuredBattles: sampleBattles,
        featuredTracks:
          featuredTracks.length > 0 ? featuredTracks : sampleTracks,
        settings: await loadPlatformSettings(),
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/genres",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        genreCatalogSchema,
        "Music genres catalog"
      ),
    },
    tags: ["Discover"],
  }),
  async (c) => {
    const fallbackGenres = genreCatalog.map((genre) => ({
      ...genre,
      totalCount: 0,
      trackCount: 0,
      videoCount: 0,
    }));

    if (!isDatabaseConfigured()) {
      return c.json(fallbackGenres, HttpStatusCodes.OK);
    }

    const genresBySlug = new Map(
      fallbackGenres.map((genre) => [genre.slug, genre])
    );

    try {
      const db = createDb(),
        rows = await db.select().from(genres),
        trackCountRows = await db
          .select({
            count: sql<number>`count(${tracks.id})::int`,
            genreId: tracks.genreId,
          })
          .from(tracks)
          .where(
            and(
              eq(tracks.isPublic, true),
              eq(tracks.productionStatus, "complete")
            )
          )
          .groupBy(tracks.genreId),
        videoCountRows = await db
          .select({
            count: sql<number>`count(${videos.id})::int`,
            genreId: videos.genreId,
          })
          .from(videos)
          .where(eq(videos.isPublic, true))
          .groupBy(videos.genreId),
        countsByGenreId = new Map<
          string,
          { trackCount: number; videoCount: number }
        >();

      for (const row of trackCountRows) {
        if (!row.genreId) {
          continue;
        }

        const current = countsByGenreId.get(row.genreId) ?? {
          trackCount: 0,
          videoCount: 0,
        };
        current.trackCount = row.count;
        countsByGenreId.set(row.genreId, current);
      }

      for (const row of videoCountRows) {
        if (!row.genreId) {
          continue;
        }

        const current = countsByGenreId.get(row.genreId) ?? {
          trackCount: 0,
          videoCount: 0,
        };
        current.videoCount = row.count;
        countsByGenreId.set(row.genreId, current);
      }

      for (const row of rows) {
        const counts = countsByGenreId.get(row.id) ?? {
          trackCount: 0,
          videoCount: 0,
        };
        genresBySlug.set(row.slug, {
          id: row.id,
          name: canonicalGenreName(row.name),
          slug: row.slug,
          totalCount: counts.trackCount + counts.videoCount,
          ...counts,
        });
      }
    } catch {
      // Fall back to the catalog if the table is not ready
    }

    return c.json([...genresBySlug.values()], HttpStatusCodes.OK);
  }
);

export default app;
