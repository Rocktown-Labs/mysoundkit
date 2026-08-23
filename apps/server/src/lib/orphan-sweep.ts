/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { projectAssets, trackAssets } from "@soundkit/db/schema/app";
import { inArray } from "drizzle-orm";

import { logInfo } from "@/middleware/structured-logging";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000,
  SWEEP_LIMIT = 500;

/**
 * Deletes uploaded R2 objects that never got registered as assets
 * (abandoned uploads) after a grace period. Registered media is untouched.
 */
export const runOrphanedUploadSweep = async ({
  bucket,
  now = new Date(),
}: {
  bucket?: R2Bucket | null;
} & { now?: Date }): Promise<{ deleted: number; skipped: boolean }> => {
  if (!(bucket && isDatabaseConfigured())) {
    return { deleted: 0, skipped: true };
  }

  const db = createDb(),
    cutoff = new Date(now.getTime() - GRACE_PERIOD_MS),
    listed = await bucket.list({ limit: SWEEP_LIMIT }),
    candidateKeys = listed.objects
      .filter(
        (object) =>
          object.uploaded < cutoff &&
          (object.key.startsWith("tracks/") ||
            object.key.startsWith("uploads/") ||
            object.key.startsWith("projects/"))
      )
      .map((object) => object.key);

  if (candidateKeys.length === 0) {
    return { deleted: 0, skipped: false };
  }

  const registeredTrackKeys = await db
      .select({ objectKey: trackAssets.objectKey })
      .from(trackAssets)
      .where(inArray(trackAssets.objectKey, candidateKeys)),
    registeredProjectKeys = await db
      .select({ objectKey: projectAssets.objectKey })
      .from(projectAssets)
      .where(inArray(projectAssets.objectKey, candidateKeys)),
    registered = new Set([
      ...registeredTrackKeys.map((row) => row.objectKey),
      ...registeredProjectKeys.map((row) => row.objectKey),
    ]),
    orphanedKeys = candidateKeys.filter((key) => !registered.has(key));

  for (const key of orphanedKeys) {
    await bucket.delete(key);
  }

  logInfo({
    deleted: orphanedKeys.length,
    event: "orphaned_uploads_swept",
    scanned: candidateKeys.length,
  });

  return { deleted: orphanedKeys.length, skipped: false };
};
