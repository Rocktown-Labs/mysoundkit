/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls, prefer-named-capture-group */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { uploadIntents } from "@soundkit/db/schema/app";
import { and, eq, or } from "drizzle-orm";

import { logWarn } from "@/middleware/structured-logging";

const UPLOAD_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type UploadIntentEntityType =
  | "ad_creative"
  | "message_attachment"
  | "profile"
  | "project"
  | "project_asset"
  | "track"
  | "track_asset";

export class UploadIntentConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UploadIntentConflictError";
  }
}

const postgresErrorCode = (error: unknown): string | null => {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && "code" in current) {
      const { code } = current as { code?: unknown };
      if (typeof code === "string") {
        return code;
      }
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }
  return null;
};

export const isUploadIntentTableUnavailable = (error: unknown): boolean =>
  postgresErrorCode(error) === "42P01";

const handleUnavailableTable = (error: unknown, operation: string): boolean => {
  if (!isUploadIntentTableUnavailable(error)) {
    return false;
  }

  logWarn({
    event: "upload_intents_table_unavailable",
    operation,
  });
  return true;
};

export const objectKeyFromMediaUrl = (value: string): string | null => {
  try {
    const pathname = new URL(value).pathname.replaceAll(/^\/+|\/+$/gu, ""),
      mediaPath = pathname.startsWith("media/")
        ? pathname.slice("media/".length)
        : pathname;
    return /^(profiles|projects|tracks|uploads)\//u.test(mediaPath)
      ? decodeURIComponent(mediaPath)
      : null;
  } catch {
    return null;
  }
};

export const recordUploadIntent = async ({
  entityId,
  fileName,
  mimeType,
  objectKey,
  route,
  sizeBytes,
  userId,
}: {
  entityId?: string | null;
  fileName: string;
  mimeType?: string | null;
  objectKey: string;
  route: string;
  sizeBytes?: number | null;
  userId: string;
}): Promise<boolean> => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const db = createDb(),
      id = crypto.randomUUID(),
      [created] = await db
        .insert(uploadIntents)
        .values({
          entityId: entityId ?? null,
          expiresAt: new Date(Date.now() + UPLOAD_INTENT_TTL_MS),
          fileName,
          id,
          mimeType: mimeType ?? null,
          objectKey,
          route,
          sizeBytes: sizeBytes ?? null,
          status: "pending",
          userId,
        })
        .onConflictDoNothing({ target: uploadIntents.objectKey })
        .returning({ id: uploadIntents.id });

    if (created) {
      return true;
    }

    const [existing] = await db
      .select({
        route: uploadIntents.route,
        userId: uploadIntents.userId,
      })
      .from(uploadIntents)
      .where(eq(uploadIntents.objectKey, objectKey))
      .limit(1);

    if (existing?.userId === userId && existing.route === route) {
      return true;
    }

    throw new UploadIntentConflictError(
      "That storage object is already reserved by another upload."
    );
  } catch (error) {
    if (handleUnavailableTable(error, "record")) {
      return false;
    }
    throw error;
  }
};

export const claimUploadIntent = async ({
  entityId,
  entityType,
  objectKey,
  userId,
}: {
  entityId: string;
  entityType: UploadIntentEntityType;
  objectKey: string;
  userId: string;
}): Promise<boolean> => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const db = createDb(),
      [intent] = await db
        .select()
        .from(uploadIntents)
        .where(eq(uploadIntents.objectKey, objectKey))
        .limit(1);

    if (!intent) {
      return false;
    }
    if (intent.userId !== userId) {
      throw new UploadIntentConflictError(
        "That uploaded object belongs to a different user."
      );
    }
    if (
      intent.status === "registered" &&
      intent.registeredEntityType === entityType &&
      intent.registeredEntityId === entityId
    ) {
      return true;
    }

    const [claimed] = await db
      .update(uploadIntents)
      .set({
        registeredEntityId: entityId,
        registeredEntityType: entityType,
        status: "registering",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uploadIntents.id, intent.id),
          or(
            eq(uploadIntents.status, "pending"),
            and(
              eq(uploadIntents.status, "registering"),
              eq(uploadIntents.registeredEntityType, entityType),
              eq(uploadIntents.registeredEntityId, entityId)
            )
          )
        )
      )
      .returning({ id: uploadIntents.id });

    if (!claimed) {
      throw new UploadIntentConflictError(
        "That uploaded object is already being registered elsewhere."
      );
    }
    return true;
  } catch (error) {
    if (handleUnavailableTable(error, "claim")) {
      return false;
    }
    throw error;
  }
};

export const completeUploadIntent = async ({
  entityId,
  entityType,
  objectKey,
  userId,
}: {
  entityId: string;
  entityType: UploadIntentEntityType;
  objectKey: string;
  userId: string;
}): Promise<boolean> => {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    const [completed] = await createDb()
      .update(uploadIntents)
      .set({
        registeredAt: new Date(),
        registeredEntityId: entityId,
        registeredEntityType: entityType,
        status: "registered",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uploadIntents.objectKey, objectKey),
          eq(uploadIntents.userId, userId),
          eq(uploadIntents.registeredEntityType, entityType),
          eq(uploadIntents.registeredEntityId, entityId),
          or(
            eq(uploadIntents.status, "registering"),
            eq(uploadIntents.status, "registered")
          )
        )
      )
      .returning({ id: uploadIntents.id });

    return Boolean(completed);
  } catch (error) {
    if (handleUnavailableTable(error, "complete")) {
      return false;
    }
    throw error;
  }
};
