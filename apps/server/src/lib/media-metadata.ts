import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { trackAssets, tracks } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const getMediaBucket = () =>
  (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ?? null;

export const readAudioDurationMs = async (blob: Blob) => {
  const {
    ALL_FORMATS,
    BlobSource,
    Input: MediaInput,
  } = await import("mediabunny");
  const input = new MediaInput({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });

  try {
    const metadataDuration = await input.getDurationFromMetadata();
    const durationSeconds =
      metadataDuration ??
      (await input.computeDuration(undefined, { skipLiveWait: true }));

    return Number.isFinite(durationSeconds)
      ? Math.max(0, Math.round(durationSeconds * 1000))
      : null;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
};

export const readR2AudioDurationMs = async (objectKey: string) => {
  const bucket = getMediaBucket();

  if (!bucket) {
    return null;
  }

  const object = await bucket.get(objectKey);

  if (!object) {
    return null;
  }

  const blob = new Blob([await object.arrayBuffer()], {
    type: object.httpMetadata?.contentType ?? "application/octet-stream",
  });

  return readAudioDurationMs(blob);
};

const genericGeneratedImagePattern =
  /^(gemini[-_]generated[-_]image|generated[-_]image|image[-_]\d+)/iu;

const fileNameFromObjectKey = (objectKey: string | null) =>
  objectKey?.split("/").pop()?.split(/[?#]/u).at(0)?.trim() ?? "";

const isGenericCoverArtFileName = (fileName: string) => {
  const stem = fileName.trim().replace(/\.[^.]+$/u, "");
  return genericGeneratedImagePattern.test(stem);
};

const toCoverArtFileName = (title: string) => {
  const stem = title
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  return `${stem || "track"}.png`;
};

const normalizeTrackCoverArtFileNames = async ({
  db,
  limit,
  trackIds,
}: {
  db: ReturnType<typeof createDb>;
  limit: number;
  trackIds?: string[];
}) => {
  const whereClauses: SQL[] = [
    eq(trackAssets.assetKind, "cover_art"),
    trackIds && trackIds.length > 0
      ? inArray(trackAssets.trackId, trackIds)
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined);

  const coverRows = await db
    .select({
      id: trackAssets.id,
      metadata: trackAssets.metadata,
      objectKey: trackAssets.objectKey,
      title: tracks.title,
    })
    .from(trackAssets)
    .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
    .where(and(...whereClauses))
    .limit(limit);

  let renamed = 0;

  for (const row of coverRows) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const originalFileName =
      typeof metadata.originalFileName === "string"
        ? metadata.originalFileName
        : fileNameFromObjectKey(row.objectKey);

    if (!isGenericCoverArtFileName(originalFileName)) {
      continue;
    }

    await db
      .update(trackAssets)
      .set({
        metadata: {
          ...metadata,
          originalFileName: toCoverArtFileName(row.title),
        },
        updatedAt: new Date(),
      })
      .where(eq(trackAssets.id, row.id));
    renamed += 1;
  }

  return { renamed, scanned: coverRows.length };
};

export const backfillMissingTrackDurations = async ({
  limit = 25,
  trackIds,
}: {
  limit?: number;
  trackIds?: string[];
} = {}) => {
  if (!isDatabaseConfigured()) {
    return { failed: 0, renamedCoverArt: 0, scanned: 0, updated: 0 };
  }

  const db = createDb();
  const normalizedLimit = Math.max(1, Math.min(limit, 100));
  const whereClauses: SQL[] = [
    eq(trackAssets.assetKind, "master"),
    eq(trackAssets.storageProvider, "r2"),
    isNotNull(trackAssets.objectKey),
    isNull(trackAssets.durationMs),
    trackIds && trackIds.length > 0
      ? inArray(trackAssets.trackId, trackIds)
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined);
  const rows = await db
    .select({
      id: trackAssets.id,
      objectKey: trackAssets.objectKey,
    })
    .from(trackAssets)
    .where(and(...whereClauses))
    .limit(normalizedLimit);

  let failed = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.objectKey) {
      failed += 1;
      continue;
    }

    const durationMs = await readR2AudioDurationMs(row.objectKey);

    if (durationMs === null) {
      failed += 1;
      continue;
    }

    await db
      .update(trackAssets)
      .set({ durationMs, updatedAt: new Date() })
      .where(eq(trackAssets.id, row.id));
    updated += 1;
  }

  const coverArtResult = await normalizeTrackCoverArtFileNames({
    db,
    limit: normalizedLimit,
    trackIds,
  });

  return {
    failed,
    renamedCoverArt: coverArtResult.renamed,
    scanned: rows.length + coverArtResult.scanned,
    updated,
  };
};
