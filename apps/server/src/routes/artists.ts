import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  playbackSessions,
  profileLinks,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { canonicalGenreName } from "@/lib/genre-catalog";
import {
  genreSlugFromExploreFilter,
  stateFromExploreRegion,
} from "@/lib/public-explore";
import { sampleArtists } from "@/lib/sample-data";
import { artistRankingQuerySchema, artistSummarySchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  locationLabel = ({
    city,
    state,
  }: {
    city: string | null;
    state: string | null;
  }) => [city, state].filter(Boolean).join(", ");

export const capitalizeWords = (input?: string | null) => {
  if (!input || input.trim().length === 0) {
    return "";
  }
  return input
    .split(" ")
    .map((word) =>
      word.includes("-")
        ? word
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join("-")
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
};

const artistMomentumRank = sql<number>`count(${tracks.id})::int`,
  artistOrderBy = (query: {
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
    const query = c.req.valid("query"),
      limit = query.limit ?? 24,
      page = query.page ?? 1,
      offset = (page - 1) * limit;

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

    const db = createDb(),
      genreSlug = genreSlugFromExploreFilter(query.genre),
      state = stateFromExploreRegion(query),
      publicArtistConditions = [eq(artistProfiles.publicProfileEnabled, true)];

    if (genreSlug) {
      publicArtistConditions.push(eq(genres.slug, genreSlug));
    }

    if (query.q) {
      publicArtistConditions.push(ilike(authUser.name, `%${query.q}%`));
    }

    if (state) {
      publicArtistConditions.push(
        sql`lower(${userProfiles.state}) in (${state.name.toLowerCase()}, ${state.abbreviation.toLowerCase()})`
      );
    }

    const order = artistOrderBy(query),
      rows = await db
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
      rows.map((artist, index) => {
        const rawName = artist.stageName ?? artist.displayName ?? artist.name,
          name = capitalizeWords(rawName),
          genre = canonicalGenreName(artist.genre ?? "Hip Hop"),
          hasActivity =
            Number(artist.trackCount) > 0 || Number(artist.followerCount) > 0,
          rank = hasActivity ? index + offset + 1 : null;

        return {
          avatarUrl: artist.avatarUrl,
          followers: artist.followerCount,
          genre,
          id: artist.id,
          joinedAt: artist.createdAt.toISOString(),
          location: locationLabel({ city: artist.city, state: artist.state }),
          name,
          rank,
          roles: ["musician" as const],
          state: artist.state,
          username: artist.username,
          verified: artist.isVerified,
          weeklyPlays: 0,
        };
      }),
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
      const db = createDb(),
        [artist] = await db
          .select({
            avatarUrl: userProfiles.avatarUrl,
            battleCount: artistProfiles.battleCount,
            bio: userProfiles.bio,
            city: userProfiles.city,
            createdAt: artistProfiles.createdAt,
            displayName: userProfiles.displayName,
            followerCount: artistProfiles.followerCount,
            genre: genres.name,
            headerUrl: userProfiles.headerUrl,
            id: userProfiles.userId,
            isVerified: artistProfiles.isVerified,
            mediaLayout: userProfiles.mediaLayout,
            name: authUser.name,
            projectCount: artistProfiles.projectCount,
            stageName: artistProfiles.stageName,
            state: userProfiles.state,
            trackCount: artistProfiles.trackCount,
            username: userProfiles.username,
          })
          .from(artistProfiles)
          .innerJoin(
            userProfiles,
            eq(userProfiles.userId, artistProfiles.userId)
          )
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
            .where(eq(profileLinks.userId, artist.id)),
          platformLinks = Object.fromEntries(
            links.map((link) => [
              link.platform === "apple_music"
                ? "apple"
                : (link.platform === "personal_site"
                  ? "personalSite"
                  : link.platform),
              link.url,
            ])
          ),
          rawName = artist.stageName ?? artist.displayName ?? artist.name,
          name = capitalizeWords(rawName),
          genre = canonicalGenreName(artist.genre ?? "Hip Hop"),
          hasActivity =
            Number(artist.trackCount) > 0 ||
            Number(artist.followerCount) > 0 ||
            Number(artist.battleCount) > 0,
          rank = hasActivity
            ? (artist.battleCount
              ? `#${artist.battleCount}`
              : "#1")
            : null,
          [playsRow] = await db
            .select({
              totalPlays: sql<number>`count(${playbackSessions.id})::int`,
            })
            .from(playbackSessions)
            .innerJoin(tracks, eq(tracks.id, playbackSessions.trackId))
            .where(eq(tracks.ownerUserId, artist.id)),
          totalPlays = playsRow?.totalPlays ?? 0;

        return c.json(
          {
            avatarUrl: artist.avatarUrl,
            battleCount: artist.battleCount,
            bio: artist.bio,
            coverImageUrl: artist.headerUrl,
            followers: artist.followerCount,
            genre,
            id: artist.id,
            joinedAt: artist.createdAt.toISOString(),
            links: platformLinks,
            location: locationLabel({ city: artist.city, state: artist.state }),
            mediaLayout: artist.mediaLayout === "list" ? "list" : "cards",
            name,
            projectCount: artist.projectCount,
            rank,
            roles: ["musician" as const],
            trackCount: artist.trackCount,
            username: artist.username,
            verified: artist.isVerified,
            weeklyPlays: totalPlays,
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
