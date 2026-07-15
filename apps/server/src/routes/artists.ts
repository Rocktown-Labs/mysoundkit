import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  profileLinks,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  genreSlugFromExploreFilter,
  stateFromExploreRegion,
} from "@/lib/public-explore";
import { sampleArtists } from "@/lib/sample-data";
import { artistRankingQuerySchema, artistSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const locationLabel = ({
  city,
  state,
}: {
  city: string | null;
  state: string | null;
}) => [city, state].filter(Boolean).join(", ");

const artistMomentumRank = sql<number>`count(${tracks.id})::int`;

const artistOrderBy = (query: {
  category?: "rising" | "new" | "top";
  sort?: string;
}) => {
  if (query.sort === "name-asc") {
    return asc(userProfiles.displayName);
  }

  if (query.sort === "name-desc") {
    return desc(userProfiles.displayName);
  }

  if (query.category === "new") {
    return query.sort === "rank-desc"
      ? asc(userProfiles.createdAt)
      : desc(userProfiles.createdAt);
  }

  if (query.category === "rising") {
    return query.sort === "rank-desc"
      ? asc(artistMomentumRank)
      : desc(artistMomentumRank);
  }

  return query.sort === "rank-desc"
    ? asc(artistProfiles.followerCount)
    : desc(artistProfiles.followerCount);
};

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: artistRankingQuerySchema.partial() },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistSummarySchema.array(),
        "Artists list"
      ),
    },
    tags: ["Artists"],
  }),
  async (c) => {
    const query = c.req.valid("query");
    const limit = query.limit ?? 24;
    const page = query.page ?? 1;
    const offset = (page - 1) * limit;

    if (!isDatabaseConfigured()) {
      return c.json(
        sampleArtists.slice(offset, offset + limit).map((artist, index) => ({
          ...artist,
          avatarUrl: "/diverse-user-avatars.png",
          joinedAt: new Date(
            Date.now() - (index + offset) * 86_400_000
          ).toISOString(),
          rank: index + offset + 1,
          state: artist.location.split(", ").at(1) ?? null,
          weeklyPlays: Math.max(1000, 100_000 - (index + offset) * 7500),
        })),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const genreSlug = genreSlugFromExploreFilter(query.genre);
    const state = stateFromExploreRegion(query);
    const publicArtistConditions = [
      eq(artistProfiles.publicProfileEnabled, true),
    ];

    if (genreSlug) {
      publicArtistConditions.push(eq(genres.slug, genreSlug));
    }

    if (state) {
      publicArtistConditions.push(
        sql`lower(${userProfiles.state}) in (${state.name.toLowerCase()}, ${state.abbreviation.toLowerCase()})`
      );
    }

    const order = artistOrderBy(query);
    const rows = await db
      .select({
        avatarUrl: userProfiles.avatarUrl,
        city: userProfiles.city,
        createdAt: userProfiles.createdAt,
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
      .where(and(...publicArtistConditions))
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
      .orderBy(order)
      .limit(limit)
      .offset(offset);

    return c.json(
      rows.map((artist, index) => ({
        avatarUrl: artist.avatarUrl,
        followers: artist.followerCount,
        genre: artist.genre ?? "Uncategorized",
        id: artist.id,
        joinedAt: artist.createdAt.toISOString(),
        location: locationLabel({ city: artist.city, state: artist.state }),
        name: artist.stageName ?? artist.displayName ?? artist.name,
        rank: index + offset + 1,
        roles: ["musician" as const],
        state: artist.state,
        username: artist.username,
        verified: artist.isVerified,
        weeklyPlays: Math.max(0, Number(artist.trackCount) * 1000),
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
          avatarUrl: userProfiles.avatarUrl,
          city: userProfiles.city,
          bio: userProfiles.bio,
          displayName: userProfiles.displayName,
          followerCount: artistProfiles.followerCount,
          genre: genres.name,
          battleCount: artistProfiles.battleCount,
          createdAt: artistProfiles.createdAt,
          headerUrl: userProfiles.headerUrl,
          id: userProfiles.userId,
          isVerified: artistProfiles.isVerified,
          name: authUser.name,
          projectCount: artistProfiles.projectCount,
          stageName: artistProfiles.stageName,
          state: userProfiles.state,
          trackCount: artistProfiles.trackCount,
          username: userProfiles.username,
        })
        .from(artistProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
        .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
        .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
        .where(eq(userProfiles.username, username))
        .limit(1);

      if (artist) {
        const links = await db
          .select({
            platform: profileLinks.platform,
            url: profileLinks.url,
          })
          .from(profileLinks)
          .where(eq(profileLinks.userId, artist.id));
        const platformLinks = Object.fromEntries(
          links
            .filter((link) =>
              ["apple_music", "spotify", "youtube"].includes(link.platform)
            )
            .map((link) => [
              link.platform === "apple_music" ? "apple" : link.platform,
              link.url,
            ])
        );

        return c.json(
          {
            avatarUrl: artist.avatarUrl,
            battleCount: artist.battleCount,
            bio: artist.bio,
            coverImageUrl: artist.headerUrl,
            followers: artist.followerCount,
            genre: artist.genre ?? "Uncategorized",
            id: artist.id,
            joinedAt: artist.createdAt.toISOString(),
            links: platformLinks,
            location: locationLabel({ city: artist.city, state: artist.state }),
            name: artist.stageName ?? artist.displayName ?? artist.name,
            projectCount: artist.projectCount,
            roles: ["musician" as const],
            username: artist.username,
            trackCount: artist.trackCount,
            verified: artist.isVerified,
            weeklyPlays: Math.max(0, artist.trackCount * 1000),
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
