import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { artistProfiles, tracks, userProfiles } from "@soundkit/db/schema/app";
import { desc, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { sampleArtists, sampleBattles, sampleTracks } from "@/lib/sample-data";
import {
  artistSummarySchema,
  battleSummarySchema,
  trackSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/home",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          featuredArtists: z.array(artistSummarySchema),
          featuredBattles: z.array(battleSummarySchema),
          featuredTracks: z.array(trackSummarySchema),
        }),
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
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
