import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { sampleArtists } from "@/lib/sample-data";
import { artistSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const locationLabel = ({
  city,
  state,
}: {
  city: string | null;
  state: string | null;
}) => [city, state].filter(Boolean).join(", ");

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSummarySchema.array(),
        "Artists list"
      ),
    },
    tags: ["Artists"],
  }),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json(sampleArtists, HttpStatusCodes.OK);
    }

    const db = createDb();
    const rows = await db
      .select({
        city: userProfiles.city,
        displayName: userProfiles.displayName,
        followerCount: artistProfiles.followerCount,
        genre: genres.name,
        id: userProfiles.userId,
        isVerified: artistProfiles.isVerified,
        name: authUser.name,
        stageName: artistProfiles.stageName,
        state: userProfiles.state,
        trackCount: sql<number>`count(${tracks.id})::int`,
        username: userProfiles.username,
      })
      .from(artistProfiles)
      .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
      .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
      .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
      .leftJoin(tracks, eq(tracks.ownerUserId, artistProfiles.userId))
      .where(eq(artistProfiles.publicProfileEnabled, true))
      .groupBy(
        userProfiles.userId,
        userProfiles.city,
        userProfiles.displayName,
        userProfiles.state,
        userProfiles.username,
        artistProfiles.followerCount,
        artistProfiles.isVerified,
        artistProfiles.stageName,
        genres.name,
        authUser.name
      )
      .orderBy(desc(artistProfiles.followerCount))
      .limit(100);

    return c.json(
      rows.map((artist) => ({
        followers: artist.followerCount,
        genre: artist.genre ?? "Uncategorized",
        id: artist.id,
        location: locationLabel({ city: artist.city, state: artist.state }),
        name: artist.stageName ?? artist.displayName ?? artist.name,
        roles: ["musician" as const],
        username: artist.username,
        verified: artist.isVerified,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{username}",
    request: {
      params: z.object({
        username: z.string(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSummarySchema,
        "Artist profile summary"
      ),
    },
    tags: ["Artists"],
  }),
  async (c) => {
    const { username } = c.req.valid("param");

    if (isDatabaseConfigured()) {
      const db = createDb();
      const [artist] = await db
        .select({
          city: userProfiles.city,
          displayName: userProfiles.displayName,
          followerCount: artistProfiles.followerCount,
          genre: genres.name,
          id: userProfiles.userId,
          isVerified: artistProfiles.isVerified,
          name: authUser.name,
          stageName: artistProfiles.stageName,
          state: userProfiles.state,
          username: userProfiles.username,
        })
        .from(artistProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
        .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
        .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
        .where(eq(userProfiles.username, username))
        .limit(1);

      if (artist) {
        return c.json(
          {
            followers: artist.followerCount,
            genre: artist.genre ?? "Uncategorized",
            id: artist.id,
            location: locationLabel({ city: artist.city, state: artist.state }),
            name: artist.stageName ?? artist.displayName ?? artist.name,
            roles: ["musician" as const],
            username: artist.username,
            verified: artist.isVerified,
          },
          HttpStatusCodes.OK
        );
      }
    }

    const artist =
      sampleArtists.find((entry) => entry.username === username) ??
      sampleArtists[0];
    return c.json(artist, HttpStatusCodes.OK);
  }
);

export default app;
