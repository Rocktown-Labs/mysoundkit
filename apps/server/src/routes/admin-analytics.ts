/* eslint-disable one-var */
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { isDatabaseConfigured } from "@soundkit/db";
import jsonContent from "stoker/openapi/helpers/json-content";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import {
  analyticsAccountParamSchema,
  analyticsErasureSchema,
  analyticsEventParamSchema,
  analyticsFailuresSchema,
  analyticsHealthSchema,
  analyticsReconciliationQuerySchema,
  analyticsReconciliationSchema,
  analyticsReplaySchema,
  analyticsRetentionSchema,
} from "@/lib/analytics-api-schemas";
import {
  analyticsFailures,
  analyticsOutboxHealth,
  eraseAccountAnalytics,
  replayAnalyticsEvent,
} from "@/lib/analytics-outbox";
import {
  analyticsDailyActivity,
  analyticsRetention,
  reconcileAnalytics,
} from "@/lib/analytics-reconciliation";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success)
        {return c.json({ message: "Invalid analytics request." }, 400);}
    },
  }),
  errorSchema = z.object({ message: z.string() }),
  errors = {
    400: jsonContent(errorSchema, "Invalid request"),
    403: jsonContent(errorSchema, "Admin access required"),
    503: jsonContent(errorSchema, "Analytics database unavailable"),
  };
app.use("*", async (c, next) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json({ message: "Admin access is required." }, 403);
  }
  if (!isDatabaseConfigured()) {
    return c.json({ message: "Analytics database is not configured." }, 503);
  }
  return await next();
});
app.openapi(
  createRoute({
    method: "get",
    path: "/health",
    responses: {
      ...errors,
      200: jsonContent(analyticsHealthSchema, "Outbox health"),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) =>
    c.json(
      analyticsHealthSchema.parse(
        await analyticsOutboxHealth(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test")
      ),
      200
    )
);
app.openapi(
  createRoute({
    method: "get",
    path: "/failures",
    responses: {
      ...errors,
      200: jsonContent(analyticsFailuresSchema, "Quarantined events"),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) =>
    c.json(
      analyticsFailuresSchema.parse({
        events: await analyticsFailures(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"),
      }),
      200
    )
);
app.openapi(
  createRoute({
    method: "get",
    path: "/retention",
    responses: {
      ...errors,
      200: jsonContent(
        analyticsRetentionSchema,
        "Observed UTC account cohorts"
      ),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) => {
    const environment = c.env.SOUNDKIT_ANALYTICS_ENV ?? "test";
    const [cohorts, daily] = await Promise.all([
      analyticsRetention(environment),
      analyticsDailyActivity(environment),
    ]);
    return c.json(analyticsRetentionSchema.parse({ cohorts, daily }), 200);
  }
);
app.openapi(
  createRoute({
    method: "get",
    path: "/reconciliation",
    request: { query: analyticsReconciliationQuerySchema },
    responses: {
      ...errors,
      200: jsonContent(
        analyticsReconciliationSchema,
        "Observed commerce mismatches"
      ),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) => {
    const { before_created_at: createdAt, before_id: id } =
      c.req.valid("query");
    return c.json(
      analyticsReconciliationSchema.parse(
        await reconcileAnalytics(
          c.env.SOUNDKIT_ANALYTICS_ENV ?? "test",
          undefined,
          createdAt && id ? { createdAt, id } : undefined
        )
      ),
      200
    );
  }
);
app.openapi(
  createRoute({
    method: "post",
    path: "/replay/{id}",
    request: { params: analyticsEventParamSchema },
    responses: {
      ...errors,
      200: jsonContent(analyticsReplaySchema, "Event replay requested"),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) =>
    c.json(
      {
        replayed: await replayAnalyticsEvent(
          c.req.valid("param").id,
          c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"
        ),
      },
      200
    )
);
app.openapi(
  createRoute({
    method: "post",
    path: "/erase/{userId}",
    request: { params: analyticsAccountParamSchema },
    responses: {
      ...errors,
      200: jsonContent(analyticsErasureSchema, "Account analytics erased"),
    },
    tags: ["Admin Analytics"],
  }),
  async (c) => {
    await eraseAccountAnalytics(c.req.valid("param").userId);
    return c.json({ erased: true }, 200);
  }
);
export default app;
