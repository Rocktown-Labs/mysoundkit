/* eslint-disable no-nested-ternary */
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
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  formatDuration,
  guardedTrackPlaybackUrl,
  objectUrlFromMetadata,
  publicAssetUrl,
  publicProjectAssetUrl,
} from "@/lib/asset-urls";
import { canonicalGenreName } from "@/lib/genre-catalog";
import { regionSlugFromUser } from "@/lib/public-explore";
import { resolveTrackAssetFromRows } from "@/lib/track-asset-resolver";

const mapAssetForDashboard = (
    asset:
      | InferSelectModel<typeof trackAssets>
      | InferSelectModel<typeof projectAssets>
  ) => ({
    assetKind: asset.assetKind,
    bucketName: asset.bucketName,
    downloadUrl:
      "trackId" in asset && asset.trackId
        ? `/v1/tracks/${asset.trackId}/assets/${asset.id}/download`
        : null,
    durationMs: "durationMs" in asset ? asset.durationMs : null,
    id: asset.id,
    metadata: "metadata" in asset ? asset.metadata : null,
    mimeType: asset.mimeType,
    objectKey: asset.objectKey,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    storageProvider: asset.storageProvider,
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
        asset.assetKind === "cover_art" || asset.assetKind === "artwork"
    ).length,
    booklets: assets.filter((asset) => asset.assetKind === "booklet").length,
    cleanVersions: assets.filter((asset) => asset.assetKind === "clean").length,
    coverArt: assets.some(
      (asset) =>
        asset.assetKind === "cover_art" || asset.assetKind === "artwork"
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
  const coverAsset = assets.find((asset) => asset.assetKind === "cover_art"),
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
    assetStatus = assets.some((asset) => asset.status === "processing")
      ? "processing"
      : (primaryAudioAsset?.status ?? null);

  return {
    artistName,
    artistUsername,
    assetStatus,
    bpm: row.bpm,
    catalogItemType: row.catalogItemType,
    collaboratorCount,
    coverArtUrl: objectUrlFromMetadata(coverAsset?.metadata) ?? null,
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
      assets,
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
    [assetRows, collaboratorRows, playCountRow] = await Promise.all([
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
    ]),
    actualPlays =
      playCountOverride === undefined
        ? (playCountRow[0]?.count ?? 0)
        : playCountOverride;

  return mapTrackSummary({
    artistName: profile?.displayName ?? profile?.userName ?? "SoundKit Artist",
    artistUsername: profile?.username ?? null,
    assets: assetRows,
    collaboratorCount: collaboratorRows.length,
    genre: genreRow?.name ? canonicalGenreName(genreRow.name) : null,
    plays: actualPlays,
    regionSlug: regionSlugFromUser(profile?.state) ?? null,
    row,
  });
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
    ]);

  return {
    ...summary,
    assets: assetRows.map(mapAssetForDashboard),
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
  };
};

export const buildProjectSummary = async (
  row: InferSelectModel<typeof projects>
) => {
  const db = createDb(),
    [trackRows, assetRows, collaboratorRows, profileRows] = await Promise.all([
      db
        .select({
          genreName: genres.name,
          id: projectTracks.trackId,
        })
        .from(projectTracks)
        .leftJoin(tracks, eq(tracks.id, projectTracks.trackId))
        .leftJoin(genres, eq(genres.id, tracks.genreId))
        .where(eq(projectTracks.projectId, row.id)),
      db
        .select()
        .from(projectAssets)
        .where(eq(projectAssets.projectId, row.id)),
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
    ]),
    trackIds = trackRows.map((track) => track.id),
    primaryGenre = trackRows.find((track) => track.genreName)?.genreName,
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
      db
        .select()
        .from(projectAssets)
        .where(eq(projectAssets.projectId, row.id)),
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
    trackSummaries.push(await buildTrackSummary(trackRow.row));
  }

  return {
    ...summary,
    assets: assetRows.map(mapAssetForDashboard),
    collaborators: collaboratorRows,
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
        eq(projects.organizationId, organizationId)
      )
    : and(eq(projects.id, projectId), eq(projects.ownerUserId, userId));
