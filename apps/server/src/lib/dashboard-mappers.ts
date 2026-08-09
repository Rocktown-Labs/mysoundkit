/* eslint-disable no-nested-ternary */
import { createDb } from "@soundkit/db";
import {
  genres,
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
import { env } from "@soundkit/env/server";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { canonicalGenreName } from "@/lib/genre-catalog";
import { regionSlugFromUser } from "@/lib/public-explore";

const formatDuration = (durationMs: number | null | undefined) => {
  if (!durationMs) {
    return "0:00";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const objectUrlFromMetadata = (metadata: unknown) => {
  if (!(metadata && typeof metadata === "object" && "url" in metadata)) {
    return null;
  }

  const { url } = metadata as { url?: unknown };
  return typeof url === "string" ? url : null;
};

const publicAssetUrl = (
  asset: InferSelectModel<typeof trackAssets> | undefined
) => {
  if (!asset) {
    return null;
  }

  const metadataUrl = objectUrlFromMetadata(asset.metadata);

  if (metadataUrl) {
    return metadataUrl;
  }

  const baseUrl = (
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .MEDIA_PUBLIC_URL ??
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .VITE_MEDIA_URL ??
    ""
  ).replace(/\/+$/u, "");

  return baseUrl && asset.objectKey ? `${baseUrl}/${asset.objectKey}` : null;
};

const publicProjectAssetUrl = (
  asset: InferSelectModel<typeof projectAssets> | undefined
) => {
  if (!asset) {
    return null;
  }

  const baseUrl = (
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .MEDIA_PUBLIC_URL ??
    (env as unknown as { MEDIA_PUBLIC_URL?: string; VITE_MEDIA_URL?: string })
      .VITE_MEDIA_URL ??
    ""
  ).replace(/\/+$/u, "");

  return baseUrl && asset.objectKey ? `${baseUrl}/${asset.objectKey}` : null;
};

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
});

const fileAvailabilityFromAssets = (
  assets: InferSelectModel<typeof trackAssets>[]
) => ({
  adlibs: assets.some((asset) => asset.assetKind === "adlib"),
  coverArt: assets.some((asset) => asset.assetKind === "cover_art"),
  instrumental: assets.some((asset) => asset.assetKind === "instrumental"),
  master: assets.some((asset) => asset.assetKind === "master"),
  reference: assets.some((asset) => asset.assetKind === "reference_audio"),
  session: assets.some((asset) => asset.assetKind === "session_file"),
  vocals: assets.filter(
    (asset) =>
      asset.assetKind === "vocal_stem" || asset.assetKind === "verse_vocal"
  ).length,
});

export const mapTrackSummary = ({
  artistName,
  artistUsername,
  assets,
  collaboratorCount,
  genre,
  regionSlug = null,
  row,
}: {
  artistName: string;
  artistUsername: string | null;
  assets: InferSelectModel<typeof trackAssets>[];
  collaboratorCount: number;
  genre: string | null;
  regionSlug?: string | null;
  row: InferSelectModel<typeof tracks>;
}) => {
  const coverAsset = assets.find((asset) => asset.assetKind === "cover_art");
  const primaryAudioAsset =
    assets.find((asset) => asset.assetKind === "master") ??
    assets.find((asset) => asset.durationMs);
  const assetStatus = assets.some((asset) => asset.status === "processing")
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
    downloadUrl: primaryAudioAsset
      ? `/v1/tracks/${row.id}/assets/${primaryAudioAsset.id}/download`
      : null,
    downloadsAllowed: row.downloadsAllowed,
    downloadsRequireFirstPlay: row.downloadsRequireFirstPlay,
    downloadsRequirePurchase: row.downloadsRequirePurchase,
    duration: formatDuration(primaryAudioAsset?.durationMs),
    fileAvailability: fileAvailabilityFromAssets(assets),
    genre: genre ? canonicalGenreName(genre) : "Uncategorized",
    id: row.id,
    isForSale: row.isForSale,
    isPublic: row.isPublic,
    isrc: row.isrc,
    lyricsStatus: row.lyricsStatus,
    musicalKey: row.musicalKey,
    organizationId: row.organizationId,
    playbackUrl: publicAssetUrl(primaryAudioAsset),
    plays: 0,
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
  row: InferSelectModel<typeof tracks>
) => {
  const db = createDb();
  const [profile] = await db
    .select({
      displayName: userProfiles.displayName,
      state: userProfiles.state,
      userName: authUser.name,
      username: userProfiles.username,
    })
    .from(authUser)
    .leftJoin(userProfiles, eq(userProfiles.userId, authUser.id))
    .where(eq(authUser.id, row.ownerUserId))
    .limit(1);
  const [genreRow] = row.genreId
    ? await db
        .select({ name: genres.name })
        .from(genres)
        .where(eq(genres.id, row.genreId))
        .limit(1)
    : [];

  const [assetRows, collaboratorRows] = await Promise.all([
    db.select().from(trackAssets).where(eq(trackAssets.trackId, row.id)),
    db
      .select({ id: trackCollaborators.id })
      .from(trackCollaborators)
      .where(eq(trackCollaborators.trackId, row.id)),
  ]);

  return mapTrackSummary({
    artistName: profile?.displayName ?? profile?.userName ?? "SoundKit Artist",
    artistUsername: profile?.username ?? null,
    assets: assetRows,
    collaboratorCount: collaboratorRows.length,
    genre: genreRow?.name ? canonicalGenreName(genreRow.name) : null,
    regionSlug: regionSlugFromUser(profile?.state) ?? null,
    row,
  });
};

export const buildTrackDetail = async (
  row: InferSelectModel<typeof tracks>
) => {
  const db = createDb();
  const [summary, assetRows, collaboratorRows, lyricsRows] = await Promise.all([
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
        status: trackCollaborators.invitationStatus,
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
  const db = createDb();
  const [trackRows, assetRows, collaboratorRows] = await Promise.all([
    db
      .select({ id: projectTracks.trackId })
      .from(projectTracks)
      .where(eq(projectTracks.projectId, row.id)),
    db.select().from(projectAssets).where(eq(projectAssets.projectId, row.id)),
    db
      .select({ id: projectCollaborators.id })
      .from(projectCollaborators)
      .where(eq(projectCollaborators.projectId, row.id)),
  ]);
  const trackIds = trackRows.map((track) => track.id);
  const durationAssetRows =
    trackIds.length > 0
      ? await db
          .select({
            assetKind: trackAssets.assetKind,
            durationMs: trackAssets.durationMs,
            trackId: trackAssets.trackId,
          })
          .from(trackAssets)
          .where(inArray(trackAssets.trackId, trackIds))
      : [];
  const durationByTrackId = new Map<string, number>();

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
    collaboratorCount: collaboratorRows.length,
    coverArtUrl: publicProjectAssetUrl(coverAsset),
    description: row.description,
    duration: durationMs > 0 ? formatDuration(durationMs) : "0:00",
    durationMs,
    id: row.id,
    isPublic: row.isPublic,
    progress,
    projectType: row.projectType,
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
  const db = createDb();
  const [summary, assetRows, collaboratorRows, trackRows] = await Promise.all([
    buildProjectSummary(row),
    db.select().from(projectAssets).where(eq(projectAssets.projectId, row.id)),
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
  ]);

  const trackSummaries = [];

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
