import Mux from "@mux/mux-node";
import { and, eq, or } from "drizzle-orm";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { videos, webhookEvents } from "@soundkit/db/schema/app";
import { env } from "@soundkit/env/server";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

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

const getPlaybackId = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const firstPlaybackId = value[0];

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
    (eventType.startsWith("video.asset.") ? getStringValue(eventData.id) : null);
  const uploadId =
    eventType.startsWith("video.upload.") ? getStringValue(eventData.id) : null;
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
    (
      clause
    ): clause is Exclude<(typeof candidateClauses)[number], null> => clause !== null
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

    return "processed" as const;
  }

  if (eventType === "video.asset.deleted") {
    await db
      .update(videos)
      .set({
        status: "deleted",
      })
      .where(eq(videos.id, video.id));

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
