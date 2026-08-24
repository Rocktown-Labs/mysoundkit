/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  adCampaigns,
  messageAttachments,
  projectAssets,
  trackAssets,
  uploadIntents,
  userProfiles,
} from "@soundkit/db/schema/app";
import { and, gt, inArray, lt, or } from "drizzle-orm";

import { isUploadIntentTableUnavailable } from "@/lib/upload-intents";
import { logInfo, logWarn } from "@/middleware/structured-logging";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000,
  DB_BATCH_SIZE = 500,
  LIST_PAGE_SIZE = 500,
  trackedPrefixes = ["profiles/", "projects/", "tracks/", "uploads/"],
  chunks = <T>(items: T[], size: number): T[][] => {
    const batches: T[][] = [];
    for (let offset = 0; offset < items.length; offset += size) {
      batches.push(items.slice(offset, offset + size));
    }
    return batches;
  };

interface UploadObjectLister {
  list: (options: { cursor?: string; limit: number }) => Promise<{
    cursor?: string;
    objects: { key: string; uploaded: Date }[];
    truncated: boolean;
  }>;
}

export const listLegacyOrphanCandidates = async ({
  bucket,
  cutoff,
}: {
  bucket: UploadObjectLister;
  cutoff: Date;
}): Promise<{ keys: string[]; scanned: number }> => {
  const keys: string[] = [];
  let cursor: string | undefined,
    scanned = 0;

  do {
    const listed = await bucket.list({ cursor, limit: LIST_PAGE_SIZE });
    scanned += listed.objects.length;
    for (const object of listed.objects) {
      if (
        object.uploaded < cutoff &&
        trackedPrefixes.some((prefix) => object.key.startsWith(prefix))
      ) {
        keys.push(object.key);
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return { keys, scanned };
};

const registeredObjectKeys = async (candidateKeys: string[]) => {
    const db = createDb(),
      registered = new Set<string>();

    for (const batch of chunks(candidateKeys, DB_BATCH_SIZE)) {
      const [trackRows, projectRows, profileRows, messageRows, adRows] =
        await Promise.all([
          db
            .select({ objectKey: trackAssets.objectKey })
            .from(trackAssets)
            .where(inArray(trackAssets.objectKey, batch)),
          db
            .select({ objectKey: projectAssets.objectKey })
            .from(projectAssets)
            .where(inArray(projectAssets.objectKey, batch)),
          db
            .select({
              avatarObjectKey: userProfiles.avatarObjectKey,
              headerObjectKey: userProfiles.headerObjectKey,
            })
            .from(userProfiles)
            .where(
              or(
                inArray(userProfiles.avatarObjectKey, batch),
                inArray(userProfiles.headerObjectKey, batch)
              )
            ),
          db
            .select({ objectKey: messageAttachments.objectKey })
            .from(messageAttachments)
            .where(inArray(messageAttachments.objectKey, batch)),
          db
            .select({
              creativeImageUrl: adCampaigns.creativeImageUrl,
              creativeUrl: adCampaigns.creativeUrl,
            })
            .from(adCampaigns),
        ]);

      for (const row of trackRows) {
        if (row.objectKey) {
          registered.add(row.objectKey);
        }
      }
      for (const row of projectRows) {
        if (row.objectKey) {
          registered.add(row.objectKey);
        }
      }
      for (const row of profileRows) {
        if (row.avatarObjectKey) {
          registered.add(row.avatarObjectKey);
        }
        if (row.headerObjectKey) {
          registered.add(row.headerObjectKey);
        }
      }
      for (const row of messageRows) {
        if (row.objectKey) {
          registered.add(row.objectKey);
        }
      }
      for (const row of adRows) {
        for (const key of batch) {
          if (
            row.creativeUrl.endsWith(`/${key}`) ||
            row.creativeImageUrl?.endsWith(`/${key}`)
          ) {
            registered.add(key);
          }
        }
      }
    }

    return registered;
  },
  activeIntentObjectKeys = async (candidateKeys: string[], now: Date) => {
    const db = createDb(),
      active = new Set<string>();
    try {
      for (const batch of chunks(candidateKeys, DB_BATCH_SIZE)) {
        const rows = await db
          .select({ objectKey: uploadIntents.objectKey })
          .from(uploadIntents)
          .where(
            and(
              inArray(uploadIntents.objectKey, batch),
              inArray(uploadIntents.status, ["pending", "registering"]),
              gt(uploadIntents.expiresAt, now)
            )
          );
        for (const row of rows) {
          active.add(row.objectKey);
        }
      }
    } catch (error) {
      if (!isUploadIntentTableUnavailable(error)) {
        throw error;
      }
      logWarn({
        event: "upload_intents_table_unavailable",
        operation: "sweep",
      });
    }
    return active;
  },
  runExpiredIntentSweep = async ({
    bucket,
    now,
  }: {
    bucket: R2Bucket;
    now: Date;
  }): Promise<number> => {
    const db = createDb();
    try {
      const expired = await db
        .select({ id: uploadIntents.id })
        .from(uploadIntents)
        .where(
          and(
            inArray(uploadIntents.status, ["pending", "registering"]),
            lt(uploadIntents.expiresAt, now)
          )
        )
        .limit(DB_BATCH_SIZE);
      if (expired.length === 0) {
        return 0;
      }

      const claimed = await db
        .update(uploadIntents)
        .set({ status: "cleaning", updatedAt: now })
        .where(
          and(
            inArray(
              uploadIntents.id,
              expired.map((intent) => intent.id)
            ),
            inArray(uploadIntents.status, ["pending", "registering"]),
            lt(uploadIntents.expiresAt, now)
          )
        )
        .returning({
          id: uploadIntents.id,
          objectKey: uploadIntents.objectKey,
        });
      if (claimed.length === 0) {
        return 0;
      }

      const registered = await registeredObjectKeys(
          claimed.map((intent) => intent.objectKey)
        ),
        registeredIntents = claimed.filter((intent) =>
          registered.has(intent.objectKey)
        ),
        orphanedIntents = claimed.filter(
          (intent) => !registered.has(intent.objectKey)
        );

      if (registeredIntents.length > 0) {
        await db
          .update(uploadIntents)
          .set({ registeredAt: now, status: "registered", updatedAt: now })
          .where(
            inArray(
              uploadIntents.id,
              registeredIntents.map((intent) => intent.id)
            )
          );
      }
      if (orphanedIntents.length > 0) {
        await bucket.delete(orphanedIntents.map((intent) => intent.objectKey));
        await db
          .update(uploadIntents)
          .set({ status: "deleted", updatedAt: now })
          .where(
            inArray(
              uploadIntents.id,
              orphanedIntents.map((intent) => intent.id)
            )
          );
      }

      logInfo({
        deleted: orphanedIntents.length,
        event: "expired_upload_intents_swept",
        recovered: registeredIntents.length,
        scanned: claimed.length,
      });
      return orphanedIntents.length;
    } catch (error) {
      if (isUploadIntentTableUnavailable(error)) {
        logWarn({
          event: "upload_intents_table_unavailable",
          operation: "expired_sweep",
        });
        return 0;
      }
      throw error;
    }
  };

/** Deletes abandoned uploads while preserving every registered media object. */
export const runOrphanedUploadSweep = async ({
  bucket,
  now = new Date(),
}: {
  bucket?: R2Bucket | null;
  now?: Date;
}): Promise<{ deleted: number; skipped: boolean }> => {
  if (!(bucket && isDatabaseConfigured())) {
    return { deleted: 0, skipped: true };
  }

  const intentDeleted = await runExpiredIntentSweep({ bucket, now }),
    cutoff = new Date(now.getTime() - GRACE_PERIOD_MS),
    { keys: candidateKeys, scanned } = await listLegacyOrphanCandidates({
      bucket,
      cutoff,
    });

  if (candidateKeys.length === 0) {
    logInfo({
      deleted: intentDeleted,
      event: "orphaned_uploads_swept",
      scanned,
    });
    return { deleted: intentDeleted, skipped: false };
  }

  const [registered, activeIntents] = await Promise.all([
      registeredObjectKeys(candidateKeys),
      activeIntentObjectKeys(candidateKeys, now),
    ]),
    orphanedKeys = candidateKeys.filter(
      (key) => !(registered.has(key) || activeIntents.has(key))
    );

  for (const batch of chunks(orphanedKeys, DB_BATCH_SIZE)) {
    await bucket.delete(batch);
  }

  logInfo({
    candidates: candidateKeys.length,
    deleted: intentDeleted + orphanedKeys.length,
    event: "orphaned_uploads_swept",
    protectedByIntent: activeIntents.size,
    registered: registered.size,
    scanned,
  });

  return {
    deleted: intentDeleted + orphanedKeys.length,
    skipped: false,
  };
};
