import { google } from "@ai-sdk/google";
/* eslint-disable one-var, sort-vars, complexity, unicorn/max-nested-calls */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistProfiles,
  genres,
  projectAssets,
  projects,
  searchEmbeddings,
  trackAssets,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { embed } from "ai";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  embeddingModelName,
  indexSearchEntity,
  normalizeEmbeddingVector,
} from "@/lib/audio-processing";
import type { SaveEmbeddingStatus } from "@/lib/audio-processing";
import type { GeoTier } from "@/lib/geo-search";

export const SEMANTIC_DEFAULT_MAX_DISTANCE = 0.8,
  SEMANTIC_MAX_LIMIT = 50,
  LYRIC_CHUNK_TARGET_CHARS = 1200,
  LYRIC_CHUNK_MAX_CHARS = 1500,
  LYRIC_TINY_FRAGMENT_CHARS = 15,
  LYRIC_CHUNK_CAP = 32,
  SNIPPET_CHARS = 200;

export type SemanticEntityType =
  | "artist"
  | "lyrics"
  | "project"
  | "track"
  | "video";

export interface LyricChunk {
  section: string | null;
  text: string;
}

export interface SemanticCandidate {
  distance: number;
  entityId: string;
  entityType: SemanticEntityType;
  metadata: Record<string, unknown> | null;
  textSnapshot: string;
}

export interface RolledUpMatch {
  distance: number;
  entityId: string;
  entityType: Exclude<SemanticEntityType, "lyrics">;
  matchedVia: "lyrics" | "metadata";
  snippet: string | null;
}

export interface HydratedSemanticResult {
  artistName: string | null;
  coverArtUrl: string | null;
  entityId: string;
  entityType: Exclude<SemanticEntityType, "lyrics">;
  geoTier: GeoTier;
  matchedVia: "lyrics" | "metadata";
  score: number;
  snippet: string | null;
  state: string | null;
  subtitle: string | null;
  title: string;
}

/**
 * Split lyric text into section-aware chunks. Splits on [Section] headers
 * or blank-line groups, merges fragments, hard-splits oversized chunks on
 * line boundaries, caps total chunks. Pure — worker-tested.
 */
export const chunkLyricSections = (text: string): LyricChunk[] => {
  const normalized = text.replaceAll("\r\n", "\n").trim();
  if (!normalized) {
    return [];
  }
  const rawSections: LyricChunk[] = [];
  let currentSection: string | null = null,
    currentLines: string[] = [];
  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body) {
      rawSections.push({ section: currentSection, text: body });
    }
    currentLines = [];
  };
  for (const line of normalized.split("\n")) {
    const header = /^\[(?<section>.+)\]$/u.exec(line.trim());
    if (header?.groups?.section) {
      flush();
      currentSection = header.groups.section.trim().slice(0, 80);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    currentLines.push(line);
  }
  flush();

  const merged: LyricChunk[] = [];
  for (let index = 0; index < rawSections.length; index += 1) {
    const section = rawSections[index];
    // Only interjection-sized fragments merge — and never across a
    // section boundary into a labeled previous chunk. A tiny leading
    // fragment folds into the next section instead.
    if (section && section.text.length < LYRIC_TINY_FRAGMENT_CHARS) {
      const previous = merged.at(-1);
      if (previous && previous.section === section.section) {
        previous.text = `${previous.text}\n${section.text}`;
        continue;
      }
      const next = rawSections[index + 1];
      if (next) {
        next.text = `${section.text}\n${next.text}`;
        continue;
      }
    }
    if (section) {
      merged.push({ ...section });
    }
  }

  const chunks: LyricChunk[] = [];
  for (const section of merged) {
    if (section.text.length <= LYRIC_CHUNK_MAX_CHARS) {
      chunks.push(section);
      continue;
    }
    // Hard-split oversized chunks on line boundaries with slight overlap.
    const lines = section.text.split("\n");
    let buffer = "";
    for (const line of lines) {
      if (
        buffer.length + line.length + 1 > LYRIC_CHUNK_TARGET_CHARS &&
        buffer.trim()
      ) {
        chunks.push({ section: section.section, text: buffer.trim() });
        const overlap = buffer.split("\n").slice(-2).join("\n");
        buffer = `${overlap}\n${line}`;
      } else {
        buffer = buffer ? `${buffer}\n${line}` : line;
      }
    }
    if (buffer.trim()) {
      chunks.push({ section: section.section, text: buffer.trim() });
    }
  }
  return chunks.slice(0, LYRIC_CHUNK_CAP);
};

/**
 * Labeled index blob for a track. Labels help the embedding model weight
 * fields; artist + genre carry most of the retrieval value after lyrics.
 * Pure — worker-tested.
 */
export const buildTrackIndexText = ({
  artistName,
  bpm,
  description,
  genreName,
  musicalKey,
  title,
}: {
  artistName?: string | null;
  bpm?: number | null;
  description?: string | null;
  genreName?: string | null;
  musicalKey?: string | null;
  title: string;
}): string =>
  [
    `Title: ${title}`,
    artistName ? `Artist: ${artistName}` : null,
    genreName ? `Genre: ${genreName}` : null,
    musicalKey ? `Key: ${musicalKey}` : null,
    bpm ? `Tempo: ${bpm} BPM` : null,
    description ? `Description: ${description}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

type DbClient = ReturnType<typeof createDb>;

export const getTrackIndexText = async (
  db: DbClient,
  track: {
    bpm: number | null;
    description: string | null;
    genreId: string | null;
    musicalKey: string | null;
    ownerUserId: string;
    title: string;
  }
): Promise<string> => {
  const [[genreRow], [profileRow]] = await Promise.all([
    track.genreId
      ? db
          .select({ name: genres.name })
          .from(genres)
          .where(eq(genres.id, track.genreId))
          .limit(1)
      : [],
    db
      .select({
        displayName: userProfiles.displayName,
        stageName: artistProfiles.stageName,
        username: userProfiles.username,
      })
      .from(userProfiles)
      .leftJoin(artistProfiles, eq(artistProfiles.userId, userProfiles.userId))
      .where(eq(userProfiles.userId, track.ownerUserId))
      .limit(1),
  ]);
  return buildTrackIndexText({
    artistName:
      profileRow?.stageName ??
      profileRow?.displayName ??
      profileRow?.username ??
      null,
    bpm: track.bpm,
    description: track.description,
    genreName: genreRow?.name ?? null,
    musicalKey: track.musicalKey,
    title: track.title,
  });
};

/**
 * Index a lyrics document as one whole-song row plus per-section chunks.
 * Chunks carry { trackId } in metadata so query-time rollup resolves to
 * the song. Pure rollup companion below.
 */
export const indexTrackLyrics = async ({
  lyricsId,
  organizationId,
  text,
  trackId,
}: {
  lyricsId: string;
  organizationId: string | null;
  text: string;
  trackId: string;
}): Promise<{ inserted: number; skipped: number }> => {
  const tally = { inserted: 0, skipped: 0 },
    count = (status: SaveEmbeddingStatus) => {
      if (status === "inserted") {
        tally.inserted += 1;
      } else {
        tally.skipped += 1;
      }
    };
  if (!text.trim()) {
    return tally;
  }
  count(
    await indexSearchEntity({
      entityId: lyricsId,
      entityType: "lyrics",
      metadata: { kind: "lyrics-full", lyricsId, trackId },
      organizationId,
      text,
    })
  );
  const chunks = chunkLyricSections(text);
  if (chunks.length <= 1) {
    return tally;
  }
  let index = 0;
  for (const chunk of chunks) {
    count(
      await indexSearchEntity({
        entityId: `${lyricsId}#${index}`,
        entityType: "lyrics",
        metadata: {
          chunkCount: chunks.length,
          chunkIndex: index,
          kind: "lyrics-chunk",
          lyricsId,
          section: chunk.section,
          trackId,
        },
        organizationId,
        text: chunk.text,
      })
    );
    index += 1;
  }
  return tally;
};

const snippetFor = (text: string): string =>
  text.length > SNIPPET_CHARS
    ? `${text.slice(0, SNIPPET_CHARS).trimEnd()}…`
    : text;

/**
 * Roll chunk-level candidates up to songs: group lyric rows by
 * metadata.trackId keeping the best (min-distance) chunk, merge with
 * direct hits, sort, cut. Pure — worker-tested.
 */
export const rollupSemanticMatches = (
  candidates: SemanticCandidate[],
  limit: number
): RolledUpMatch[] => {
  const byKey = new Map<string, RolledUpMatch>();
  for (const candidate of candidates) {
    if (candidate.entityType === "lyrics") {
      const trackId =
        candidate.metadata && typeof candidate.metadata.trackId === "string"
          ? candidate.metadata.trackId
          : null;
      if (!trackId) {
        continue;
      }
      const key = `track:${trackId}`,
        current = byKey.get(key);
      if (!current || candidate.distance < current.distance) {
        byKey.set(key, {
          distance: candidate.distance,
          entityId: trackId,
          entityType: "track",
          matchedVia: "lyrics",
          snippet: snippetFor(candidate.textSnapshot),
        });
      }
      continue;
    }
    const key = `${candidate.entityType}:${candidate.entityId}`,
      current = byKey.get(key);
    if (!current || candidate.distance < current.distance) {
      byKey.set(key, {
        distance: candidate.distance,
        entityId: candidate.entityId,
        entityType: candidate.entityType,
        matchedVia: "metadata",
        snippet:
          candidate.entityType === "video" || candidate.entityType === "project"
            ? snippetFor(candidate.textSnapshot)
            : null,
      });
    }
  }
  return [...byKey.values()]
    .toSorted((a, b) => a.distance - b.distance)
    .slice(0, Math.max(limit, 1));
};

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

export const searchSemanticEntities = async ({
  entityTypes,
  limit = 12,
  maxDistance = SEMANTIC_DEFAULT_MAX_DISTANCE,
  text,
}: {
  entityTypes?: SemanticEntityType[];
  limit?: number;
  maxDistance?: number;
  text: string;
}): Promise<RolledUpMatch[]> => {
  if (
    !isDatabaseConfigured() ||
    !text.trim() ||
    !getEnvValue("GOOGLE_GENERATIVE_AI_API_KEY")
  ) {
    return [];
  }
  const cappedLimit = Math.min(Math.max(limit, 1), SEMANTIC_MAX_LIMIT),
    result = await embed({
      model: google.embedding(embeddingModelName()),
      value: text,
    }),
    vector = `[${normalizeEmbeddingVector(result.embedding).join(",")}]`,
    rows = await createDb()
      .select({
        distance: sql<number>`${searchEmbeddings.embedding} <=> ${vector}::vector`,
        entityId: searchEmbeddings.entityId,
        entityType: searchEmbeddings.entityType,
        metadata: searchEmbeddings.metadata,
        textSnapshot: searchEmbeddings.textSnapshot,
      })
      .from(searchEmbeddings)
      .where(
        entityTypes && entityTypes.length > 0
          ? inArray(searchEmbeddings.entityType, entityTypes)
          : undefined
      )
      .orderBy(asc(sql`${searchEmbeddings.embedding} <=> ${vector}::vector`))
      .limit(Math.min(cappedLimit * 3 + 10, 100));

  return rollupSemanticMatches(
    rows.map((row) => ({
      distance: Number(row.distance),
      entityId: row.entityId,
      entityType: row.entityType as SemanticEntityType,
      metadata: (row.metadata ?? null) as Record<string, unknown> | null,
      textSnapshot: row.textSnapshot,
    })),
    cappedLimit
  ).filter((match) => match.distance <= maxDistance);
};

const similarityOf = (distance: number): number =>
  Math.max(0, Math.min(1, 1 - distance / 2));

interface HydrationLookups {
  genreById: Map<string, string>;
  ownerById: Map<
    string,
    {
      displayName: string | null;
      stageName: string | null;
      state: string | null;
      username: string;
    }
  >;
  projectCoverById: Map<string, string | null>;
  trackCoverById: Map<string, string | null>;
}

interface HydrationRows {
  artistRows: {
    profile: typeof artistProfiles.$inferSelect;
    user: typeof userProfiles.$inferSelect;
  }[];
  projectRows: (typeof projects.$inferSelect)[];
  trackRows: (typeof tracks.$inferSelect)[];
  videoRows: (typeof videos.$inferSelect)[];
}

const idsFor = (
    matches: RolledUpMatch[],
    entityType: RolledUpMatch["entityType"]
  ): string[] =>
    matches
      .filter((match) => match.entityType === entityType)
      .map((match) => match.entityId),
  collectOwnerIds = (rows: HydrationRows): string[] => {
    const ids = [
      ...rows.trackRows.map((row) => row.ownerUserId),
      ...rows.projectRows.map((row) => row.ownerUserId),
      ...rows.videoRows.map((row) => row.ownerUserId),
    ].filter((id): id is string => Boolean(id));
    return [...new Set(ids)];
  },
  fetchHydrationRows = async (
    db: DbClient,
    matches: RolledUpMatch[]
  ): Promise<HydrationRows> => {
    const trackIds = idsFor(matches, "track"),
      projectIds = idsFor(matches, "project"),
      videoIds = idsFor(matches, "video"),
      artistIds = idsFor(matches, "artist"),
      [trackRows, projectRows, videoRows, artistRows] = await Promise.all([
        trackIds.length > 0
          ? db.select().from(tracks).where(inArray(tracks.id, trackIds))
          : [],
        projectIds.length > 0
          ? db.select().from(projects).where(inArray(projects.id, projectIds))
          : [],
        videoIds.length > 0
          ? db.select().from(videos).where(inArray(videos.id, videoIds))
          : [],
        artistIds.length > 0
          ? db
              .select({ profile: artistProfiles, user: userProfiles })
              .from(artistProfiles)
              .innerJoin(
                userProfiles,
                eq(userProfiles.userId, artistProfiles.userId)
              )
              .where(inArray(artistProfiles.userId, artistIds))
          : [],
      ]);
    return { artistRows, projectRows, trackRows, videoRows };
  },
  fetchHydrationLookups = async (
    db: DbClient,
    rows: HydrationRows
  ): Promise<HydrationLookups> => {
    const trackIds = rows.trackRows.map((row) => row.id),
      projectIds = rows.projectRows.map((row) => row.id),
      ownerIds = collectOwnerIds(rows),
      [ownerRows, genreRows, trackCoverRows, projectCoverRows] =
        await Promise.all([
          ownerIds.length > 0
            ? db
                .select({
                  displayName: userProfiles.displayName,
                  stageName: artistProfiles.stageName,
                  state: userProfiles.state,
                  userId: userProfiles.userId,
                  username: userProfiles.username,
                })
                .from(userProfiles)
                .leftJoin(
                  artistProfiles,
                  eq(artistProfiles.userId, userProfiles.userId)
                )
                .where(inArray(userProfiles.userId, ownerIds))
            : [],
          db.select().from(genres),
          trackIds.length > 0
            ? db
                .select({
                  objectKey: trackAssets.objectKey,
                  trackId: trackAssets.trackId,
                })
                .from(trackAssets)
                .where(
                  and(
                    inArray(trackAssets.trackId, trackIds),
                    eq(trackAssets.assetKind, "cover_art")
                  )
                )
            : [],
          projectIds.length > 0
            ? db
                .select({
                  objectKey: projectAssets.objectKey,
                  projectId: projectAssets.projectId,
                })
                .from(projectAssets)
                .where(
                  and(
                    inArray(projectAssets.projectId, projectIds),
                    eq(projectAssets.assetKind, "cover_art")
                  )
                )
            : [],
        ]);
    return {
      genreById: new Map(genreRows.map((row) => [row.id, row.name])),
      ownerById: new Map(ownerRows.map((row) => [row.userId, row])),
      projectCoverById: new Map(
        projectCoverRows.map((row) => [row.projectId, row.objectKey])
      ),
      trackCoverById: new Map(
        trackCoverRows.map((row) => [row.trackId, row.objectKey])
      ),
    };
  },
  ownerDisplayName = (
    lookups: HydrationLookups,
    ownerUserId: string | null
  ): { artistName: string | null; state: string | null } => {
    const owner = ownerUserId ? lookups.ownerById.get(ownerUserId) : undefined;
    return {
      artistName:
        owner?.stageName ?? owner?.displayName ?? owner?.username ?? null,
      state: owner?.state ?? null,
    };
  },
  hydrateTrackMatch = (
    lookups: HydrationLookups,
    match: RolledUpMatch,
    row: typeof tracks.$inferSelect
  ): HydratedSemanticResult | null => {
    if (!row.isPublic) {
      return null;
    }
    const owner = ownerDisplayName(lookups, row.ownerUserId);
    return {
      artistName: owner.artistName,
      coverArtUrl: lookups.trackCoverById.get(row.id) ?? null,
      entityId: row.id,
      entityType: "track",
      geoTier: "national",
      matchedVia: match.matchedVia,
      score: similarityOf(match.distance),
      snippet: match.snippet,
      state: owner.state,
      subtitle: row.genreId
        ? (lookups.genreById.get(row.genreId) ?? null)
        : null,
      title: row.title,
    };
  },
  hydrateProjectMatch = (
    lookups: HydrationLookups,
    match: RolledUpMatch,
    row: typeof projects.$inferSelect
  ): HydratedSemanticResult | null => {
    if (!row.isPublic) {
      return null;
    }
    const owner = ownerDisplayName(lookups, row.ownerUserId);
    return {
      artistName: owner.artistName,
      coverArtUrl: lookups.projectCoverById.get(row.id) ?? null,
      entityId: row.id,
      entityType: "project",
      geoTier: "national",
      matchedVia: match.matchedVia,
      score: similarityOf(match.distance),
      snippet: match.snippet,
      state: owner.state,
      subtitle: row.projectType ?? null,
      title: row.title,
    };
  },
  hydrateVideoMatch = (
    lookups: HydrationLookups,
    match: RolledUpMatch,
    row: typeof videos.$inferSelect
  ): HydratedSemanticResult | null => {
    if (!row.isPublic) {
      return null;
    }
    const owner = ownerDisplayName(lookups, row.ownerUserId);
    return {
      artistName: owner.artistName,
      coverArtUrl: row.thumbnailUrl,
      entityId: row.id,
      entityType: "video",
      geoTier: "national",
      matchedVia: match.matchedVia,
      score: similarityOf(match.distance),
      snippet: match.snippet,
      state: owner.state,
      subtitle: null,
      title: row.title,
    };
  },
  hydrateArtistMatch = (
    match: RolledUpMatch,
    row: HydrationRows["artistRows"][number] | undefined
  ): HydratedSemanticResult | null => {
    if (!row || !row.profile.publicProfileEnabled) {
      return null;
    }
    return {
      artistName: null,
      coverArtUrl: row.user.avatarUrl,
      entityId: row.profile.userId,
      entityType: "artist",
      geoTier: "national",
      matchedVia: match.matchedVia,
      score: similarityOf(match.distance),
      snippet: null,
      state: row.user.state,
      subtitle: row.user.username,
      title: row.profile.stageName ?? row.user.displayName ?? row.user.username,
    };
  };

/**
 * Hydrate rolled-up matches with titles/covers/artists and enforce
 * visibility at read time (defense in depth — ranking-time predicates
 * arrive with the ANN index). Non-visible or orphaned rows are dropped.
 */
export const hydrateSemanticResults = async (
  matches: RolledUpMatch[]
): Promise<HydratedSemanticResult[]> => {
  if (matches.length === 0 || !isDatabaseConfigured()) {
    return [];
  }
  const db = createDb(),
    rows = await fetchHydrationRows(db, matches),
    lookups = await fetchHydrationLookups(db, rows),
    results: HydratedSemanticResult[] = [];
  for (const match of matches) {
    let hydrated: HydratedSemanticResult | null = null;
    if (match.entityType === "track") {
      const row = rows.trackRows.find((track) => track.id === match.entityId);
      hydrated = row ? hydrateTrackMatch(lookups, match, row) : null;
    } else if (match.entityType === "project") {
      const row = rows.projectRows.find(
        (project) => project.id === match.entityId
      );
      hydrated = row ? hydrateProjectMatch(lookups, match, row) : null;
    } else if (match.entityType === "video") {
      const row = rows.videoRows.find((video) => video.id === match.entityId);
      hydrated = row ? hydrateVideoMatch(lookups, match, row) : null;
    } else if (match.entityType === "artist") {
      hydrated = hydrateArtistMatch(
        match,
        rows.artistRows.find(
          (artist) => artist.profile.userId === match.entityId
        )
      );
    }
    if (hydrated) {
      results.push(hydrated);
    }
  }
  return results;
};
