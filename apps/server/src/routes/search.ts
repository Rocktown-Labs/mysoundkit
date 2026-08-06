import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  projectTracks,
  projects,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { canonicalGenreName } from "@/lib/genre-catalog";
import { sampleArtists, sampleProjects, sampleTracks } from "@/lib/sample-data";
import {
  publicSearchQuerySchema,
  publicSearchResultSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const normalizeState = (state: string | undefined) => {
  const value = state?.trim();

  return value || null;
};

const likeTerm = (value: string) => `%${value.replaceAll("%", "\\%")}%`;

const locationLabel = ({
  city,
  state,
}: {
  city: string | null;
  state: string | null;
}) => [city, state].filter(Boolean).join(", ");

const sampleSearch = ({
  limit,
  q,
  state,
  type,
}: {
  limit: number;
  q: string;
  state?: string | undefined;
  type: "all" | "artists" | "tracks" | "projects";
}) => {
  const needle = q.toLowerCase();
  const stateNeedle = state?.toLowerCase();
  const matchesText = (values: string[]) =>
    !needle || values.some((value) => value.toLowerCase().includes(needle));
  const matchesState = (location: string) =>
    !stateNeedle || location.toLowerCase().includes(stateNeedle);

  return {
    artists:
      type === "tracks" || type === "projects"
        ? []
        : sampleArtists
            .filter(
              (artist) =>
                matchesText([artist.name, artist.username, artist.genre]) &&
                matchesState(artist.location)
            )
            .slice(0, limit),
    projects:
      type === "artists" || type === "tracks"
        ? []
        : sampleProjects
            .filter((project) => matchesText([project.title]))
            .slice(0, limit)
            .map((project) => ({
              artistName: "SoundKit Artist",
              artistUsername: null,
              coverArtUrl: project.coverArtUrl ?? null,
              id: project.id,
              projectType: project.projectType,
              releaseDate: project.releaseDate ?? null,
              slug: project.slug,
              state: null,
              status: project.status,
              title: project.title,
              trackCount: project.trackCount,
            })),
    tracks:
      type === "artists" || type === "projects"
        ? []
        : sampleTracks
            .filter((track) =>
              matchesText([track.title, track.artistName, track.genre])
            )
            .slice(0, limit),
  };
};

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: {
      query: publicSearchQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        publicSearchResultSchema,
        "Public search results"
      ),
    },
    tags: ["Search"],
  }),
  async (c) => {
    const query = c.req.valid("query");
    const q = query.q.trim();
    const state = normalizeState(query.state);
    const term = likeTerm(q);
    const stateTerm = state ? likeTerm(state) : null;

    if (!isDatabaseConfigured()) {
      return c.json(
        publicSearchResultSchema.parse(sampleSearch(query)),
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const searchArtists = query.type === "all" || query.type === "artists";
    const searchTracks = query.type === "all" || query.type === "tracks";
    const searchProjects = query.type === "all" || query.type === "projects";

    const [artistRows, trackRows, projectRows] = await Promise.all([
      searchArtists
        ? db
            .select({
              city: userProfiles.city,
              displayName: userProfiles.displayName,
              followerCount: artistProfiles.followerCount,
              genre: genres.name,
              id: userProfiles.userId,
              isVerified: artistProfiles.isVerified,
              stageName: artistProfiles.stageName,
              state: userProfiles.state,
              username: userProfiles.username,
            })
            .from(artistProfiles)
            .innerJoin(
              userProfiles,
              eq(userProfiles.userId, artistProfiles.userId)
            )
            .leftJoin(genres, eq(genres.id, artistProfiles.primaryGenreId))
            .where(
              and(
                eq(artistProfiles.publicProfileEnabled, true),
                q
                  ? or(
                      ilike(userProfiles.displayName, term),
                      ilike(userProfiles.username, term),
                      ilike(artistProfiles.stageName, term),
                      ilike(genres.name, term)
                    )
                  : undefined,
                stateTerm ? ilike(userProfiles.state, stateTerm) : undefined
              )
            )
            .orderBy(desc(artistProfiles.followerCount))
            .limit(query.limit)
        : [],
      searchTracks
        ? db
            .select()
            .from(tracks)
            .innerJoin(
              userProfiles,
              eq(userProfiles.userId, tracks.ownerUserId)
            )
            .leftJoin(genres, eq(genres.id, tracks.genreId))
            .where(
              and(
                eq(tracks.isPublic, true),
                q
                  ? or(
                      ilike(tracks.title, term),
                      ilike(userProfiles.displayName, term),
                      ilike(userProfiles.username, term),
                      ilike(genres.name, term)
                    )
                  : undefined,
                stateTerm ? ilike(userProfiles.state, stateTerm) : undefined
              )
            )
            .orderBy(desc(tracks.updatedAt))
            .limit(query.limit)
        : [],
      searchProjects
        ? db
            .select({
              artistName: sql<string>`coalesce(${userProfiles.displayName}, ${authUser.name}, 'SoundKit Artist')`,
              artistUsername: userProfiles.username,
              coverArtUrl: sql<string | null>`null`,
              id: projects.id,
              projectType: projects.projectType,
              releaseDate: projects.releaseDate,
              slug: projects.slug,
              state: userProfiles.state,
              status: projects.status,
              title: projects.title,
              trackCount: sql<number>`count(${projectTracks.trackId})::int`,
            })
            .from(projects)
            .innerJoin(
              userProfiles,
              eq(userProfiles.userId, projects.ownerUserId)
            )
            .innerJoin(authUser, eq(authUser.id, projects.ownerUserId))
            .leftJoin(projectTracks, eq(projectTracks.projectId, projects.id))
            .where(
              and(
                eq(projects.isPublic, true),
                q
                  ? or(
                      ilike(projects.title, term),
                      ilike(userProfiles.displayName, term),
                      ilike(userProfiles.username, term)
                    )
                  : undefined,
                stateTerm ? ilike(userProfiles.state, stateTerm) : undefined
              )
            )
            .groupBy(
              projects.id,
              userProfiles.displayName,
              userProfiles.username,
              userProfiles.state,
              authUser.name
            )
            .orderBy(desc(projects.updatedAt))
            .limit(query.limit)
        : [],
    ]);

    const trackSummaries = [];

    for (const row of trackRows) {
      trackSummaries.push(await buildTrackSummary(row.tracks));
    }

    const response = publicSearchResultSchema.parse({
      artists: artistRows.map((artist) => ({
        followers: artist.followerCount,
        genre: artist.genre
          ? canonicalGenreName(artist.genre)
          : "Uncategorized",
        id: artist.id,
        location: locationLabel({
          city: artist.city,
          state: artist.state,
        }),
        name: artist.stageName ?? artist.displayName ?? artist.username,
        roles: ["musician" as const],
        username: artist.username,
        verified: artist.isVerified,
      })),
      projects: projectRows.map((project) => ({
        ...project,
        releaseDate: project.releaseDate?.toISOString() ?? null,
      })),
      tracks: trackSummaries,
    });

    return c.json(response, HttpStatusCodes.OK);
  }
);

export default app;
