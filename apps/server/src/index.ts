import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createAuth } from "@soundkit/auth";
import { isDatabaseConfigured } from "@soundkit/db";
import { env } from "@soundkit/env/server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import notFound from "stoker/middlewares/not-found";
import onError from "stoker/middlewares/on-error";
import defaultHook from "stoker/openapi/default-hook";

import type { AppEnv } from "@/lib/types";
import { sessionMiddleware } from "@/middleware/session";
import analyticsRoutes from "@/routes/analytics";
import artistsRoutes from "@/routes/artists";
import battlesRoutes from "@/routes/battles";
import billingRoutes from "@/routes/billing";
import cartRoutes from "@/routes/cart";
import discoverRoutes from "@/routes/discover";
import libraryRoutes from "@/routes/library";
import meRoutes from "@/routes/me";
import messagesRoutes from "@/routes/messages";
import onboardingRoutes from "@/routes/onboarding";
import playlistsRoutes from "@/routes/playlists";
import projectsRoutes from "@/routes/projects";
import socialRoutes from "@/routes/social";
import tracksRoutes from "@/routes/tracks";
import uploadsRoutes from "@/routes/uploads";
import videosRoutes from "@/routes/videos";
import webhookRoutes from "@/routes/webhooks";

const app = new OpenAPIHono<AppEnv>({
  defaultHook,
});

app.use(logger());
app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    origin: env.CORS_ORIGIN,
  })
);
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

app.get("/", (c) =>
  c.json({
    databaseConfigured: isDatabaseConfigured(),
    ok: true,
    service: "soundkit-api",
    timestamp: new Date().toISOString(),
  })
);

app.get("/health", (c) =>
  c.json({
    databaseConfigured: isDatabaseConfigured(),
    ok: true,
    service: "soundkit-api",
    timestamp: new Date().toISOString(),
  })
);

app.on(["GET", "POST"], "/auth/*", (c) => createAuth().handler(c.req.raw));

const apiRoutes = app
  .route("/v1/me", meRoutes)
  .route("/v1/onboarding", onboardingRoutes)
  .route("/v1/discover", discoverRoutes)
  .route("/v1/artists", artistsRoutes)
  .route("/v1/tracks", tracksRoutes)
  .route("/v1/projects", projectsRoutes)
  .route("/v1/videos", videosRoutes)
  .route("/v1/library", libraryRoutes)
  .route("/v1/playlists", playlistsRoutes)
  .route("/v1/social", socialRoutes)
  .route("/v1/messages", messagesRoutes)
  .route("/v1/cart", cartRoutes)
  .route("/v1/analytics", analyticsRoutes)
  .route("/v1/billing", billingRoutes)
  .route("/v1/battles", battlesRoutes)
  .route("/v1/uploads", uploadsRoutes)
  .route("/v1/webhooks", webhookRoutes);

app.notFound(notFound);
app.onError(onError);

export type AppType = typeof apiRoutes;

export default app;
