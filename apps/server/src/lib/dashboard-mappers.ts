/* eslint-disable no-nested-ternary */
/* oxlint-disable complexity, one-var, sort-vars, unicorn/max-nested-calls */
import { createDb } from "@soundkit/db";
import {
  genres,
  playbackSessions,
  projectAssets,
  projectCollaborators,
  projectTracks,
  projects,
  trackAssets,
  trackCollaborators,
  trackLyrics,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";

import {
  formatDuration,
  guardedTrackPlaybackUrl,
  publicAssetUrl,
  publicProjectAssetUrl,
} from "@/lib/asset-urls";
import { getDatabaseSchemaCapabilities } from "@/lib/database-schema-capabilities";
import type { SoundKitDatabase } from "@/lib/database-schema-capabilities";
import { canonicalGenreName } from "@/lib/genre-catalog";
import { regionSlugFromUser } from "@/lib/public-explore";
import {
  resolveTrackAssetFromRows,
  resolveTrackCoverAssetFromRows,
} from "@/lib/track-asset-resolver";

type ProjectAssetBase = Pick<
  InferSelectModel<typeof projectAssets>,
  | "assetKind"
  | "bucketName"
  | "createdAt"
  | "exportVersion"
  | "id"
  | "metadata"
  | "mimeType"
  | "muxAssetId"
  | "muxPlaybackId"
  | "muxUploadId"
  | "objectKey"
  | "projectId"
  | "sizeBytes"
  | "sourceAssetId"
  | "status"
  | "storageProvider"
  | "updatedAt"
  | "uploaderUserId"
>;
type ProjectAssetVersionFields = Pick<
  InferSelectModel<typeof projectAssets>,
  "isCurrent" | "version"
>;
type ProjectAssetRow = ProjectAssetBase & ProjectAssetVersionFields;

const projectAssetColumns = {
    assetKind: projectAssets.assetKind,
    bucketName: projectAssets.bucketName,
    createdAt: projectAssets.createdAt,
    exportVersion: projectAssets.exportVersion,
    id: projectAssets.id,
    metadata: projectAssets.metadata,
    mimeType: projectAssets.mimeType,
    muxAssetId: projectAssets.muxAssetId,
    muxPlaybackId: projectAssets.muxPlaybackId,
    muxUploadId: projectAssets.muxUploadId,
    objectKey: projectAssets.objectKey,
    projectId: projectAssets.projectId,
    sizeBytes: projectAssets.sizeBytes,
    sourceAssetId: projectAssets.sourceAssetId,
    status: projectAssets.status,
    storageProvider: projectAssets.storageProvider,
    updatedAt: projectAssets.updatedAt,
    uploaderUserId: projectAssets.uploaderUserId,
  },
  normalizeProjectAsset = (
    asset: ProjectAssetBase & Partial<ProjectAssetVersionFields>
  ): ProjectAssetRow => ({
    ...asset,
    isCurrent: asset.isCurrent ?? true,
    version: asset.version ?? 1,
  }),
  loadProjectAssets = async ({
    db,
    projectId,
  }: {
    db: SoundKitDatabase;
    projectId: string;
  }): Promise<ProjectAssetRow[]> => {
    const capabilities = await getDatabaseSchemaCapabilities(db);
    if (capabilities.projectAssetVersioning) {
      const rows = await db
        .select({
          ...projectAssetColumns,
          isCurrent: projectAssets.isCurrent,
          version: projectAssets.version,
        })
        .from(projectAssets)
        .where(eq(projectAssets.projectId, projectId));
      return rows.map(normalizeProjectAsset);
    }

    const rows = await db
      .select(projectAssetColumns)
      .from(projectAssets)
      .where(eq(projectAssets.projectId, projectId));
    return rows.map(normalizeProjectAsset);
  },
  mapAssetForDashboard = (
    asset: InferSelectModel<typeof trackAssets> | ProjectAssetRow
  ) => ({
    assetKind: asset.assetKind,
    bucketName: asset.bucketName,
    downloadUrl:
      "trackId" in asset && asset.trackId
        ? `/v1/tracks/${asset.trackId}/assets/${asset.id}/download`
        : "projectId" in asset && asset.projectId
          ? `/v1/projects/${asset.projectId}/assets/${asset.id}/download`
          : null,
    durationMs: "durationMs" in asset ? asset.durationMs : null,
    id: asset.id,
    isCurrent: "isCurrent" in asset ? asset.isCurrent : true,
    metadata: "metadata" in asset ? asset.metadata : null,
    mimeType: asset.mimeType,
    objectKey: asset.objectKey,
    processingVersion:
      "processingVersion" in asset ? asset.processingVersion : null,
    purpose: "purpose" in asset ? asset.purpose : null,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    storageProvider: asset.storageProvider,
    version: "version" in asset ? asset.version : undefined,
  }),
  fileAvailabilityFromAssets = (
    assets: InferSelectModel<typeof trackAssets>[]
  ) => ({
    adlibs: false,
    alternateMixes: assets.filter(
      (asset) => asset.assetKind === "alternate_mix"
    ).length,
    artworks: assets.filter(
      (asset) =>
        (asset.assetKind === "cover_art" || asset.assetKind === "artwork") &&
        asset.isCurrent &&
        Boolean(asset.objectKey) &&
        (asset.status === "ready" || asset.status === "uploaded")
    ).length,
    booklets: assets.filter((asset) => asset.assetKind === "booklet").length,
    cleanVersions: assets.filter((asset) => asset.assetKind === "clean").length,
    coverArt: assets.some(
      (asset) =>
        (asset.assetKind === "cover_art" || asset.assetKind === "artwork") &&
        asset.isCurrent &&
        Boolean(asset.objectKey) &&
        (asset.status === "ready" || asset.status === "uploaded")
    ),
    instrumental: assets.some((asset) => asset.assetKind === "instrumental"),
    instrumentals: assets.filter((asset) => asset.assetKind === "instrumental")
      .length,
    licenses: assets.filter((asset) => asset.assetKind === "license_pdf")
      .length,
    master: assets.some(
      (asset) =>
        asset.assetKind === "master" || asset.assetKind === "untagged_wav"
    ),
    masters: assets.filter((asset) => asset.assetKind === "master").length,
    midi: assets.filter((asset) => asset.assetKind === "midi").length,
    reference: assets.some((asset) => asset.assetKind === "reference_audio"),
    session: assets.some((asset) => asset.assetKind === "session_file"),
    stems: assets.filter((asset) => asset.assetKind === "stems").length,
    taggedMp3s: assets.filter((asset) => asset.assetKind === "tagged_mp3")
      .length,
    untaggedWavs: assets.filter((asset) => asset.assetKind === "untagged_wav")
      .length,
    vocals: assets.filter(
      (asset) =>
        asset.assetKind === "vocal_stem" || asset.assetKind === "verse_vocal"
    ).length,
  }),
  mediaStatusFromAssets = ({
    assets,
    mediaReady,
  }: {
    assets: InferSelectModel<typeof trackAssets>[];
    mediaReady: boolean;
  }): "failed" | "not_started" | "ready" | "running" => {
    if (mediaReady) {
      return "ready";
    }
    if (assets.some((asset) => asset.status === "failed")) {
      return "failed";
    }
    if (assets.some((asset) => asset.status === "processing")) {
      return "running";
    }
    return "not_started";
  };

export const findPublicProjectCoverForTrack = async ({
  db,
  trackId,
}: {
  db: SoundKitDatabase;
  trackId: string;
}): Promise<ProjectAssetRow | null> => {
  const capabilities = await getDatabaseSchemaCapabilities(db);
  if (capabilities.projectAssetVersioning) {
    const rows = await db
      .select({
        asset: {
          ...projectAssetColumns,
          isCurrent: projectAssets.isCurrent,
          version: projectAssets.version,
        },
      })
      .from(projectTracks)
      .innerJoin(projects, eq(projects.id, projectTracks.projectId))
      .innerJoin(
        projectAssets,
        and(
          eq(projectAssets.projectId, projectTracks.projectId),
          eq(projectAssets.assetKind, "cover_art"),
          eq(projectAssets.isCurrent, true),
          inArray(projectAssets.status, ["uploaded", "ready"])
        )
      )
      .where(
        and(eq(projectTracks.trackId, trackId), eq(projects.isPublic, true))
      )
      .orderBy(sql`${projectAssets.updatedAt} desc`)
      .limit(1);
    return rows[0] ? normalizeProjectAsset(rows[0].asset) : null;
  }

  const rows = await db
    .select({ asset: projectAssetColumns })
    .from(projectTracks)
    .innerJoin(projects, eq(projects.id, projectTracks.projectId))
    .innerJoin(
      projectAssets,
      and(
        eq(projectAssets.projectId, projectTracks.projectId),
        eq(projectAssets.assetKind, "cover_art"),
        inArray(projectAssets.status, ["uploaded", "ready"])
      )
    )
    .where(and(eq(projectTracks.trackId, trackId), eq(projects.isPublic, true)))
    .orderBy(sql`${projectAssets.updatedAt} desc`)
    .limit(1);
  return rows[0] ? normalizeProjectAsset(rows[0].asset) : null;
};

export const mapTrackSummary = ({
  artistName,
  artistUsername,
  assets,
  collaboratorCount,
  genre,
  plays = 0,
  regionSlug = null,
  row,
}: {
  artistName: string;
  artistUsername: string | null;
  assets: InferSelectModel<typeof trackAssets>[];
  collaboratorCount: number;
  genre: string | null;
  plays?: number;
  regionSlug?: string | null;
  row: InferSelectModel<typeof tracks>;
}) => {
  const coverAsset = resolveTrackCoverAssetFromRows(assets),
    masterAsset = resolveTrackAssetFromRows({
      assets,
      purpose: "master",
      trackId: row.id,
    }),
    primaryAudioAsset = resolveTrackAssetFromRows({
      allowLegacyFallback: true,
      assets,
      purpose: "streaming",
      trackId: row.id,
    }),
    downloadAsset = resolveTrackAssetFromRows({
      allowLegacyFallback: true,
      assets,
      purpose: "consumer_download",
      trackId: row.id,
    }),
    resolvedDurationMs =
      primaryAudioAsset?.durationMs ??
      assets.find(
        (asset) => typeof asset.durationMs === "number" && asset.durationMs > 0
      )?.durationMs,
    previewAsset = assets.find(
      (asset) =>
        asset.assetKind === "variant_audio" &&
        typeof asset.metadata === "object" &&
        asset.metadata !== null &&
        "variant" in asset.metadata &&
        asset.metadata.variant === "preview_30s"
    ),
    currentLineageAssets = assets.filter(
      (asset) =>
        asset.isCurrent &&
        (asset.id === masterAsset?.id ||
          asset.sourceAssetId === masterAsset?.id)
    ),
    assetStatus = currentLineageAssets.some(
      (asset) => asset.status === "processing"
    )
      ? "processing"
      : (primaryAudioAsset?.status ?? null);

  return {
    artistName,
    artistUsername,
    assetStatus,
    bpm: row.bpm,
    catalogItemType: row.catalogItemType,
    collaboratorCount,
    coverArtUrl: publicAssetUrl(coverAsset ?? undefined),
    downloadUrl: downloadAsset
      ? `/v1/tracks/${row.id}/assets/${downloadAsset.id}/download`
      : null,
    downloadsAllowed: row.downloadsAllowed,
    downloadsRequireFirstPlay: row.downloadsRequireFirstPlay,
    downloadsRequirePurchase: row.downloadsRequirePurchase,
    duration: formatDuration(resolvedDurationMs),
    exclusiveUntil: row.exclusiveUntil?.toISOString() ?? null,
    fileAvailability: fileAvailabilityFromAssets(assets),
    genre: genre ? canonicalGenreName(genre) : "Uncategorized",
    id: row.id,
    isForSale: row.isForSale,
    isPublic: row.isPublic,
    isrc: row.isrc,
    listeningAccess: row.listeningAccess,
    lyricsStatus: row.lyricsStatus,
    masterDownloadUrl: masterAsset
      ? `/v1/tracks/${row.id}/assets/${masterAsset.id}/download`
      : null,
    mediaReady: Boolean(primaryAudioAsset),
    mediaStatus: mediaStatusFromAssets({
      assets: currentLineageAssets,
      mediaReady: Boolean(primaryAudioAsset),
    }),
    musicalKey: row.musicalKey,
    organizationId: row.organizationId,
    playbackUrl:
      row.isForSale &&
      row.listeningAccess === "premium_or_purchased" &&
      (!row.exclusiveUntil || row.exclusiveUntil > new Date())
        ? null
        : primaryAudioAsset
          ? guardedTrackPlaybackUrl(row.id)
          : null,
    plays: plays ?? 0,
    previewUrl: publicAssetUrl(previewAsset),
    price: row.price ? Number(row.price) : null,
    priceCents: row.priceCents,
    productionStatus: row.productionStatus,
    purchaseMode: row.purchaseMode,
    regionSlug,
    releaseAt:
      row.releaseAt instanceof Date
        ? row.releaseAt.toISOString()
        : typeof row.releaseAt === "string"
          ? row.releaseAt
          : null,
    releaseStrategy: row.releaseStrategy,
    slug: row.slug,
    streamingLinks: row.streamingLinks,
    title: row.title,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : typeof row.updatedAt === "string"
          ? row.updatedAt
          : new Date().toISOString(),
  };
};

export const buildTrackSummary = async (
  row: InferSelectModel<typeof tracks>,
  playCountOverride?: number
) => {
  const db = createDb(),
    [profile] = await db
      .select({
        displayName: userProfiles.displayName,
        state: userProfiles.state,
        userName: authUser.name,
        username: userProfiles.username,
      })
      .from(authUser)
      .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
      .where(eq(authUser.id, row.ownerUserId))
      .limit(1),
    [genreRow] = row.genreId
      ? await db
          .select({ name: genres.name })
          .from(genres)
          .where(eq(genres.id, row.genreId))
          .limit(1)
      : [],
    [assetRows, collaboratorRows, playCountRow, publicProjectCover] =
      await Promise.all([
        db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
        db
          .select({ id: trackCollaborators.id })
          .from(trackCollaborators)
          .where(eq(trackCollaborators.trackId, row.id)),
        playCountOverride === undefined
          ? db
              .select({ count: sql<number>`count(*)::int` })
              .from(playbackSessions)
              .where(eq(playbackSessions.trackId, row.id))
          : Promise.resolve([]),
        findPublicProjectCoverForTrack({ db, trackId: row.id }),
      ]),
    actualPlays =
      playCountOverride === undefined
        ? (playCountRow[0]?.count ?? 0)
        : playCountOverride;

  const summary = mapTrackSummary({
    artistName: profile?.displayName ?? profile?.userName ?? "SoundKit Artist",
    artistUsername: profile?.username ?? null,
    assets: assetRows,
    collaboratorCount: collaboratorRows.length,
    genre: genreRow?.name ? canonicalGenreName(genreRow.name) : null,
    plays: actualPlays,
    regionSlug: regionSlugFromUser(profile?.state) ?? null,
    row,
  });

  return publicProjectCover
    ? { ...summary, coverArtUrl: publicAssetUrl(publicProjectCover) }
    : summary;
};

export const buildTrackDetail = async (
  row: InferSelectModel<typeof tracks>
) => {
  const db = createDb(),
    [summary, assetRows, collaboratorRows, lyricsRows] = await Promise.all([
      buildTrackSummary(row),
      db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
      db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          canDelete: trackCollaborators.canDelete,
          canEdit: trackCollaborators.canEdit,
          canUpload: trackCollaborators.canUpload,
          email: trackCollaborators.inviteEmail,
          id: trackCollaborators.id,
          name: userProfiles.displayName,
          role: trackCollaborators.collaboratorRole,
          splitBps: trackCollaborators.creditSplitBps,
          status: trackCollaborators.invitationStatus,
          userId: trackCollaborators.collaboratorUserId,
        })
        .from(trackCollaborators)
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, trackCollaborators.collaboratorUserId)
        )
        .where(eq(trackCollaborators.trackId, row.id)),
      db
        .select({
          approvedAt: trackLyrics.approvedAt,
          id: trackLyrics.id,
          language: trackLyrics.language,
          sourceType: trackLyrics.sourceType,
          status: trackLyrics.status,
          text: trackLyrics.text,
          timedLines: trackLyrics.timedLines,
        })
        .from(trackLyrics)
        .where(eq(trackLyrics.trackId, row.id))
        .orderBy(
          sql`${trackLyrics.approvedAt} desc nulls last`,
          sql`${trackLyrics.createdAt} desc`
        )
        .limit(1),
    ]),
    ownerMaster = resolveTrackAssetFromRows({
      assets: assetRows,
      purpose: "master",
      trackId: row.id,
    });

  return {
    ...summary,
    assets: assetRows
      .filter((asset) => asset.isCurrent)
      .map(mapAssetForDashboard),
    collaborators: collaboratorRows,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    lyrics: lyricsRows[0]?.text ?? null,
    lyricsRevision: lyricsRows[0]
      ? {
          approvedAt: lyricsRows[0].approvedAt?.toISOString() ?? null,
          id: lyricsRows[0].id,
          language: lyricsRows[0].language,
          sourceType: lyricsRows[0].sourceType,
          status: lyricsRows[0].status,
          timedLines: lyricsRows[0].timedLines ?? null,
        }
      : null,
    playbackUrl:
      summary.playbackUrl ??
      (ownerMaster ? guardedTrackPlaybackUrl(row.id) : null),
  };
};

export const buildProjectSummary = async (
  row: InferSelectModel<typeof projects>
) => {
  const db = createDb(),
    [trackRows, assetRows, collaboratorRows, profileRows, projectGenreRows] =
      await Promise.all([
        db
          .select({
            genreName: genres.name,
            id: projectTracks.trackId,
          })
          .from(projectTracks)
          .leftJoin(tracks, eq(tracks.id, projectTracks.trackId))
          .leftJoin(genres, eq(genres.id, tracks.genreId))
          .where(eq(projectTracks.projectId, row.id)),
        loadProjectAssets({ db, projectId: row.id }),
        db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .where(eq(projectCollaborators.projectId, row.id)),
        db
          .select({
            displayName: userProfiles.displayName,
            state: userProfiles.state,
            userName: authUser.name,
            username: userProfiles.username,
          })
          .from(authUser)
          .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
          .where(eq(authUser.id, row.ownerUserId))
          .limit(1),
        row.genreId
          ? db
              .select({ name: genres.name })
              .from(genres)
              .where(eq(genres.id, row.genreId))
              .limit(1)
          : Promise.resolve([]),
      ]),
    trackIds = trackRows.map((track) => track.id),
    primaryGenre =
      trackRows.find((track) => track.genreName)?.genreName ??
      projectGenreRows[0]?.name,
    [ownerProfile] = profileRows,
    durationAssetRows =
      trackIds.length > 0
        ? await db
            .select({
              assetKind: trackAssets.assetKind,
              durationMs: trackAssets.durationMs,
              trackId: trackAssets.trackId,
            })
            .from(trackAssets)
            .where(inArray(trackAssets.trackId, trackIds))
        : [],
    durationByTrackId = new Map<string, number>();

  for (const asset of durationAssetRows) {
    if (!(asset.trackId && asset.durationMs)) {
      continue;
    }

    const shouldUseAsset =
      !durationByTrackId.has(asset.trackId) || asset.assetKind === "master";

    if (shouldUseAsset) {
      durationByTrackId.set(asset.trackId, asset.durationMs);
    }
  }

  let durationMs = 0;

  for (const trackDurationMs of durationByTrackId.values()) {
    durationMs += trackDurationMs;
  }
  const coverAsset = assetRows.find((asset) => asset.assetKind === "cover_art");
  let progress = 25;

  if (row.status === "released") {
    progress = 100;
  } else if (row.status === "scheduled") {
    progress = 75;
  }

  return {
    artistName:
      ownerProfile?.displayName ??
      ownerProfile?.userName ??
      ownerProfile?.username ??
      "SoundKit Artist",
    artistUsername: ownerProfile?.username ?? null,
    collaboratorCount: collaboratorRows.length,
    coverArtUrl: publicProjectAssetUrl(coverAsset),
    description: row.description,
    duration: durationMs > 0 ? formatDuration(durationMs) : "0:00",
    durationMs,
    exclusiveUntil: row.exclusiveUntil?.toISOString() ?? null,
    exportVersion: row.exportVersion,
    genre: primaryGenre ? canonicalGenreName(primaryGenre) : null,
    id: row.id,
    isForSale: row.isForSale,
    isPublic: row.isPublic,
    listeningAccess: row.listeningAccess,
    priceCents: row.priceCents,
    progress,
    projectType: row.projectType,
    regionSlug: regionSlugFromUser(ownerProfile?.state) ?? null,
    releaseDate:
      row.releaseDate instanceof Date
        ? row.releaseDate.toISOString()
        : typeof row.releaseDate === "string"
          ? row.releaseDate
          : null,
    slug: row.slug,
    status: row.status,
    streamingLinks: row.streamingLinks,
    title: row.title,
    trackCount: trackRows.length,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : typeof row.updatedAt === "string"
          ? row.updatedAt
          : new Date().toISOString(),
  };
};

export const buildProjectDetail = async (
  row: InferSelectModel<typeof projects>
) => {
  const db = createDb(),
    [summary, assetRows, collaboratorRows, trackRows] = await Promise.all([
      buildProjectSummary(row),
      loadProjectAssets({ db, projectId: row.id }),
      db
        .select({
          avatarUrl: userProfiles.avatarUrl,
          canDelete: projectCollaborators.canDelete,
          canEdit: projectCollaborators.canEdit,
          canUpload: projectCollaborators.canUpload,
          email: projectCollaborators.inviteEmail,
          id: projectCollaborators.id,
          name: userProfiles.displayName,
          role: projectCollaborators.collaboratorRole,
          status: projectCollaborators.invitationStatus,
        })
        .from(projectCollaborators)
        .leftJoin(
          userProfiles,
          eq(userProfiles.userId, projectCollaborators.collaboratorUserId)
        )
        .where(eq(projectCollaborators.projectId, row.id)),
      db
        .select({ row: tracks })
        .from(projectTracks)
        .innerJoin(tracks, eq(tracks.id, projectTracks.trackId))
        .where(eq(projectTracks.projectId, row.id))
        .orderBy(asc(projectTracks.position)),
    ]),
    trackSummaries = [];

  for (const trackRow of trackRows) {
    const trackSummary = await buildTrackSummary(trackRow.row);
    trackSummaries.push({
      ...trackSummary,
      coverArtUrl: summary.coverArtUrl ?? trackSummary.coverArtUrl,
    });
  }

  return {
    ...summary,
    assets: assetRows
      .filter(
        (asset) =>
          !row.isPublic ||
          !["attachment", "beat", "concept", "release_export"].includes(
            asset.assetKind
          )
      )
      .map(mapAssetForDashboard),
    collaborators: row.isPublic ? [] : collaboratorRows,
    tracks: trackSummaries,
  };
};

export const ownedTrackWhere = ({
  organizationId,
  trackId,
  userId,
}: {
  organizationId: string | null;
  trackId: string;
  userId: string;
}) =>
  organizationId
    ? and(eq(tracks.id, trackId), eq(tracks.organizationId, organizationId))
    : and(eq(tracks.id, trackId), eq(tracks.ownerUserId, userId));

export const ownedProjectWhere = ({
  organizationId,
  projectId,
  userId,
}: {
  organizationId: string | null;
  projectId: string;
  userId: string;
}) =>
  organizationId
    ? and(
        eq(projects.id, projectId),
        or(
          eq(projects.ownerUserId, userId),
          eq(projects.organizationId, organizationId)
        )
      )
    : and(eq(projects.id, projectId), eq(projects.ownerUserId, userId));
