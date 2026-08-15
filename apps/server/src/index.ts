import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sentry } from "@sentry/hono/cloudflare";
import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { env } from "@soundkit/env/server";
import { sql } from "drizzle-orm";
import { cors } from "hono/cors";
import notFound from "stoker/middlewares/not-found";
import defaultHook from "stoker/openapi/default-hook";

import { runBattleServiceSweep } from "@/lib/battle-service";
import {
  handleEmailDeliveryQueue,
  retryDueEmailDeliveries,
} from "@/lib/email-delivery";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { jsonError } from "@/lib/errors";
import { publishDueLiveRecordings } from "@/lib/live-experience-events";
import { handleTrackDurationBackfillQueue } from "@/lib/media-metadata";
import type { DurationBackfillQueueMessage } from "@/lib/media-metadata";
import { isTrackDurationBackfillQueueName } from "@/lib/media-queue";
import { publishDueTrackReleases } from "@/lib/release-notifications";
import { withRetry } from "@/lib/retry";
import type { AppEnv } from "@/lib/types";
import { jsonBodyMiddleware } from "@/middleware/json-body";
import { sessionMiddleware } from "@/middleware/session";
import {
  logWarn,
  structuredLoggingMiddleware,
} from "@/middleware/structured-logging";
import adminRoutes from "@/routes/admin";
import adminFinanceRoutes from "@/routes/admin-finance";
import adsRoutes from "@/routes/ads";
import analyticsRoutes from "@/routes/analytics";
import artistsRoutes from "@/routes/artists";
import battlesRoutes from "@/routes/battles";
import billingRoutes from "@/routes/billing";
import cartRoutes from "@/routes/cart";
import communitiesRoutes from "@/routes/communities";
import communityBillingRoutes from "@/routes/community-billing";
import discoverRoutes from "@/routes/discover";
import libraryRoutes from "@/routes/library";
import listeningPartiesRoutes from "@/routes/listening-parties";
import liveRoutes from "@/routes/live";
import meRoutes from "@/routes/me";
import messagesRoutes from "@/routes/messages";
import notificationsRoutes from "@/routes/notifications";
import onboardingRoutes from "@/routes/onboarding";
import openVersesRoutes from "@/routes/open-verses";
import paymentsRoutes from "@/routes/payments";
import playlistsRoutes from "@/routes/playlists";
import projectsRoutes from "@/routes/projects";
import searchRoutes from "@/routes/search";
import sellerRoutes from "@/routes/seller";
import socialRoutes from "@/routes/social";
import tracksRoutes from "@/routes/tracks";
import uploadsRoutes from "@/routes/uploads";
import videosRoutes from "@/routes/videos";
import webhookRoutes from "@/routes/webhooks";
import stripeWebhookRoutes from "@/routes/webhooks-stripe";

export { TrackProcessingWorkflow } from "@/workflows/track-processing";
export { LiveRoomDurableObject } from "@/durable-objects/live-room";

const app = new OpenAPIHono<AppEnv>({
  defaultHook,
}),

 hasEnvValue = (key: string) =>
  Boolean((env as unknown as Record<string, unknown>)[key]),

 allowedCorsOriginPatterns = [
  /^https:\/\/([a-z0-9-]+\.)*mysoundkit\.pages\.dev$/u,
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/u,
  /^https:\/\/([a-z0-9-]+\.)*workers\.dev$/u,
  /^https:\/\/([a-z0-9-]+\.)*rocktown-labs\.workers\.dev$/u,
],

 isAllowedCorsOrigin = (origin: string) =>
  origin === env.CORS_ORIGIN ||
  origin === env.BETTER_AUTH_URL ||
  allowedCorsOriginPatterns.some((pattern) => pattern.test(origin)),

 checkDatabaseHealth = async () => {
  if (!isDatabaseConfigured()) {
    return "not_configured" as const;
  }

  try {
    await withRetry(
      "database health check",
      () => createDb().execute(sql`select 1`),
      {
        maxRetries: 1,
        timeoutMs: 2500,
      }
    );

    return "connected" as const;
  } catch (error) {
    logWarn({
      check: "database",
      error: error instanceof Error ? error.message : String(error),
      status: "unhealthy",
    });

    return "unhealthy" as const;
  }
};

app.use(
  sentry(app, (workerEnv) => ({
    dsn: workerEnv.SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: true,
    tracesSampleRate: 1,
  }))
);
app.use(structuredLoggingMiddleware);
app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    origin: (origin) =>
      origin && isAllowedCorsOrigin(origin) ? origin : env.CORS_ORIGIN,
  })
);
app.use("/v1/*", jsonBodyMiddleware);
app.use("/v1/*", sessionMiddleware);

app.doc("/api/openapi.json", {
  info: {
    description:
      "Hono API foundation for SoundKit covering auth, catalog, collaboration, messaging, billing, media, and battle read models.",
    title: "SoundKit API",
    version: "0.1.0",
  },
  openapi: "3.1.0",
});

app.get(
  "/api/docs",
  swaggerUI({
    url: "/api/openapi.json",
  })
);

app.get("/", async (c) =>
  c.json({
    bindings: {
      databaseUrl: hasEnvValue("DATABASE_URL"),
      hyperdrive: hasEnvValue("HYPERDRIVE"),
    },
    database: await checkDatabaseHealth(),
    databaseConfigured: isDatabaseConfigured(),
    ok: true,
    service: "soundkit-api",
    timestamp: new Date().toISOString(),
  })
);

app.get("/health", async (c) =>
  c.json({
    bindings: {
      databaseUrl: hasEnvValue("DATABASE_URL"),
      emailDeliveryQueue: hasEnvValue("EMAIL_DELIVERY_QUEUE"),
      hyperdrive: hasEnvValue("HYPERDRIVE"),
      liveRooms: hasEnvValue("LIVE_ROOMS"),
      mediaPublicUrl: hasEnvValue("MEDIA_PUBLIC_URL"),
      trackDurationBackfillQueue: hasEnvValue("TRACK_DURATION_BACKFILL_QUEUE"),
      trackProcessingWorkflow: hasEnvValue("TRACK_PROCESSING_WORKFLOW"),
      uploadBucket: hasEnvValue("UPLOAD_BUCKET_NAME"),
    },
    database: await checkDatabaseHealth(),
    databaseConfigured: isDatabaseConfigured(),
    ok: true,
    requestId: c.get("requestId"),
    service: "soundkit-api",
    timestamp: new Date().toISOString(),
  })
);

app.on(["GET", "POST"], "/auth/*", (c) => createAuth().handler(c.req.raw));

app
  .route("/v1/me", meRoutes)
  .route("/v1/onboarding", onboardingRoutes)
  .route("/v1/discover", discoverRoutes)
  .route("/v1/artists", artistsRoutes)
  .route("/v1/tracks", tracksRoutes)
  .route("/v1/projects", projectsRoutes)
  .route("/v1/search", searchRoutes)
  .route("/v1/videos", videosRoutes)
  .route("/v1/library", libraryRoutes)
  .route("/v1/listening-parties", listeningPartiesRoutes)
  .route("/v1/live", liveRoutes)
  .route("/v1/playlists", playlistsRoutes)
  .route("/v1/social", socialRoutes)
  .route("/v1/messages", messagesRoutes)
  .route("/v1/notifications", notificationsRoutes)
  .route("/v1/open-verses", openVersesRoutes)
  .route("/v1/cart", cartRoutes)
  .route("/v1/payments", paymentsRoutes)
  .route("/v1/communities", communitiesRoutes)
  .route("/v1/community-billing", communityBillingRoutes)
  .route("/v1/admin", adminRoutes)
  .route("/v1/admin/finance", adminFinanceRoutes)
  .route("/v1/ads", adsRoutes)
  .route("/v1/analytics", analyticsRoutes)
  .route("/v1/billing", billingRoutes)
  .route("/v1/seller", sellerRoutes)
  .route("/v1/battles", battlesRoutes)
  .route("/v1/uploads", uploadsRoutes)
  .route("/v1/webhooks", webhookRoutes)
  .route("/v1/webhooks/stripe-commerce", stripeWebhookRoutes);

app.notFound(notFound);
// Hono's onError API is callback-based.
// eslint-disable-next-line promise/prefer-await-to-callbacks
app.onError((error, c) => jsonError(c, error));

export type { AppType } from "./rpc-contract";

export default {
  fetch: (request, workerEnv, executionContext) =>
    app.fetch(request, workerEnv, executionContext),
  queue: (batch) => {
    if (isTrackDurationBackfillQueueName(batch.queue)) {
      return handleTrackDurationBackfillQueue(
        batch as unknown as MessageBatch<DurationBackfillQueueMessage>
      );
    }

    return handleEmailDeliveryQueue(
      batch as unknown as MessageBatch<EmailDeliveryQueueMessage>
    );
  },
  scheduled: (_controller, workerEnv, executionContext) => {
    executionContext.waitUntil(
      Promise.allSettled([
        runBattleServiceSweep({
          emailQueue: workerEnv.EMAIL_DELIVERY_QUEUE,
        }),
        publishDueLiveRecordings(),
        retryDueEmailDeliveries({ queue: workerEnv.EMAIL_DELIVERY_QUEUE }),
        publishDueTrackReleases({
          emailQueue: workerEnv.EMAIL_DELIVERY_QUEUE,
        }),
      ])
    );
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
