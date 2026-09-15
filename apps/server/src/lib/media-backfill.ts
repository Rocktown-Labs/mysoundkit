/* eslint-disable one-var, sort-vars */
/* oxlint-disable typescript/no-non-null-assertion, unicorn/max-nested-calls, unicorn/no-nested-ternary */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  mediaProcessingJobs,
  openVerseListings,
  trackAssets,
  trackLyrics,
  trackStemJobs,
  tracks,
} from "@soundkit/db/schema/app";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { logInfo } from "@/middleware/structured-logging";

import {
  ENRICHMENT_PIPELINE_VERSION,
  MEDIA_PIPELINE_VERSION,
} from "./media-pipeline";
import type {
  MediaProcessingWorkflowPayload,
  TrackEnrichmentWorkflowPayload,
} from "./media-pipeline";
import {
  ensureMediaProcessingWorkflowBatch,
  ensureTrackEnrichmentWorkflowBatch,
  restartStuckEnrichmentInstances,
} from "./media-processing-jobs";

const MAX_BACKFILL_BATCH_SIZE = 100,
  boundedBatchSize = (value: number) =>
    Math.min(Math.max(Math.trunc(value), 1), MAX_BACKFILL_BATCH_SIZE);

/**
 * Source asset ids whose enrichment outputs actually exist: current v2 stems
 * for the exact source plus machine lyrics cut from its vocal stem. Shared
 * by the quiet backfill and the admin sync endpoint so both agree on what
 * "missing" means (legacy job rows are ignored).
 */
export const findEnrichedSourceIds = async ({
  sourceAssetIds,
  trackIds,
}: {
  sourceAssetIds: string[];
  trackIds: string[];
}): Promise<Set<string>> => {
  if (sourceAssetIds.length === 0 || trackIds.length === 0) {
    return new Set();
  }
  const db = createDb(),
    [stemRows, lyricRows] = await Promise.all([
      db
        .select({
          assetKind: trackAssets.assetKind,
          id: trackAssets.id,
          sourceAssetId: trackAssets.sourceAssetId,
        })
        .from(trackAssets)
        .where(
          and(
            inArray(trackAssets.sourceAssetId, sourceAssetIds),
            eq(trackAssets.purpose, "stem"),
            eq(trackAssets.isCurrent, true),
            eq(trackAssets.processingVersion, ENRICHMENT_PIPELINE_VERSION),
            inArray(trackAssets.assetKind, ["vocal_stem", "instrumental"])
          )
        ),
      db
        .select({ sourceAssetId: trackLyrics.sourceAssetId })
        .from(trackLyrics)
        .where(
          and(
            inArray(trackLyrics.trackId, trackIds),
            eq(trackLyrics.sourceType, "machine_transcription")
          )
        ),
    ]),
    vocalBySource = new Map(
      stemRows
        .filter((row) => row.assetKind === "vocal_stem" && row.sourceAssetId)
        .map((row) => [row.sourceAssetId as string, row.id])
    ),
    instrumentalSources = new Set(
      stemRows
        .filter((row) => row.assetKind === "instrumental" && row.sourceAssetId)
        .map((row) => row.sourceAssetId)
    ),
    lyricVocalIds = new Set(
      lyricRows.map((row) => row.sourceAssetId).filter(Boolean)
    );
  return new Set(
    [...vocalBySource.entries()]
      .filter(
        ([sourceId, vocalId]) =>
          instrumentalSources.has(sourceId) && lyricVocalIds.has(vocalId)
      )
      .map(([sourceId]) => sourceId)
  );
};

export const enqueueLegacyMediaBackfill = async ({
  batchSize = 50,
  bucket,
  workflow,
}: {
  batchSize?: number;
  bucket?: R2Bucket | null;
  workflow: null | Workflow<MediaProcessingWorkflowPayload> | undefined;
}) => {
  if (!isDatabaseConfigured()) {
    return { created: 0, requested: 0, scanned: 0 };
  }
  const db = createDb(),
    limit = boundedBatchSize(batchSize),
    masters = await db
      .select({
        objectKey: trackAssets.objectKey,
        processingVersion: trackAssets.processingVersion,
        sourceAssetId: trackAssets.id,
        trackId: trackAssets.trackId,
      })
      .from(trackAssets)
      .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
      .where(
        and(
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true),
          isNotNull(trackAssets.objectKey),
          inArray(trackAssets.status, ["uploaded", "ready"]),
          // Soft-deleted tracks must not consume backfill batches.
          isNull(tracks.deletedAt)
        )
      )
      .limit(limit * 3),
    sourceAssetIds = masters.map((master) => master.sourceAssetId),
    [streamingRows, jobRows] = sourceAssetIds.length
      ? await Promise.all([
          db
            .select({ sourceAssetId: trackAssets.sourceAssetId })
            .from(trackAssets)
            .where(
              and(
                inArray(trackAssets.sourceAssetId, sourceAssetIds),
                eq(trackAssets.purpose, "streaming"),
                eq(trackAssets.processingVersion, MEDIA_PIPELINE_VERSION),
                eq(trackAssets.status, "ready"),
                eq(trackAssets.isCurrent, true)
              )
            ),
          db
            .select({ sourceAssetId: mediaProcessingJobs.sourceAssetId })
            .from(mediaProcessingJobs)
            .where(
              and(
                inArray(mediaProcessingJobs.sourceAssetId, sourceAssetIds),
                eq(mediaProcessingJobs.workflowType, "media_processing"),
                eq(mediaProcessingJobs.pipelineVersion, MEDIA_PIPELINE_VERSION),
                // Failed jobs are excluded on purpose: relaunching
                // deterministic failures (e.g. MASTER_OBJECT_MISSING) from the
                // cron loop runs them forever. Deliberate retries go through
                // POST /tracks/{id}/processing/retry.
                inArray(mediaProcessingJobs.status, [
                  "queued",
                  "running",
                  "failed",
                ])
              )
            ),
        ])
      : [[], []],
    readySources = new Set(
      streamingRows.map((row) => row.sourceAssetId).filter(Boolean)
    ),
    activeSources = new Set(
      jobRows.map((row) => row.sourceAssetId).filter(Boolean)
    ),
    payloads = masters
      .filter(
        (master) =>
          !readySources.has(master.sourceAssetId) &&
          !activeSources.has(master.sourceAssetId)
      )
      .slice(0, limit)
      .map((master): MediaProcessingWorkflowPayload => ({
        mode: "legacy_backfill",
        objectKey: master.objectKey!,
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        sourceAssetId: master.sourceAssetId,
        trackId: master.trackId,
      }));
  if (payloads.length === 0) {
    return { created: 0, requested: 0, scanned: masters.length };
  }
  // Pre-flight: never launch workflows for objects that no longer exist in R2
  // (e.g. masters lost with destroyed preview buckets) — those failures are
  // permanent and would otherwise relaunch every sweep.
  const launchablePayloads: MediaProcessingWorkflowPayload[] = [];
  for (const payload of payloads) {
    if (!bucket) {
      launchablePayloads.push(payload);
      continue;
    }
    const head = await bucket.head(payload.objectKey);
    if (head && head.size > 0) {
      launchablePayloads.push(payload);
    } else {
      logInfo({
        event: "media_backfill_skipped_missing_object",
        objectKey: payload.objectKey,
        sourceAssetId: payload.sourceAssetId,
        trackId: payload.trackId,
      });
    }
  }
  if (launchablePayloads.length === 0) {
    return { created: 0, requested: 0, scanned: masters.length };
  }
  const result = await ensureMediaProcessingWorkflowBatch({
    payloads: launchablePayloads,
    workflow,
  });
  logInfo({
    created: result.created,
    event: "media_backfill_batch_started",
    requested: result.requested,
    scanned: masters.length,
  });
  return { ...result, scanned: masters.length };
};

export const enqueueLyricsEnrichmentBackfill = async ({
  batchSize = 25,
  ownerUserId,
  workflow,
}: {
  batchSize?: number;
  ownerUserId?: string;
  workflow: null | Workflow<TrackEnrichmentWorkflowPayload> | undefined;
}): Promise<{
  created: number;
  requested: number;
  restarted: number;
  scanned: number;
}> => {
  if (!isDatabaseConfigured()) {
    return { created: 0, requested: 0, restarted: 0, scanned: 0 };
  }

  const db = createDb(),
    limit = boundedBatchSize(batchSize),
    masters = await db
      .select({
        objectKey: trackAssets.objectKey,
        sourceAssetId: trackAssets.id,
        trackId: trackAssets.trackId,
      })
      .from(trackAssets)
      .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
      .where(
        and(
          ownerUserId ? eq(tracks.ownerUserId, ownerUserId) : undefined,
          eq(trackAssets.assetKind, "master"),
          eq(trackAssets.isCurrent, true),
          isNotNull(trackAssets.objectKey),
          inArray(trackAssets.status, ["uploaded", "ready"]),
          isNull(tracks.deletedAt)
        )
      )
      .limit(limit * 3),
    trackIds = masters.map((master) => master.trackId),
    sourceAssetIds = masters.map((master) => master.sourceAssetId),
    [unfinishedRows, enrichedSourceIds, activeRows] = masters.length
      ? await Promise.all([
          db
            .select({ trackId: openVerseListings.trackId })
            .from(openVerseListings)
            .where(
              and(
                inArray(openVerseListings.trackId, trackIds),
                inArray(openVerseListings.status, [
                  "open",
                  "closed",
                  "awaiting_final_master",
                ])
              )
            ),
          // Eligibility comes from real outputs, not the legacy job table.
          findEnrichedSourceIds({ sourceAssetIds, trackIds }),
          db
            .select({ sourceAssetId: mediaProcessingJobs.sourceAssetId })
            .from(mediaProcessingJobs)
            .where(
              and(
                inArray(mediaProcessingJobs.sourceAssetId, sourceAssetIds),
                eq(mediaProcessingJobs.workflowType, "track_enrichment"),
                // Queued/running runs still block; failed runs are eligible
                // again (in-house retries are cheap and reuse stems).
                inArray(mediaProcessingJobs.status, ["queued", "running"])
              )
            ),
        ])
      : [[], new Set<string>(), []],
    unfinishedTrackIds = new Set(unfinishedRows.map((row) => row.trackId)),
    activeSourceIds = new Set(
      activeRows.map((row) => row.sourceAssetId).filter(Boolean)
    ),
    eligible = masters
      .filter(
        (master) =>
          !unfinishedTrackIds.has(master.trackId) &&
          !enrichedSourceIds.has(master.sourceAssetId) &&
          !activeSourceIds.has(master.sourceAssetId)
      )
      .slice(0, limit);

  for (const master of eligible) {
    await db
      .insert(trackStemJobs)
      .values({
        id: `stem:${master.sourceAssetId}:v${ENRICHMENT_PIPELINE_VERSION}`,
        inputAssetId: master.sourceAssetId,
        outputFormat: "MP3",
        outputType: "BOTH",
        status: "queued",
        trackId: master.trackId,
      })
      // inputAssetId is unique: legacy v1 rows are refreshed in place so the
      // v2 pipeline version is tracked on assets, not the job id.
      .onConflictDoUpdate({
        set: {
          outputFormat: "MP3",
          outputType: "BOTH",
          status: "queued",
          updatedAt: new Date(),
        },
        target: [trackStemJobs.inputAssetId],
      });
  }
  const payloads = eligible.map((master): TrackEnrichmentWorkflowPayload => ({
    objectKey: master.objectKey!,
    pipelineVersion: ENRICHMENT_PIPELINE_VERSION,
    // Backfill stays silent: no lyric-ready notifications at 1am.
    quiet: true,
    sourceAssetId: master.sourceAssetId,
    trackId: master.trackId,
  }));
  if (payloads.length === 0) {
    return { created: 0, requested: 0, restarted: 0, scanned: masters.length };
  }
  const result = await ensureTrackEnrichmentWorkflowBatch({
      payloads,
      workflow,
    }),
    // createBatch skips existing ids: restart errored/terminated runs and
    // completed runs whose outputs are still missing (eligible by
    // construction above).
    restarted = await restartStuckEnrichmentInstances({
      includeComplete: true,
      payloads,
      workflow,
    });
  logInfo({
    created: result.created,
    event: "lyrics_enrichment_backfill_started",
    ownerUserId: ownerUserId ?? "all",
    requested: result.requested,
    restarted: restarted.length,
    scanned: masters.length,
  });
  return { ...result, restarted: restarted.length, scanned: masters.length };
};

/** @deprecated Renamed to enqueueLyricsEnrichmentBackfill (#257). */
export const enqueuePremiumEnrichmentBackfill = enqueueLyricsEnrichmentBackfill;
