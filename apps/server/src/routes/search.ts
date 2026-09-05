/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  projectAssets,
  projectTracks,
  projects,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { publicProjectAssetUrl } from "@/lib/asset-urls";
import { fuseRankings, searchAudioEntities } from "@/lib/audio-embeddings";
import { buildTrackSummary } from "@/lib/dashboard-mappers";
import { canonicalGenreName } from "@/lib/genre-catalog";
import {
  applyGeoScope,
  implicitScopeFromHeaders,
  normalizeStateCode,
  parseSearchQuery,
} from "@/lib/geo-search";
import type { GeoScope } from "@/lib/geo-search";
import { sampleArtists, sampleProjects, sampleTracks } from "@/lib/sample-data";
import {
  publicSearchQuerySchema,
  publicSearchResultSchema,
} from "@/lib/schemas";
import {
  hydrateSemanticResults,
  searchSemanticEntities,
} from "@/lib/semantic-search";
import type { RolledUpMatch } from "@/lib/semantic-search";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const matchKeyOf = (match: RolledUpMatch): string =>
  `${match.entityType}:${match.entityId}`;

interface SemanticGeoParams {
  boostStates: string[];
  parsedEntityTypes: ("artist" | "project" | "track" | "video")[] | undefined;
  poolLimit: number;
  queryText: string;
  scope: GeoScope;
  scopeStates: string[];
}

/**
 * Explicit ?state wins; NL-parsed states next; CDN header region is a
 * boost-only signal, never a filter.
 */
const resolveSemanticGeoParams = ({
  headers,
  limit,
  q,
  scopeParam,
  stateParam,
}: {
  headers: Headers;
  limit: number;
  q: string;
  scopeParam: string | undefined;
  stateParam: string | undefined;
}): SemanticGeoParams => {
  const parsed = parseSearchQuery(q),
    explicitStates = (stateParam ?? "")
      .split(",")
      .map((part) => normalizeStateCode(part))
      .filter((code): code is string => Boolean(code)),
    scope: GeoScope = scopeParam === "state" ? "state" : "all",
    scopeStates =
      explicitStates.length > 0 ? explicitStates : (parsed?.states ?? []),
    boostStates =
      scopeStates.length > 0 ? scopeStates : implicitScopeFromHeaders(headers),
    geoActive = scopeStates.length > 0 || boostStates.length > 0;
  return {
    boostStates,
    parsedEntityTypes: parsed?.entityTypes,
    poolLimit: Math.min(limit * (geoActive ? 4 : 1), 50),
    queryText: parsed?.vectorText ?? q,
    scope,
    scopeStates,
  };
};

/**
 * Blend text evidence with stored audio vectors. Audio-only hits join
 * as track matches with derived distances so thresholding stays
 * comparable. No stored audio vectors = text ranking unchanged.
 */
const fuseWithAudio = async ({
  fuseWeight,
  matches,
  maxDistance,
  text,
}: {
  fuseWeight: number;
  matches: RolledUpMatch[];
  maxDistance: number | undefined;
  text: string;
}): Promise<RolledUpMatch[]> => {
  const audioHits = await searchAudioEntities({ limit: 50, text });
  if (audioHits.length === 0) {
    return matches;
  }
  const fused = fuseRankings({
      audio: audioHits.map((hit) => ({
        id: `track:${hit.entityId}`,
        similarity: Math.max(-1, Math.min(1, 1 - hit.distance / 2)),
      })),
      audioWeight: fuseWeight,
      text: matches.map((match) => ({
        id: matchKeyOf(match),
        score: Math.max(0, Math.min(1, 1 - match.distance / 2)),
      })),
    }),
    byKey = new Map(matches.map((match) => [matchKeyOf(match), match]));
  const combined = fused.map((entry) => {
    const existing = byKey.get(entry.id);
    if (existing) {
      return existing;
    }
    const [, trackId] = entry.id.split(":");
    return {
      distance: (1 - (entry.audioScore ?? 0)) * 2,
      entityId: trackId ?? entry.id,
      entityType: "track" as const,
      matchedVia: "metadata" as const,
      snippet: null,
    };
  });
  return maxDistance === undefined
    ? combined
    : combined.filter((match) => match.distance <= maxDistance);
};

app.get("/semantic", async (c) => {
  const q = c.req.query("q")?.trim() ?? "",
    rawLimit = Number(c.req.query("limit") ?? 12),
    limit = Number.isFinite(rawLimit) ? Math.max(rawLimit, 1) : 12,
    threshold = Number(c.req.query("threshold") ?? ""),
    maxDistance =
      Number.isFinite(threshold) && threshold > 0 ? threshold : undefined,
    geo = resolveSemanticGeoParams({
      headers: c.req.raw.headers,
      limit,
      q,
      scopeParam: c.req.query("scope"),
      stateParam: c.req.query("state"),
    }),
    matches = await searchSemanticEntities({
      entityTypes: geo.parsedEntityTypes,
      limit: geo.poolLimit,
      maxDistance,
      text: geo.queryText,
    }),
    fuseWeight = Math.max(0, Math.min(1, Number(c.req.query("fuse") ?? 0))),
    fusedMatches: RolledUpMatch[] =
      fuseWeight > 0
        ? await fuseWithAudio({
            fuseWeight,
            matches,
            maxDistance,
            text: geo.queryText,
          })
        : matches,
    hydrated = await hydrateSemanticResults(fusedMatches),
    scoped = applyGeoScope(
      hydrated,
      geo.scope,
      geo.scopeStates.length > 0 ? geo.scopeStates : geo.boostStates
    );
  return c.json(scoped.slice(0, limit), HttpStatusCodes.OK);
});

const normalizeState = (state: string | undefined) => {
    const value = state?.trim();

    return value || null;
  },
  likeTerm = (value: string) => `%${value.replaceAll("%", "\\%")}%`,
  locationLabel = ({
    city,
    state,
  }: {
    city: string | null;
    state: string | null;
  }) => [city, state].filter(Boolean).join(", "),
  sampleSearch = ({
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
    const needle = q.toLowerCase(),
      stateNeedle = state?.toLowerCase(),
      matchesText = (values: string[]) =>
        !needle || values.some((value) => value.toLowerCase().includes(needle)),
      matchesState = (location: string) =>
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
    const query = c.req.valid("query"),
      q = query.q.trim(),
      state = normalizeState(query.state),
      term = likeTerm(q),
      stateTerm = state ? likeTerm(state) : null;

    if (!isDatabaseConfigured()) {
      return c.json(
        publicSearchResultSchema.parse(sampleSearch(query)),
        HttpStatusCodes.OK
      );
    }

    const db = createDb(),
      searchArtists = query.type === "all" || query.type === "artists",
      searchTracks = query.type === "all" || query.type === "tracks",
      searchProjects = query.type === "all" || query.type === "projects",
      [artistRows, trackRows, projectRows] = await Promise.all([
        searchArtists
          ? db
              .select({
                avatarUrl: userProfiles.avatarUrl,
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
      ]),
      trackSummaries = [];

    for (const row of trackRows) {
      trackSummaries.push(await buildTrackSummary(row.tracks));
    }

    const projectCoverRows =
        projectRows.length > 0
          ? await db
              .select({
                objectKey: projectAssets.objectKey,
                projectId: projectAssets.projectId,
              })
              .from(projectAssets)
              .where(
                and(
                  inArray(
                    projectAssets.projectId,
                    projectRows.map((project) => project.id)
                  ),
                  eq(projectAssets.assetKind, "cover_art")
                )
              )
              .orderBy(desc(projectAssets.updatedAt))
          : [],
      projectCoverById = new Map<string, (typeof projectCoverRows)[number]>();

    for (const asset of projectCoverRows) {
      if (!projectCoverById.has(asset.projectId)) {
        projectCoverById.set(asset.projectId, asset);
      }
    }

    const response = publicSearchResultSchema.parse({
      artists: artistRows.map((artist) => ({
        avatarUrl:
          (artist as unknown as { avatarUrl: string | null }).avatarUrl ?? null,
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
        coverArtUrl: publicProjectAssetUrl(projectCoverById.get(project.id)),
        releaseDate: project.releaseDate?.toISOString() ?? null,
      })),
      tracks: trackSummaries,
    });

    return c.json(response, HttpStatusCodes.OK);
  }
);

export default app;
