/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  playbackSessions,
  profileLinks,
  projectCollaborators,
  projectTracks,
  projects,
  trackCollaborators,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { publicProfileAssetUrl } from "@/lib/asset-urls";
import {
  buildProjectSummary,
  buildTrackSummary,
} from "@/lib/dashboard-mappers";
import { canonicalGenreName } from "@/lib/genre-catalog";
import {
  genreSlugFromExploreFilter,
  profileRegionCondition,
  regionSlugFromUser,
} from "@/lib/public-explore";
import { sampleArtists } from "@/lib/sample-data";
import {
  artistProfileMediaSchema,
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
  ), 0)`,
  artistTotalPlays = sql<number>`coalesce((
    select count(${playbackSessions.id})::int
    from ${playbackSessions}
    inner join ${tracks} on ${tracks.id} = ${playbackSessions.trackId}
    where ${tracks.ownerUserId} = ${artistProfiles.userId}
  ), 0)`,
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
      : desc(
          sql`coalesce(${artistTotalPlays}, 0) * 10 + ${artistProfiles.followerCount} * 5 + coalesce(${artistWeeklyPlays}, 0) * 20`
        );
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
          avatarUrl: "/placeholder-user.jpg",
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
          rank = hasActivity ? index + offset + 1 : null,
          weeklyPlays =
            artist.weeklyPlays > 0
              ? artist.weeklyPlays
              : (artist.totalPlays ?? 0);

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
            avatarObjectKey: userProfiles.avatarObjectKey,
            avatarUrl: userProfiles.avatarUrl,
            battleCount: artistProfiles.battleCount,
            bio: userProfiles.bio,
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
            .where(eq(tracks.ownerUserId, artist.id)),
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
            coverImageUrl: publicProfileAssetUrl({
              fallbackUrl: artist.headerUrl,
              objectKey: artist.headerObjectKey,
            }),
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
            weeklyPlays,
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

app.openapi(
  createRoute({
    method: "get",
    path: "/{username}/media",
    request: {
      params: z.object({
        username: z.string(),
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
      projects: [],
      tracks: [],
      videos: [],
    };

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

    const [
        ownedTrackRows,
        ownedProjectRows,
        collaborationTrackRows,
        collaborationProjectRows,
        videoRows,
      ] = await Promise.all([
        db
          .select()
          .from(tracks)
          .where(
            and(
              eq(tracks.ownerUserId, artist.userId),
              eq(tracks.isPublic, true)
            )
          )
          .orderBy(desc(tracks.updatedAt))
          .limit(50),
        db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.ownerUserId, artist.userId),
              eq(projects.isPublic, true)
            )
          )
          .orderBy(desc(projects.updatedAt))
          .limit(50),
        db
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
              ne(tracks.ownerUserId, artist.userId)
            )
          )
          .orderBy(desc(tracks.updatedAt)),
        db
          .select({
            project: projects,
            role: projectCollaborators.collaboratorRole,
          })
          .from(projectCollaborators)
          .innerJoin(projects, eq(projects.id, projectCollaborators.projectId))
          .where(
            and(
              eq(projectCollaborators.collaboratorUserId, artist.userId),
              eq(projectCollaborators.invitationStatus, "accepted"),
              eq(projects.isPublic, true),
              ne(projects.ownerUserId, artist.userId)
            )
          )
          .orderBy(desc(projects.updatedAt)),
        db
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
          .limit(50),
      ]),
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
      performingTrackIds = performingTrackRows.map((row) => row.track.id),
      featuredTrackProjectRows =
        performingTrackIds.length > 0
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
        performingTrackRows.map((row) => [row.track.id, row.track])
      ),
      featuredProjectById = new Map([
        ...performingProjectRows.map(
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
        Promise.all(ownedTrackRows.map((row) => buildTrackSummary(row))),
        Promise.all(ownedProjectRows.map((row) => buildProjectSummary(row))),
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
        credits,
        featuredProjects,
        featuredTracks,
        projects: ownedProjects,
        tracks: ownedTracks,
        videos: videoRows.map((row) =>
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
