import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { trackAssets, tracks, workflowJobs } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { logWarn } from "@/middleware/structured-logging";

export interface DurationBackfillQueueMessage {
  assetId: string;
  jobId: string;
  objectKey: string;
  runId: string;
  trackId: string;
}

const DURATION_BACKFILL_JOB_TYPE = "track_duration_backfill",

 getMediaBucket = () =>
  (env as unknown as { MEDIA_BUCKET?: R2Bucket }).MEDIA_BUCKET ?? null,

 getRetryDelaySeconds = (attempts: number) =>
  Math.min(15 * 2 ** Math.max(0, attempts - 1), 60 * 60),

 getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const readAudioDurationMs = async (blob: Blob) => {
  const {
    ALL_FORMATS,
    BlobSource,
    Input: MediaInput,
  } = await import("mediabunny"),
   input = new MediaInput({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });

  try {
    const metadataDuration = await input.getDurationFromMetadata(),
     durationSeconds =
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
  /^(gemini[-_]generated[-_]image|generated[-_]image|image[-_]\d+)/iu,

 fileNameFromObjectKey = (objectKey: string | null) =>
  objectKey?.split("/").pop()?.split(/[?#]/u).at(0)?.trim() ?? "",

 isGenericCoverArtFileName = (fileName: string) => {
  const stem = fileName.trim().replace(/\.[^.]+$/u, "");
  return genericGeneratedImagePattern.test(stem);
},

 toCoverArtFileName = (title: string) => {
  const stem = title
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  return `${stem || "track"}.png`;
},

 normalizeTrackCoverArtFileNames = async ({
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
  ].filter((clause): clause is SQL => clause !== undefined),

   coverRows = await db
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
        : {},
     originalFileName =
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

  const db = createDb(),
   normalizedLimit = Math.max(1, Math.min(limit, 100)),
   whereClauses: SQL[] = [
    eq(trackAssets.assetKind, "master"),
    eq(trackAssets.storageProvider, "r2"),
    isNotNull(trackAssets.objectKey),
    isNull(trackAssets.durationMs),
    trackIds && trackIds.length > 0
      ? inArray(trackAssets.trackId, trackIds)
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined),
   rows = await db
    .select({
      id: trackAssets.id,
      objectKey: trackAssets.objectKey,
    })
    .from(trackAssets)
    .where(and(...whereClauses))
    .limit(normalizedLimit);

  let failed = 0,
   updated = 0;

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

const findUnbackfilledMasterRows = async ({
  db,
  limit,
  trackIds,
}: {
  db: ReturnType<typeof createDb>;
  limit: number;
  trackIds?: string[];
}) => {
  const whereClauses: SQL[] = [
    eq(trackAssets.assetKind, "master"),
    eq(trackAssets.storageProvider, "r2"),
    isNotNull(trackAssets.objectKey),
    isNull(trackAssets.durationMs),
    isNull(workflowJobs.id),
    trackIds && trackIds.length > 0
      ? inArray(trackAssets.trackId, trackIds)
      : undefined,
  ].filter((clause): clause is SQL => clause !== undefined);

  return db
    .select({
      assetId: trackAssets.id,
      objectKey: trackAssets.objectKey!,
      trackId: trackAssets.trackId,
    })
    .from(trackAssets)
    .leftJoin(
      workflowJobs,
      and(
        eq(workflowJobs.targetId, trackAssets.id),
        eq(workflowJobs.jobType, DURATION_BACKFILL_JOB_TYPE)
      )
    )
    .where(and(...whereClauses))
    .limit(Math.max(1, Math.min(limit, 500)));
};

export const enqueueTrackDurationBackfills = async ({
  limit = 100,
  queue,
  trackIds,
}: {
  limit?: number;
  queue?: Queue<DurationBackfillQueueMessage> | null;
  trackIds?: string[];
} = {}) => {
  const runId = crypto.randomUUID();

  if (!(isDatabaseConfigured() && queue)) {
    return { enqueued: 0, runId, scanned: 0 };
  }

  const db = createDb(),
   rows = await findUnbackfilledMasterRows({ db, limit, trackIds });

  let enqueued = 0;

  for (const row of rows) {
    if (!row.objectKey) {
      continue;
    }

    const [existingJob] = await db
      .select()
      .from(workflowJobs)
      .where(
        and(
          eq(workflowJobs.targetId, row.assetId),
          eq(workflowJobs.jobType, DURATION_BACKFILL_JOB_TYPE)
        )
      )
      .limit(1);

    if (existingJob) {
      continue;
    }

    const jobId = crypto.randomUUID();

    await db.insert(workflowJobs).values({
      id: jobId,
      input: { ...row, runId },
      jobType: DURATION_BACKFILL_JOB_TYPE,
      targetId: row.assetId,
      targetType: "track_asset",
    });

    try {
      await queue.send(
        {
          assetId: row.assetId,
          jobId,
          objectKey: row.objectKey,
          runId,
          trackId: row.trackId,
        },
        { contentType: "json" }
      );
      enqueued += 1;
    } catch (error) {
      await db.delete(workflowJobs).where(eq(workflowJobs.id, jobId));
      logWarn({
        assetId: row.assetId,
        error: getErrorMessage(error),
        event: "track_duration_backfill_enqueue_failed",
        trackId: row.trackId,
      });
      continue;
    }
  }

  return { enqueued, runId, scanned: rows.length };
};

const processDurationBackfill = async ({
  assetId,
  jobId,
  objectKey,
  trackId,
}: DurationBackfillQueueMessage) => {
  if (!isDatabaseConfigured()) {
    return { processed: false, retryable: true };
  }

  const db = createDb(),
   [job] = await db
    .select()
    .from(workflowJobs)
    .where(
      and(
        eq(workflowJobs.id, jobId),
        eq(workflowJobs.targetId, assetId),
        eq(workflowJobs.jobType, DURATION_BACKFILL_JOB_TYPE)
      )
    )
    .limit(1);

  if (!job || job.status === "completed" || job.status === "canceled") {
    return { processed: true, retryable: false };
  }

  await db
    .update(workflowJobs)
    .set({
      error: null,
      scheduledAt: null,
      startedAt: new Date(),
      status: "running",
    })
    .where(eq(workflowJobs.id, job.id));

  try {
    const durationMs = await readR2AudioDurationMs(objectKey);

    if (durationMs === null) {
      await db
        .update(workflowJobs)
        .set({
          error: {
            message: "duration_unreadable",
            retryable: true,
          },
          scheduledAt: new Date(
            Date.now() +
              getRetryDelaySeconds(
                (job.input as { attempts?: number } | null)?.attempts ?? 0
              ) *
                1000
          ),
          status: "failed",
        })
        .where(eq(workflowJobs.id, job.id));

      return { processed: false, retryable: true };
    }

    await db
      .update(trackAssets)
      .set({ durationMs, updatedAt: new Date() })
      .where(eq(trackAssets.id, assetId));
    await db
      .update(workflowJobs)
      .set({
        finishedAt: new Date(),
        output: { durationMs },
        status: "completed",
      })
      .where(eq(workflowJobs.id, job.id));

    return { processed: true, retryable: false };
  } catch (error) {
    const message = getErrorMessage(error);
    await db
      .update(workflowJobs)
      .set({
        error: {
          message,
          retryable: true,
        },
        scheduledAt: new Date(
          Date.now() +
            getRetryDelaySeconds(
              (job.input as { attempts?: number } | null)?.attempts ?? 0
            ) *
              1000
        ),
        status: "failed",
      })
      .where(eq(workflowJobs.id, job.id));

    logWarn({
      assetId,
      error: message,
      event: "track_duration_backfill_failed",
      trackId,
    });

    return { processed: false, retryable: true };
  }
};

export const handleTrackDurationBackfillQueue = async (
  batch: MessageBatch<DurationBackfillQueueMessage>
) => {
  for (const message of batch.messages) {
    const result = await processDurationBackfill(message.body);

    if (result.processed || !result.retryable) {
      message.ack();
      continue;
    }

    message.retry({
      delaySeconds: getRetryDelaySeconds(message.attempts + 1),
    });
  }
};

export const loadTrackDurationBackfillStatus = async (runId: string) => {
  if (!isDatabaseConfigured()) {
    return { done: 0, failed: 0, items: [], processing: 0, queued: 0, runId };
  }

  const db = createDb(),
   rows = await db
    .select({
      durationMs: trackAssets.durationMs,
      error: workflowJobs.error,
      input: workflowJobs.input,
      status: workflowJobs.status,
      title: tracks.title,
      trackId: tracks.id,
    })
    .from(workflowJobs)
    .innerJoin(trackAssets, eq(trackAssets.id, workflowJobs.targetId))
    .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
    .where(eq(workflowJobs.jobType, DURATION_BACKFILL_JOB_TYPE)),

   runRows = rows.filter((row) => {
    const { input } = row;
    return (
      input !== null &&
      typeof input === "object" &&
      "runId" in input &&
      input.runId === runId
    );
  }),
   summary = { done: 0, failed: 0, processing: 0, queued: 0 };

  for (const row of runRows) {
    if (row.status === "completed") {
      summary.done += 1;
    } else if (row.status === "failed") {
      summary.failed += 1;
    } else if (row.status === "running" || row.status === "waiting") {
      summary.processing += 1;
    } else {
      summary.queued += 1;
    }
  }

  return {
    ...summary,
    items: runRows.map((row) => ({
      durationMs: row.durationMs,
      error:
        row.error && typeof row.error === "object" && "message" in row.error
          ? String(row.error.message)
          : null,
      status: row.status,
      title: row.title,
      trackId: row.trackId,
    })),
    runId,
  };
};
