/* eslint-disable one-var, sort-vars */
import { createDb } from "@soundkit/db";
import {
  genres,
  projectAssets,
  projectTracks,
  projects,
  trackAssets,
  trackLyrics,
  tracks,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { logInfo } from "@/middleware/structured-logging";

import type { GeneratedMedia } from "./media-processor";
import { resolveTrackAssetFromRows } from "./track-asset-resolver";

export interface ProjectExportTrackSnapshot {
  metadata: Record<string, string>;
  position: number;
  sourceAssetId: string;
  sourceObjectKey: string;
  targetObjectKey: string;
  title: string;
  trackId: string;
}

export interface ProjectExportSnapshot {
  exportVersion: number;
  ownerUserId: string;
  projectId: string;
  projectTitle: string;
  tracks: ProjectExportTrackSnapshot[];
}

const safeFileName = (value: string) =>
    value
      .normalize("NFKD")
      .replaceAll(/[^a-zA-Z0-9 _-]/gu, "")
      .trim()
      .replaceAll(/\s+/gu, " ")
      .slice(0, 100) || "SoundKit Track",
  metadataValue = (value: null | string | undefined) => value ?? undefined;

export const createProjectExportSnapshot = async ({
  exportVersion,
  projectId,
}: {
  exportVersion: number;
  projectId: string;
}): Promise<ProjectExportSnapshot> => {
  const db = createDb(),
    [project] = await db
      .select({
        albumArtist: userProfiles.displayName,
        exportVersion: projects.exportVersion,
        genre: genres.name,
        ownerUserId: projects.ownerUserId,
        releaseDate: projects.releaseDate,
        title: projects.title,
      })
      .from(projects)
      .leftJoin(userProfiles, eq(userProfiles.userId, projects.ownerUserId))
      .leftJoin(genres, eq(genres.id, projects.genreId))
      .where(eq(projects.id, projectId))
      .limit(1);
  if (!project || project.exportVersion !== exportVersion) {
    throw new Error("Project export version is stale.");
  }

  const trackRows = await db
    .select({
      artistName: userProfiles.displayName,
      isrc: tracks.isrc,
      position: projectTracks.position,
      title: tracks.title,
      trackId: tracks.id,
    })
    .from(projectTracks)
    .innerJoin(tracks, eq(tracks.id, projectTracks.trackId))
    .leftJoin(userProfiles, eq(userProfiles.userId, tracks.ownerUserId))
    .where(eq(projectTracks.projectId, projectId))
    .orderBy(asc(projectTracks.position));
  if (trackRows.length === 0) {
    throw new Error("Project has no tracks to export.");
  }

  const trackIds = trackRows.map((row) => row.trackId),
    [assetRows, lyricRows] = await Promise.all([
      db
        .select()
        .from(trackAssets)
        .where(inArray(trackAssets.trackId, trackIds)),
      db
        .select({ text: trackLyrics.text, trackId: trackLyrics.trackId })
        .from(trackLyrics)
        .where(
          and(
            inArray(trackLyrics.trackId, trackIds),
            eq(trackLyrics.status, "approved")
          )
        )
        .orderBy(desc(trackLyrics.updatedAt)),
    ]),
    approvedLyrics = new Map<string, string>();
  for (const lyrics of lyricRows) {
    if (!approvedLyrics.has(lyrics.trackId)) {
      approvedLyrics.set(lyrics.trackId, lyrics.text);
    }
  }

  const total = trackRows.length,
    exportTracks: ProjectExportTrackSnapshot[] = [];
  for (const [index, row] of trackRows.entries()) {
    const sourceAsset = resolveTrackAssetFromRows({
      assets: assetRows.filter((asset) => asset.trackId === row.trackId),
      purpose: "consumer_download",
      trackId: row.trackId,
    });
    if (!sourceAsset?.objectKey) {
      throw new Error(
        `Download-quality media is not ready for project track ${row.trackId}.`
      );
    }
    const position = index + 1,
      positionLabel = String(position).padStart(2, "0"),
      targetObjectKey = `projects/${projectId}/exports/v${exportVersion}/${positionLabel}-${safeFileName(row.title)}.m4a`,
      metadata = Object.fromEntries(
        Object.entries({
          album: project.title,
          album_artist: project.albumArtist ?? "SoundKit Artist",
          artist: row.artistName ?? project.albumArtist ?? "SoundKit Artist",
          date: metadataValue(project.releaseDate?.toISOString().slice(0, 10)),
          genre: metadataValue(project.genre),
          isrc: metadataValue(row.isrc),
          lyrics: metadataValue(approvedLyrics.get(row.trackId)),
          title: row.title,
          track: `${position}/${total}`,
        }).filter((entry): entry is [string, string] => Boolean(entry[1]))
      );
    exportTracks.push({
      metadata,
      position,
      sourceAssetId: sourceAsset.id,
      sourceObjectKey: sourceAsset.objectKey,
      targetObjectKey,
      title: row.title,
      trackId: row.trackId,
    });
  }

  return {
    exportVersion,
    ownerUserId: project.ownerUserId,
    projectId,
    projectTitle: project.title,
    tracks: exportTracks,
  };
};

export const findReusableProjectExport = async ({
  bucket,
  exportVersion,
  projectId,
  sourceAssetId,
}: {
  bucket: R2Bucket;
  exportVersion: number;
  projectId: string;
  sourceAssetId: string;
}) => {
  const [asset] = await createDb()
    .select()
    .from(projectAssets)
    .where(
      and(
        eq(projectAssets.projectId, projectId),
        eq(projectAssets.sourceAssetId, sourceAssetId),
        eq(projectAssets.exportVersion, exportVersion),
        eq(projectAssets.assetKind, "release_export"),
        eq(projectAssets.status, "ready")
      )
    )
    .limit(1);
  if (!asset?.objectKey) {
    return null;
  }
  return (await bucket.head(asset.objectKey)) ? asset : null;
};

export const markProjectExportProcessing = async ({
  exportVersion,
  projectId,
  sourceAssetId,
  targetObjectKey,
  uploaderUserId,
}: {
  exportVersion: number;
  projectId: string;
  sourceAssetId: string;
  targetObjectKey: string;
  uploaderUserId: string;
}): Promise<void> => {
  await createDb()
    .insert(projectAssets)
    .values({
      assetKind: "release_export",
      exportVersion,
      id: `project-export:${projectId}:${sourceAssetId}:v${exportVersion}`,
      metadata: { exportVersion, generatedBy: "soundkit", sourceAssetId },
      mimeType: "audio/mp4",
      objectKey: targetObjectKey,
      projectId,
      sizeBytes: null,
      sourceAssetId,
      status: "processing",
      storageProvider: "r2",
      uploaderUserId,
    })
    .onConflictDoUpdate({
      set: {
        objectKey: targetObjectKey,
        status: "processing",
        updatedAt: new Date(),
      },
      target: [
        projectAssets.projectId,
        projectAssets.sourceAssetId,
        projectAssets.exportVersion,
        projectAssets.assetKind,
      ],
    });
};

export const registerProjectExport = async ({
  bucket,
  exportVersion,
  generated,
  projectId,
  sourceAssetId,
}: {
  bucket: R2Bucket;
  exportVersion: number;
  generated: GeneratedMedia;
  projectId: string;
  sourceAssetId: string;
}): Promise<void> => {
  const object = await bucket.head(generated.objectKey);
  if (!(object && object.size === generated.sizeBytes)) {
    throw new Error("Project export failed R2 verification.");
  }
  await createDb()
    .update(projectAssets)
    .set({
      metadata: {
        exportVersion,
        generatedBy: "soundkit",
        sha256: generated.sha256,
        sourceAssetId,
      },
      mimeType: generated.contentType,
      objectKey: generated.objectKey,
      sizeBytes: generated.sizeBytes,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectAssets.projectId, projectId),
        eq(projectAssets.sourceAssetId, sourceAssetId),
        eq(projectAssets.exportVersion, exportVersion),
        eq(projectAssets.assetKind, "release_export")
      )
    );
  logInfo({
    bytes: generated.sizeBytes,
    event: "project_export_track_completed",
    exportVersion,
    projectId,
    sourceAssetId,
  });
};
