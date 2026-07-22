import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const genreCatalogSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })
);
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { artistProfiles, genres, tracks, userProfiles } from "@soundkit/db/schema/app";
import { desc, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { loadPlatformSettings } from "@/lib/platform-settings";
import { sampleArtists, sampleBattles, sampleTracks } from "@/lib/sample-data";
import { discoverHomeResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

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

    const db = createDb();
    const trackRows = await db
      .select()
      .from(tracks)
      .where(eq(tracks.isPublic, true))
      .orderBy(desc(tracks.updatedAt))
      .limit(12);

    const featuredTracks = [];
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
      .limit(12);

    const featuredArtists = artistRows.map((row) => ({
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
    const fallbackGenres = [
      { id: "g_hip_hop", name: "Hip Hop", slug: "hip-hop" },
      { id: "g_rb_soul", name: "R&B/Soul", slug: "rb-soul" },
      { id: "g_electronic", name: "Electronic", slug: "electronic" },
      { id: "g_pop", name: "Pop", slug: "pop" },
      { id: "g_spoken_word", name: "Spoken Word", slug: "spoken-word" },
      { id: "g_rock", name: "Rock", slug: "rock" },
      { id: "g_jazz", name: "Jazz", slug: "jazz" },
      { id: "g_afrobeats", name: "Afrobeats", slug: "afrobeats" },
      { id: "g_latin", name: "Latin", slug: "latin" },
      { id: "g_country", name: "Country", slug: "country" },
      { id: "g_reggae", name: "Reggae", slug: "reggae" },
      { id: "g_indie", name: "Indie", slug: "indie" },
      { id: "g_metal", name: "Metal", slug: "metal" },
    ];

    if (!isDatabaseConfigured()) {
      return c.json(fallbackGenres, HttpStatusCodes.OK);
    }

    try {
      const db = createDb();
      const rows = await db.select().from(genres);
      if (rows.length > 0) {
        return c.json(
          rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug })),
          HttpStatusCodes.OK
        );
      }
    } catch {
      // Fallback if table not ready
    }

    return c.json(fallbackGenres, HttpStatusCodes.OK);
  }
);

export default app;
