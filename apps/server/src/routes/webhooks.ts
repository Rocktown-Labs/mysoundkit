/* eslint-disable complexity */
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { Mux } from "@mux/mux-node";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  muxAssets,
  muxUploads,
  trackStemJobs,
  videos,
  webhookEvents,
} from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import { and, eq, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { processCompletedStemSplitJob } from "@/lib/audio-processing";
import { messageResponseSchema } from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

const getMuxWebhookClient = () => {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET || !env.MUX_WEBHOOK_SECRET) {
    return null;
  }

  return new Mux({
    tokenId: env.MUX_TOKEN_ID,
    tokenSecret: env.MUX_TOKEN_SECRET,
    webhookSecret: env.MUX_WEBHOOK_SECRET,
  });
};

const getMuxEventId = (event: unknown) => {
  if (
    typeof event === "object" &&
    event !== null &&
    "id" in event &&
    typeof event.id === "string"
  ) {
    return event.id;
  }

  return null;
};

const getMuxEventType = (event: unknown) => {
  if (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    typeof event.type === "string"
  ) {
    return event.type;
  }

  return "unknown";
};

const getEventData = (event: unknown) => {
  if (
    typeof event === "object" &&
    event !== null &&
    "data" in event &&
    typeof event.data === "object" &&
    event.data !== null
  ) {
    return event.data as Record<string, unknown>;
  }

  return null;
};

const getStringValue = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const verifyStemSplitSignature = async ({
  rawBody,
  signature,
}: {
  rawBody: string;
  signature: null | string;
}) => {
  const secret = getEnvValue("STEMSPLIT_WEBHOOK_SECRET");

  if (!secret || !signature) {
    return false;
  }

  const signatureHex = signature.replace(/^sha256=/, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );

  return bytesToHex(new Uint8Array(digest)) === signatureHex;
};

const getPlaybackId = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const [firstPlaybackId] = value;

  if (
    typeof firstPlaybackId === "object" &&
    firstPlaybackId !== null &&
    "id" in firstPlaybackId &&
    typeof firstPlaybackId.id === "string"
  ) {
    return firstPlaybackId.id;
  }

  return null;
};

const updateVideoFromMuxEvent = async (event: unknown) => {
  if (!isDatabaseConfigured()) {
    return "ignored" as const;
  }

  const db = createDb();
  const eventData = getEventData(event);
  const eventType = getMuxEventType(event);

  if (!eventData) {
    return "ignored" as const;
  }

  const assetId =
    getStringValue(eventData.asset_id) ??
    (eventType.startsWith("video.asset.")
      ? getStringValue(eventData.id)
      : null);
  const uploadId = eventType.startsWith("video.upload.")
    ? getStringValue(eventData.id)
    : null;
  const passthrough =
    getStringValue(eventData.passthrough) ??
    getStringValue(
      typeof eventData.new_asset_settings === "object" &&
        eventData.new_asset_settings !== null &&
        "passthrough" in eventData.new_asset_settings
        ? eventData.new_asset_settings.passthrough
        : null
    );

  const candidateClauses = [
    passthrough ? eq(videos.muxPassthrough, passthrough) : null,
    uploadId ? eq(videos.muxUploadId, uploadId) : null,
    assetId ? eq(videos.muxAssetId, assetId) : null,
  ] as const;
  const clauses = candidateClauses.filter(
    (clause): clause is Exclude<(typeof candidateClauses)[number], null> =>
      clause !== null
  );

  if (clauses.length === 0) {
    return "ignored" as const;
  }

  const [video] = await db
    .select({
      id: videos.id,
    })
    .from(videos)
    .where(clauses.length === 1 ? clauses[0] : or(...clauses));

  if (!video) {
    return "ignored" as const;
  }

  if (eventType === "video.upload.asset_created") {
    await db
      .update(videos)
      .set({
        muxAssetId: assetId,
        status: "processing",
      })
      .where(eq(videos.id, video.id));
    if (assetId) {
      await db
        .insert(muxAssets)
        .values({
          muxAssetId: assetId,
          muxUploadId: uploadId,
          passthrough,
          status: "preparing",
          videoId: video.id,
        })
        .onConflictDoUpdate({
          set: {
            muxUploadId: uploadId,
            passthrough,
            status: "preparing",
            videoId: video.id,
          },
          target: muxAssets.muxAssetId,
        });
    }
    if (uploadId) {
      await db
        .update(muxUploads)
        .set({ muxAssetId: assetId, status: "asset_created" })
        .where(eq(muxUploads.muxUploadId, uploadId));
    }

    return "processed" as const;
  }

  if (eventType === "video.asset.ready") {
    await db
      .update(videos)
      .set({
        durationMs:
          typeof eventData.duration === "number"
            ? Math.round(eventData.duration * 1000)
            : null,
        muxAssetId: assetId,
        muxPlaybackId: getPlaybackId(eventData.playback_ids),
        status: "ready",
      })
      .where(eq(videos.id, video.id));
    if (assetId) {
      await db
        .insert(muxAssets)
        .values({
          aspectRatio: getStringValue(eventData.aspect_ratio),
          durationSeconds:
            typeof eventData.duration === "number"
              ? String(eventData.duration)
              : null,
          muxAssetId: assetId,
          passthrough,
          playbackIds: Array.isArray(eventData.playback_ids)
            ? (eventData.playback_ids as { id: string; policy: string }[])
            : null,
          resolutionTier: getStringValue(eventData.resolution_tier),
          status: "ready",
          tracks: eventData.tracks ?? null,
          videoId: video.id,
          videoQuality: getStringValue(eventData.video_quality),
        })
        .onConflictDoUpdate({
          set: {
            aspectRatio: getStringValue(eventData.aspect_ratio),
            durationSeconds:
              typeof eventData.duration === "number"
                ? String(eventData.duration)
                : null,
            playbackIds: Array.isArray(eventData.playback_ids)
              ? (eventData.playback_ids as { id: string; policy: string }[])
              : null,
            resolutionTier: getStringValue(eventData.resolution_tier),
            status: "ready",
            tracks: eventData.tracks ?? null,
            videoId: video.id,
            videoQuality: getStringValue(eventData.video_quality),
          },
          target: muxAssets.muxAssetId,
        });
    }

    return "processed" as const;
  }

  if (
    eventType === "video.asset.errored" ||
    eventType === "video.upload.errored" ||
    eventType === "video.upload.cancelled"
  ) {
    await db
      .update(videos)
      .set({
        muxAssetId: assetId,
        status: "failed",
      })
      .where(eq(videos.id, video.id));
    if (assetId) {
      await db
        .insert(muxAssets)
        .values({
          muxAssetId: assetId,
          status: "errored",
          videoId: video.id,
        })
        .onConflictDoUpdate({
          set: { status: "errored", videoId: video.id },
          target: muxAssets.muxAssetId,
        });
    }
    if (uploadId) {
      await db
        .update(muxUploads)
        .set({ status: "errored" })
        .where(eq(muxUploads.muxUploadId, uploadId));
    }

    return "processed" as const;
  }

  if (eventType === "video.asset.deleted") {
    await db
      .update(videos)
      .set({
        status: "deleted",
      })
      .where(eq(videos.id, video.id));
    if (assetId) {
      await db
        .update(muxAssets)
        .set({ status: "deleted" })
        .where(eq(muxAssets.muxAssetId, assetId));
    }

    return "processed" as const;
  }

  if (eventType === "video.upload.created") {
    await db
      .update(videos)
      .set({
        muxUploadId: uploadId,
        status: "uploading",
      })
      .where(eq(videos.id, video.id));
    if (uploadId) {
      await db
        .insert(muxUploads)
        .values({
          muxUploadId: uploadId,
          status: "waiting",
          videoId: video.id,
        })
        .onConflictDoUpdate({
          set: { status: "waiting", videoId: video.id },
          target: muxUploads.muxUploadId,
        });
    }

    return "processed" as const;
  }

  return "ignored" as const;
};

app.openapi(
  createRoute({
    method: "post",
    path: "/mux",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Mux webhook accepted"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "Mux webhook secret unavailable"
      ),
    },
    tags: ["Webhooks"],
  }),
  async (c) => {
    const mux = getMuxWebhookClient();

    if (!mux) {
      return c.json(
        { message: "Mux webhook verification is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const rawBody = await c.req.raw.text();

    let event: unknown;

    try {
      event = mux.webhooks.unwrap(rawBody, c.req.raw.headers);
    } catch {
      if (isDatabaseConfigured()) {
        const db = createDb();
        await db.insert(webhookEvents).values({
          eventType: "mux.invalid_signature",
          externalEventId: null,
          id: crypto.randomUUID(),
          payload: { rawBody },
          provider: "mux",
          status: "failed",
        });
      }

      return c.json(
        { message: "Invalid Mux webhook signature." },
        HttpStatusCodes.OK
      );
    }

    const eventType = getMuxEventType(event);
    const externalEventId = getMuxEventId(event);
    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    if (!isDatabaseConfigured()) {
      return c.json({ message: "Mux webhook accepted." }, HttpStatusCodes.OK);
    }

    const db = createDb();
    const [existingEvent] = externalEventId
      ? await db
          .select({
            id: webhookEvents.id,
          })
          .from(webhookEvents)
          .where(
            and(
              eq(webhookEvents.provider, "mux"),
              eq(webhookEvents.externalEventId, externalEventId)
            )
          )
      : [];

    if (existingEvent) {
      return c.json(
        { message: "Mux webhook already processed." },
        HttpStatusCodes.OK
      );
    }

    const eventRowId = crypto.randomUUID();

    await db.insert(webhookEvents).values({
      eventType,
      externalEventId,
      id: eventRowId,
      payload,
      provider: "mux",
      status: "received",
    });

    const status = await updateVideoFromMuxEvent(event);

    await db
      .update(webhookEvents)
      .set({
        processedAt: new Date(),
        status,
      })
      .where(eq(webhookEvents.id, eventRowId));

    return c.json({ message: "Mux webhook accepted." }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/stripe",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Stripe webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  (c) => c.json({ message: "Stripe webhook accepted" }, HttpStatusCodes.OK)
);

const getStemSplitEventId = (payload: Record<string, unknown>) => {
  const eventId = getStringValue(payload.id);

  if (eventId) {
    return eventId;
  }

  const data = getEventData(payload);
  const jobId = data ? getStringValue(data.jobId) : null;
  const event = getStringValue(payload.event);

  return jobId && event ? `${event}:${jobId}` : null;
};

const handleStemSplitWebhookPayload = async (
  payload: Record<string, unknown>
) => {
  if (!isDatabaseConfigured()) {
    return "ignored" as const;
  }

  const event = getStringValue(payload.event);
  const data = getEventData(payload);
  const jobId = data ? getStringValue(data.jobId) : null;

  if (!event || !data || !jobId) {
    return "ignored" as const;
  }

  const db = createDb();
  const [stemJob] = await db
    .select()
    .from(trackStemJobs)
    .where(eq(trackStemJobs.stemsplitJobId, jobId))
    .limit(1);

  if (!stemJob) {
    return "ignored" as const;
  }

  if (event === "job.failed") {
    await db
      .update(trackStemJobs)
      .set({
        error: data,
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(trackStemJobs.id, stemJob.id));

    return "processed" as const;
  }

  if (event !== "job.completed") {
    return "ignored" as const;
  }

  await processCompletedStemSplitJob({
    assetId: stemJob.inputAssetId,
    job: {
      audioMetadata:
        typeof data.audioMetadata === "object" && data.audioMetadata !== null
          ? (data.audioMetadata as { bpm?: number; key?: string })
          : undefined,
      creditsCharged:
        typeof data.creditsCharged === "number"
          ? data.creditsCharged
          : undefined,
      id: jobId,
      outputs:
        typeof data.outputs === "object" && data.outputs !== null
          ? (data.outputs as {
              instrumental?: { expiresAt?: string; url?: string };
              vocals?: { expiresAt?: string; url?: string };
            })
          : undefined,
      progress: 100,
      status: "COMPLETED",
    },
    trackId: stemJob.trackId,
  });

  return "processed" as const;
};

app.openapi(
  createRoute({
    method: "post",
    path: "/stemsplit",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "StemSplit webhook accepted"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        messageResponseSchema,
        "StemSplit webhook secret unavailable"
      ),
    },
    tags: ["Webhooks"],
  }),
  async (c) => {
    if (!getEnvValue("STEMSPLIT_WEBHOOK_SECRET")) {
      return c.json(
        { message: "StemSplit webhook verification is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const rawBody = await c.req.raw.text();
    const signature = c.req.raw.headers.get("X-Webhook-Signature");
    const verified = await verifyStemSplitSignature({ rawBody, signature });

    if (!verified) {
      return c.json(
        { message: "Invalid StemSplit webhook signature." },
        HttpStatusCodes.OK
      );
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const externalEventId = getStemSplitEventId(payload);

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "StemSplit webhook accepted." },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [existingEvent] = externalEventId
      ? await db
          .select({
            id: webhookEvents.id,
          })
          .from(webhookEvents)
          .where(
            and(
              eq(webhookEvents.provider, "stemsplit"),
              eq(webhookEvents.externalEventId, externalEventId)
            )
          )
      : [];

    if (existingEvent) {
      return c.json(
        { message: "StemSplit webhook already processed." },
        HttpStatusCodes.OK
      );
    }

    const eventRowId = crypto.randomUUID();
    const eventType = getStringValue(payload.event) ?? "unknown";

    await db.insert(webhookEvents).values({
      eventType,
      externalEventId,
      id: eventRowId,
      payload,
      provider: "stemsplit",
      status: "received",
    });

    const status = await handleStemSplitWebhookPayload(payload);

    await db
      .update(webhookEvents)
      .set({
        processedAt: new Date(),
        status,
      })
      .where(eq(webhookEvents.id, eventRowId));

    return c.json(
      { message: "StemSplit webhook accepted." },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/battle-service",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        messageResponseSchema,
        "Battle service webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  (c) =>
    c.json({ message: "Battle service webhook accepted" }, HttpStatusCodes.OK)
);

export default app;
