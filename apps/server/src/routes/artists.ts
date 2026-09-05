/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  artistProfiles,
  genres,
  playbackSessions,
  profileLinks,
  projectCollaborators,
  projectTracks,
  projects,
  sellerAccounts,
  trackCollaborators,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { playConditionSql } from "@/lib/analytics-helpers";
import { publicProfileAssetUrl } from "@/lib/asset-urls";
import {
  buildProjectSummary,
  buildTrackSummary,
} from "@/lib/dashboard-mappers";
import { isAuthenticatedUser } from "@/lib/entitlements";
import { canonicalGenreName } from "@/lib/genre-catalog";
import {
  genreSlugFromExploreFilter,
  profileRegionCondition,
  regionSlugFromUser,
} from "@/lib/public-explore";
import { sampleArtists } from "@/lib/sample-data";
import {
  artistDiscoveryPageSchema,
  artistDiscoveryQuerySchema,
  artistProfileMediaSchema,
  artistProfileMediaSectionSchema,
  artistRankingQuerySchema,
  artistSummarySchema,
  messageResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { videoPlaybackSourceType } from "@/lib/video-playback";
import { resolveVideoThumbnailUrl } from "@/lib/video-thumbnails";

type CreativeCreditRole = "engineer" | "producer" | "songwriter";

const app = new OpenAPIHono<AppEnv>(),
  locationLabel = ({
    city,
    state,
  }: {
    city: string | null;
    state: string | null;
  }) => [city, state].filter(Boolean).join(", "),
  performingRoles: ("artist" | "vocalist")[] = ["artist", "vocalist"],
  creativeCreditRoles: ("engineer" | "producer" | "songwriter")[] = [
    "engineer",
    "producer",
    "songwriter",
  ],
  formatVideoDuration = (durationMs: number | null) => {
    if (!durationMs) {
      return "0:00";
    }

    const totalSeconds = Math.round(durationMs / 1000),
      minutes = Math.floor(totalSeconds / 60),
      seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },
  profileVideoSummary = ({
    artist,
    genre,
    state,
    video,
    viewCount,
  }: {
    artist: {
      avatarUrl: string | null;
      name: string;
      username: string;
    };
    genre: string | null;
    state: string | null;
    video: typeof videos.$inferSelect;
    viewCount: number;
  }) => ({
    creatorAvatarUrl: artist.avatarUrl,
    creatorName: artist.name,
    creatorUsername: artist.username,
    description: video.description,
    duration: formatVideoDuration(video.durationMs),
    externalPlaybackUrl: video.externalPlaybackUrl,
    genre,
    id: video.id,
    muxPlaybackId: video.muxPlaybackId,
    playbackPolicy: video.playbackPolicy,
    regionSlug: regionSlugFromUser(state) ?? null,
    releaseAt: video.releaseAt?.toISOString() ?? null,
    slug: video.slug,
    sourceProjectId: video.sourceProjectId,
    sourceProvider: video.sourceProvider,
    sourceTrackId: video.sourceTrackId,
    status: video.status,
    thumbnailUrl: resolveVideoThumbnailUrl(video),
    title: video.title,
    verifiedOnPlatform: video.verifiedOnPlatform,
    videoKind: video.videoKind,
    viewCount: String(viewCount),
  });

export const capitalizeWords = (input?: string | null) => {
  if (!input || input.trim().length === 0) {
    return "";
  }
  return input.trim();
};

const artistWeeklyPlays = sql<number>`coalesce((
    select count(${playbackSessions.id})::int
    from ${playbackSessions}
    inner join ${tracks} on ${tracks.id} = ${playbackSessions.trackId}
    where ${tracks.ownerUserId} = ${artistProfiles.userId}
      and ${playbackSessions.startedAt} >= now() - interval '7 days'
      and ${playConditionSql}
  ), 0)`,
  artistTotalPlays = sql<number>`coalesce((
    select count(${playbackSessions.id})::int
    from ${playbackSessions}
    inner join ${tracks} on ${tracks.id} = ${playbackSessions.trackId}
    where ${tracks.ownerUserId} = ${artistProfiles.userId}
      and ${playConditionSql}
  ), 0)`,
  // Recent qualified plays drive discovery while lifetime plays and followers
  // provide durable signal. Stable username/id tie-breakers keep pages repeatable.
  artistDiscoveryScore = sql<number>`coalesce(${artistWeeklyPlays}, 0) * 20 + coalesce(${artistProfiles.followerCount}, 0) * 5 + coalesce(${artistTotalPlays}, 0) * 2`,
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
      return desc(authUser.createdAt);
    }

    if (query.category === "rising") {
      return query.sort === "rank-desc"
        ? asc(artistWeeklyPlays)
        : desc(artistWeeklyPlays);
    }

    return query.sort === "rank-desc"
      ? asc(artistProfiles.followerCount)
      : desc(artistDiscoveryScore);
  },
  toArtistSummary = (artist: ArtistSummaryRow, rank: number | null) => {
    const rawName = artist.stageName ?? artist.displayName ?? artist.name,
      name = capitalizeWords(rawName),
      genre = canonicalGenreName(artist.genre ?? "Hip Hop"),
      weeklyPlays =
        artist.weeklyPlays > 0 ? artist.weeklyPlays : (artist.totalPlays ?? 0);

    return {
      avatarUrl: publicProfileAssetUrl({
        fallbackUrl: artist.avatarUrl,
        objectKey: artist.avatarObjectKey,
      }),
      followers: artist.followerCount,
      genre,
      id: artist.id,
      joinedAt: (artist.joinedAt ?? artist.createdAt).toISOString(),
      location: locationLabel({ city: artist.city, state: artist.state }),
      name,
      rank,
      roles: ["musician" as const],
      state: artist.state,
      username: artist.username,
      verified: artist.isVerified,
      weeklyPlays,
    };
  };

interface ArtistSummaryRow {
  avatarObjectKey: string | null;
  avatarUrl: string | null;
  city: string | null;
  createdAt: Date;
  displayName: string | null;
  followerCount: number;
  genre: string | null;
  id: string;
  isVerified: boolean;
  joinedAt: Date | null;
  name: string;
  rankingScore?: number;
  stageName: string | null;
  state: string | null;
  totalPlays: number;
  trackCount: number;
  username: string;
  weeklyPlays: number;
}

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
          avatarUrl: "/soundkit-default-avatar.svg",
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
      regionCondition = profileRegionCondition(query),
      publicArtistConditions = [eq(artistProfiles.publicProfileEnabled, true)];

    if (genreSlug) {
      publicArtistConditions.push(eq(genres.slug, genreSlug));
    }

    if (query.q) {
      publicArtistConditions.push(ilike(authUser.name, `%${query.q}%`));
    }

    if (regionCondition) {
      publicArtistConditions.push(regionCondition);
    }

    const order = artistOrderBy(query),
      rows = await db
        .select({
          avatarObjectKey: userProfiles.avatarObjectKey,
          avatarUrl: userProfiles.avatarUrl,
          city: userProfiles.city,
          createdAt: userProfiles.createdAt,
          displayName: userProfiles.displayName,
          followerCount: artistProfiles.followerCount,
          genre: genres.name,
          id: userProfiles.userId,
          isVerified: artistProfiles.isVerified,
          joinedAt: authUser.createdAt,
          name: authUser.name,
          stageName: artistProfiles.stageName,
          state: userProfiles.state,
          totalPlays: artistTotalPlays,
          trackCount: sql<number>`count(${tracks.id})::int`,
          username: userProfiles.username,
          weeklyPlays: artistWeeklyPlays,
        })
        .from(artistProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
        .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
        .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
        .leftJoin(tracks, eq(tracks.ownerUserId, artistProfiles.userId))
        .where(and(...publicArtistConditions))
        .groupBy(
          artistProfiles.followerCount,
          artistProfiles.isVerified,
          artistProfiles.stageName,
          artistProfiles.userId,
          authUser.createdAt,
          authUser.name,
          genres.name,
          userProfiles.avatarObjectKey,
          userProfiles.city,
          userProfiles.createdAt,
          userProfiles.displayName,
          userProfiles.state,
          userProfiles.userId,
          userProfiles.username
        )
        .orderBy(order, asc(userProfiles.username), asc(userProfiles.userId))
        .limit(limit)
        .offset(offset);

    let activeRank = offset;
    return c.json(
      rows.map((artist) => {
        const hasActivity =
          Number(artist.trackCount) > 0 || Number(artist.followerCount) > 0;
        if (hasActivity) {
          activeRank += 1;
        }
        return toArtistSummary(artist, hasActivity ? activeRank : null);
      }),
      HttpStatusCodes.OK
    );
  }
);

const encodeArtistCursor = (cursor: {
    id: string;
    rank: number;
    score: number;
    username: string;
  }) => {
    const bytes = new TextEncoder().encode(JSON.stringify(cursor));
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCodePoint(byte);
    }
    return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "");
  },
  decodeArtistCursor = (value: string) => {
    try {
      const padded = value.replaceAll("-", "+").replaceAll("_", "/"),
        binary = atob(`${padded}${"=".repeat((4 - (padded.length % 4)) % 4)}`),
        bytes = Uint8Array.from(
          binary,
          (character) => character.codePointAt(0) ?? 0
        ),
        parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      const cursor = parsed as Record<string, unknown>;
      return typeof cursor.id === "string" &&
        typeof cursor.username === "string" &&
        typeof cursor.rank === "number" &&
        Number.isInteger(cursor.rank) &&
        cursor.rank >= 0 &&
        typeof cursor.score === "number" &&
        Number.isFinite(cursor.score)
        ? {
            id: cursor.id,
            rank: cursor.rank,
            score: cursor.score,
            username: cursor.username,
          }
        : null;
    } catch {
      return null;
    }
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/discover",
    request: { query: artistDiscoveryQuerySchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistDiscoveryPageSchema,
        "Cursor-paginated public artist discovery"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid artist cursor"
      ),
    },
    tags: ["Artists"],
  }),
  async (c) => {
    const query = c.req.valid("query"),
      cursor = query.cursor ? decodeArtistCursor(query.cursor) : null;

    if (query.cursor && !cursor) {
      return c.json(
        { message: "The artist discovery cursor is invalid." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (!isDatabaseConfigured()) {
      const start = cursor?.rank ?? 0,
        page = sampleArtists.slice(start, start + query.limit),
        hasMore = start + page.length < sampleArtists.length,
        artists = page.map((artist, index) => ({
          ...artist,
          avatarUrl: "/soundkit-default-avatar.svg",
          joinedAt: new Date(
            Date.now() - (index + start) * 86_400_000
          ).toISOString(),
          rank: start + index + 1,
          state: artist.location.split(", ").at(1) ?? null,
          weeklyPlays: Math.max(1000, 100_000 - (index + start) * 7500),
        })),
        lastArtist = page.at(-1),
        nextCursor =
          hasMore && lastArtist
            ? encodeArtistCursor({
                id: lastArtist.id,
                rank: start + page.length,
                score: 0,
                username: lastArtist.username,
              })
            : null;

      return c.json({ artists, hasMore, nextCursor }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      genreSlug = genreSlugFromExploreFilter(query.genre),
      publicArtistConditions = [eq(artistProfiles.publicProfileEnabled, true)];

    if (genreSlug) {
      publicArtistConditions.push(eq(genres.slug, genreSlug));
    }
    if (query.q) {
      publicArtistConditions.push(ilike(authUser.name, `%${query.q}%`));
    }
    const regionCondition = profileRegionCondition(query);
    if (regionCondition) {
      publicArtistConditions.push(regionCondition);
    }
    if (cursor) {
      const cursorCondition = or(
        lt(artistDiscoveryScore, cursor.score),
        and(
          eq(artistDiscoveryScore, cursor.score),
          gt(userProfiles.username, cursor.username)
        ),
        and(
          eq(artistDiscoveryScore, cursor.score),
          eq(userProfiles.username, cursor.username),
          gt(userProfiles.userId, cursor.id)
        )
      );
      if (cursorCondition) {
        publicArtistConditions.push(cursorCondition);
      }
    }

    const rows = await db
      .select({
        avatarObjectKey: userProfiles.avatarObjectKey,
        avatarUrl: userProfiles.avatarUrl,
        city: userProfiles.city,
        createdAt: userProfiles.createdAt,
        displayName: userProfiles.displayName,
        followerCount: artistProfiles.followerCount,
        genre: genres.name,
        id: userProfiles.userId,
        isVerified: artistProfiles.isVerified,
        joinedAt: authUser.createdAt,
        name: authUser.name,
        rankingScore: artistDiscoveryScore,
        stageName: artistProfiles.stageName,
        state: userProfiles.state,
        totalPlays: artistTotalPlays,
        trackCount: sql<number>`count(${tracks.id})::int`,
        username: userProfiles.username,
        weeklyPlays: artistWeeklyPlays,
      })
      .from(artistProfiles)
      .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
      .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
      .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
      .leftJoin(tracks, eq(tracks.ownerUserId, artistProfiles.userId))
      .where(and(...publicArtistConditions))
      .groupBy(
        artistProfiles.followerCount,
        artistProfiles.isVerified,
        artistProfiles.stageName,
        artistProfiles.userId,
        authUser.createdAt,
        authUser.name,
        genres.name,
        userProfiles.avatarObjectKey,
        userProfiles.city,
        userProfiles.createdAt,
        userProfiles.displayName,
        userProfiles.state,
        userProfiles.userId,
        userProfiles.username
      )
      .orderBy(
        desc(artistDiscoveryScore),
        asc(userProfiles.username),
        asc(userProfiles.userId)
      )
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit,
      pageRows = rows.slice(0, query.limit),
      rankBase = cursor?.rank ?? 0,
      artists = pageRows.map((artist, index) =>
        toArtistSummary(
          artist,
          Number(artist.rankingScore) > 0 ? rankBase + index + 1 : null
        )
      ),
      lastArtist = pageRows.at(-1),
      nextCursor =
        hasMore && lastArtist
          ? encodeArtistCursor({
              id: lastArtist.id,
              rank: rankBase + pageRows.length,
              score: Number(lastArtist.rankingScore),
              username: lastArtist.username,
            })
          : null;

    return c.json({ artists, hasMore, nextCursor }, HttpStatusCodes.OK);
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
    const { username } = c.req.valid("param"),
      viewer = c.get("user");

    if (isDatabaseConfigured()) {
      const db = createDb(),
        [artist] = await db
          .select({
            avatarObjectKey: userProfiles.avatarObjectKey,
            avatarUrl: userProfiles.avatarUrl,
            battleCount: artistProfiles.battleCount,
            bio: userProfiles.bio,
            canReceiveTips: sql<boolean>`exists (
              select 1
              from ${sellerAccounts}
              where ${sellerAccounts.userId} = ${artistProfiles.userId}
                and ${sellerAccounts.onboardingStatus} = 'enabled'
                and ${sellerAccounts.chargesEnabled} = true
                and ${sellerAccounts.payoutsEnabled} = true
            )`,
            city: userProfiles.city,
            createdAt: artistProfiles.createdAt,
            displayName: userProfiles.displayName,
            followerCount: artistProfiles.followerCount,
            genre: genres.name,
            headerObjectKey: userProfiles.headerObjectKey,
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
          .where(
            or(
              eq(userProfiles.username, username),
              ilike(userProfiles.username, username),
              eq(userProfiles.userId, username),
              ilike(userProfiles.displayName, username),
              ilike(artistProfiles.stageName, username),
              ilike(authUser.name, username)
            )
          )
          .limit(1);

      if (artist) {
        const [viewerFollow] = isAuthenticatedUser(viewer)
            ? await db
                .select({ id: artistFollows.followerUserId })
                .from(artistFollows)
                .where(
                  and(
                    eq(artistFollows.artistUserId, artist.id),
                    eq(artistFollows.followerUserId, viewer.id)
                  )
                )
                .limit(1)
            : [],
          links = await db
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
                : link.platform === "personal_site"
                  ? "personalSite"
                  : link.platform,
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
            ? artist.battleCount
              ? `#${artist.battleCount}`
              : "#1"
            : null,
          [playsRow] = await db
            .select({
              totalPlays: sql<number>`count(${playbackSessions.id})::int`,
              weeklyPlays: sql<number>`coalesce(count(case when ${playbackSessions.startedAt} >= now() - interval '7 days' then 1 end)::int, 0)`,
            })
            .from(playbackSessions)
            .innerJoin(tracks, eq(tracks.id, playbackSessions.trackId))
            .where(and(eq(tracks.ownerUserId, artist.id), playConditionSql)),
          totalPlays = playsRow?.totalPlays ?? 0,
          weeklyPlays =
            (playsRow?.weeklyPlays ?? 0) > 0
              ? (playsRow?.weeklyPlays ?? 0)
              : totalPlays;

        return c.json(
          {
            avatarUrl: publicProfileAssetUrl({
              fallbackUrl: artist.avatarUrl,
              objectKey: artist.avatarObjectKey,
            }),
            battleCount: artist.battleCount,
            bio: artist.bio,
            canReceiveTips: Boolean(artist.canReceiveTips),
            coverImageUrl: publicProfileAssetUrl({
              fallbackUrl: artist.headerUrl,
              objectKey: artist.headerObjectKey,
            }),
            followers: artist.followerCount,
            genre,
            id: artist.id,
            isFollowing: Boolean(viewerFollow),
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
            weeklyPlays,
          },
          HttpStatusCodes.OK
        );
      }
    }

    const artist =
      sampleArtists.find((entry) => entry.username === username) ??
      sampleArtists[0];
    if (!artist) {
      return c.json(
        {
          canReceiveTips: false,
          followers: 0,
          genre: "Independent Artist",
          id: "sample-artist",
          location: "",
          name: "SoundKit Artist",
          roles: ["musician" as const],
          username,
          verified: false,
        },
        HttpStatusCodes.OK
      );
    }

    return c.json({ ...artist, canReceiveTips: false }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{username}/media",
    request: {
      params: z.object({
        username: z.string(),
      }),
      query: z.object({
        section: artistProfileMediaSectionSchema.optional(),
      }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        artistProfileMediaSchema,
        "Public artist media and credits"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        messageResponseSchema,
        "Artist not found"
      ),
    },
    tags: ["Artists"],
  }),
  async (c) => {
    const emptyMedia = {
        credits: [],
        featuredProjects: [],
        featuredTracks: [],
        hasMore: {
          credits: false,
          projects: false,
          tracks: false,
          videos: false,
        },
        projects: [],
        tracks: [],
        videos: [],
      },
      { section = "all" } = c.req.valid("query");

    if (!isDatabaseConfigured()) {
      return c.json(emptyMedia, HttpStatusCodes.OK);
    }

    const { username } = c.req.valid("param"),
      db = createDb(),
      [artist] = await db
        .select({
          avatarObjectKey: userProfiles.avatarObjectKey,
          avatarUrl: userProfiles.avatarUrl,
          displayName: userProfiles.displayName,
          name: authUser.name,
          stageName: artistProfiles.stageName,
          state: userProfiles.state,
          userId: artistProfiles.userId,
          username: userProfiles.username,
        })
        .from(artistProfiles)
        .innerJoin(userProfiles, eq(userProfiles.userId, artistProfiles.userId))
        .innerJoin(authUser, eq(authUser.id, artistProfiles.userId))
        .where(
          and(
            eq(artistProfiles.publicProfileEnabled, true),
            or(
              eq(userProfiles.username, username),
              ilike(userProfiles.username, username),
              eq(userProfiles.userId, username),
              ilike(userProfiles.displayName, username),
              ilike(artistProfiles.stageName, username),
              ilike(authUser.name, username)
            )
          )
        )
        .limit(1);

    if (!artist) {
      return c.json(
        { message: "Artist profile was not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const includeOwnedTracks =
        section === "all" || section === "feed" || section === "tracks",
      includeOwnedProjects =
        section === "all" || section === "feed" || section === "projects",
      includeFeatured = section === "all" || section === "feed",
      includeCredits = section === "all" || section === "credits",
      includeVideos =
        section === "all" || section === "feed" || section === "videos",
      feedTrackLimit = 6,
      feedProjectLimit = 4,
      feedVideoLimit = 2,
      [
        ownedTrackRows,
        ownedProjectRows,
        collaborationTrackRows,
        collaborationProjectRows,
        videoRows,
      ] = await Promise.all([
        includeOwnedTracks
          ? db
              .select()
              .from(tracks)
              .where(
                and(
                  eq(tracks.ownerUserId, artist.userId),
                  eq(tracks.isPublic, true)
                )
              )
              .orderBy(desc(tracks.updatedAt))
              .limit(section === "feed" ? feedTrackLimit + 1 : 50)
          : Promise.resolve([]),
        includeOwnedProjects
          ? db
              .select()
              .from(projects)
              .where(
                and(
                  eq(projects.ownerUserId, artist.userId),
                  eq(projects.isPublic, true)
                )
              )
              .orderBy(desc(projects.updatedAt))
              .limit(section === "feed" ? feedProjectLimit + 1 : 50)
          : Promise.resolve([]),
        includeFeatured || includeCredits
          ? db
              .select({
                role: trackCollaborators.collaboratorRole,
                track: tracks,
              })
              .from(trackCollaborators)
              .innerJoin(tracks, eq(tracks.id, trackCollaborators.trackId))
              .where(
                and(
                  eq(trackCollaborators.collaboratorUserId, artist.userId),
                  eq(trackCollaborators.invitationStatus, "accepted"),
                  eq(tracks.isPublic, true),
                  ne(tracks.ownerUserId, artist.userId),
                  section === "feed"
                    ? or(
                        eq(trackCollaborators.collaboratorRole, "artist"),
                        eq(trackCollaborators.collaboratorRole, "vocalist")
                      )
                    : undefined
                )
              )
              .orderBy(desc(tracks.updatedAt))
              .then((rows) =>
                section === "feed" ? rows.slice(0, feedTrackLimit + 1) : rows
              )
          : Promise.resolve([]),
        includeFeatured || includeCredits
          ? db
              .select({
                project: projects,
                role: projectCollaborators.collaboratorRole,
              })
              .from(projectCollaborators)
              .innerJoin(
                projects,
                eq(projects.id, projectCollaborators.projectId)
              )
              .where(
                and(
                  eq(projectCollaborators.collaboratorUserId, artist.userId),
                  eq(projectCollaborators.invitationStatus, "accepted"),
                  eq(projects.isPublic, true),
                  ne(projects.ownerUserId, artist.userId),
                  section === "feed"
                    ? or(
                        eq(projectCollaborators.collaboratorRole, "artist"),
                        eq(projectCollaborators.collaboratorRole, "vocalist")
                      )
                    : undefined
                )
              )
              .orderBy(desc(projects.updatedAt))
              .then((rows) =>
                section === "feed" ? rows.slice(0, feedProjectLimit + 1) : rows
              )
          : Promise.resolve([]),
        includeVideos
          ? db
              .select({
                genre: genres.name,
                video: videos,
                viewCount: sql<number>`coalesce((
                  select count(*)::int
                  from ${playbackSessions}
                  where ${playbackSessions.sourceType} = ${videoPlaybackSourceType}
                    and ${playbackSessions.sourceId} = ${videos.id}
                ), 0)`,
              })
              .from(videos)
              .leftJoin(genres, eq(genres.id, videos.genreId))
              .where(
                and(
                  eq(videos.ownerUserId, artist.userId),
                  eq(videos.isPublic, true),
                  sql`(${videos.releaseAt} is null or ${videos.releaseAt} <= now())`
                )
              )
              .orderBy(desc(videos.updatedAt))
              .limit(section === "feed" ? feedVideoLimit + 1 : 50)
          : Promise.resolve([]),
      ]),
      creditAvailabilityRows =
        section === "feed"
          ? await Promise.all([
              db
                .select({ id: trackCollaborators.trackId })
                .from(trackCollaborators)
                .innerJoin(tracks, eq(tracks.id, trackCollaborators.trackId))
                .where(
                  and(
                    eq(trackCollaborators.collaboratorUserId, artist.userId),
                    eq(trackCollaborators.invitationStatus, "accepted"),
                    eq(tracks.isPublic, true),
                    ne(tracks.ownerUserId, artist.userId),
                    or(
                      eq(trackCollaborators.collaboratorRole, "engineer"),
                      eq(trackCollaborators.collaboratorRole, "producer"),
                      eq(trackCollaborators.collaboratorRole, "songwriter")
                    )
                  )
                )
                .limit(1),
              db
                .select({ id: projectCollaborators.projectId })
                .from(projectCollaborators)
                .innerJoin(
                  projects,
                  eq(projects.id, projectCollaborators.projectId)
                )
                .where(
                  and(
                    eq(projectCollaborators.collaboratorUserId, artist.userId),
                    eq(projectCollaborators.invitationStatus, "accepted"),
                    eq(projects.isPublic, true),
                    ne(projects.ownerUserId, artist.userId),
                    or(
                      eq(projectCollaborators.collaboratorRole, "engineer"),
                      eq(projectCollaborators.collaboratorRole, "producer"),
                      eq(projectCollaborators.collaboratorRole, "songwriter")
                    )
                  )
                )
                .limit(1),
            ])
          : [],
      creditAvailability = creditAvailabilityRows.some(
        (rows) => rows.length > 0
      ),
      performingTrackRows = collaborationTrackRows.filter((row) =>
        performingRoles.includes(row.role as (typeof performingRoles)[number])
      ),
      performingProjectRows = collaborationProjectRows.filter((row) =>
        performingRoles.includes(row.role as (typeof performingRoles)[number])
      ),
      creativeTrackRows = collaborationTrackRows.filter((row) =>
        creativeCreditRoles.includes(
          row.role as (typeof creativeCreditRoles)[number]
        )
      ),
      creativeProjectRows = collaborationProjectRows.filter((row) =>
        creativeCreditRoles.includes(
          row.role as (typeof creativeCreditRoles)[number]
        )
      ),
      featuredTrackRows =
        section === "feed"
          ? performingTrackRows.slice(0, feedTrackLimit)
          : performingTrackRows,
      featuredProjectRows =
        section === "feed"
          ? performingProjectRows.slice(0, feedProjectLimit)
          : performingProjectRows,
      performingTrackIds = featuredTrackRows.map((row) => row.track.id),
      featuredTrackProjectRows =
        includeFeatured && performingTrackIds.length > 0
          ? await db
              .select({ project: projects })
              .from(projectTracks)
              .innerJoin(projects, eq(projects.id, projectTracks.projectId))
              .where(
                and(
                  inArray(projectTracks.trackId, performingTrackIds),
                  eq(projects.isPublic, true),
                  ne(projects.ownerUserId, artist.userId)
                )
              )
              .orderBy(desc(projects.updatedAt))
          : [],
      featuredTrackById = new Map(
        featuredTrackRows.map((row) => [row.track.id, row.track])
      ),
      featuredProjectById = new Map([
        ...featuredProjectRows.map(
          (row) => [row.project.id, row.project] as const
        ),
        ...featuredTrackProjectRows.map(
          (row) => [row.project.id, row.project] as const
        ),
      ]),
      [
        ownedTracks,
        ownedProjects,
        featuredTracks,
        featuredProjects,
        creativeTrackSummaries,
        creativeProjectSummaries,
      ] = await Promise.all([
        Promise.all(
          (section === "feed"
            ? ownedTrackRows.slice(0, feedTrackLimit)
            : ownedTrackRows
          ).map((row) => buildTrackSummary(row))
        ),
        Promise.all(
          (section === "feed"
            ? ownedProjectRows.slice(0, feedProjectLimit)
            : ownedProjectRows
          ).map((row) => buildProjectSummary(row))
        ),
        Promise.all(
          [...featuredTrackById.values()].map((row) => buildTrackSummary(row))
        ),
        Promise.all(
          [...featuredProjectById.values()].map((row) =>
            buildProjectSummary(row)
          )
        ),
        Promise.all(
          creativeTrackRows.map(async (row) => ({
            role: row.role as CreativeCreditRole,
            summary: await buildTrackSummary(row.track),
          }))
        ),
        Promise.all(
          creativeProjectRows.map(async (row) => ({
            role: row.role as CreativeCreditRole,
            summary: await buildProjectSummary(row.project),
          }))
        ),
      ]),
      artistName = capitalizeWords(
        artist.stageName ?? artist.displayName ?? artist.name
      ),
      credits = [
        ...creativeTrackSummaries.map(({ role, summary }) => ({
          contentId: summary.id,
          contentType: "track" as const,
          coverArtUrl: summary.coverArtUrl ?? null,
          ownerName: summary.artistName,
          ownerUsername: summary.artistUsername ?? null,
          role,
          slug: summary.slug,
          title: summary.title,
        })),
        ...creativeProjectSummaries.map(({ role, summary }) => ({
          contentId: summary.id,
          contentType: "project" as const,
          coverArtUrl: summary.coverArtUrl ?? null,
          ownerName: summary.artistName ?? "SoundKit Artist",
          ownerUsername: summary.artistUsername ?? null,
          projectType: summary.projectType,
          role,
          slug: summary.slug,
          title: summary.title,
        })),
      ];

    return c.json(
      {
        credits: section === "all" || section === "credits" ? credits : [],
        featuredProjects,
        featuredTracks,
        hasMore: {
          credits: section === "feed" ? creditAvailability : false,
          projects:
            section === "feed" && ownedProjectRows.length > feedProjectLimit,
          tracks: section === "feed" && ownedTrackRows.length > feedTrackLimit,
          videos: section === "feed" && videoRows.length > feedVideoLimit,
        },
        projects: ownedProjects,
        tracks: ownedTracks,
        videos: (section === "feed"
          ? videoRows.slice(0, feedVideoLimit)
          : videoRows
        ).map((row) =>
          profileVideoSummary({
            artist: {
              avatarUrl: publicProfileAssetUrl({
                fallbackUrl: artist.avatarUrl,
                objectKey: artist.avatarObjectKey,
              }),
              name: artistName,
              username: artist.username,
            },
            genre: row.genre,
            state: artist.state,
            video: row.video,
            viewCount: row.viewCount,
          })
        ),
      },
      HttpStatusCodes.OK
    );
  }
);

export default app;
