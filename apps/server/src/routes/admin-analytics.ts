/* eslint-disable one-var */
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import {
  analyticsOutboxHealth,
  eraseAccountAnalytics,
  analyticsFailures,
  replayAnalyticsEvent,
} from "@/lib/analytics-outbox";
import {
  analyticsDailyActivity,
  analyticsRetention,
  reconcileAnalytics,
} from "@/lib/analytics-reconciliation";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();
app.use("*", async (c, next) => {
  if (!isAdminUser(c.get("user"))) {
    return c.json({ message: "Admin access is required." }, 403);
  }
  if (!c.env.ANALYTICS_STREAM || !c.env.SOUNDKIT_ANALYTICS_ENV) {
    return c.json({ message: "Analytics export is not configured." }, 503);
  }
  return await next();
});
app.get("/health", async (c) =>
  c.json(await analyticsOutboxHealth(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"))
);
app.get("/retention", async (c) =>
  c.json({
    cohorts: await analyticsRetention(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"),
    daily: await analyticsDailyActivity(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"),
  })
);
app.get("/failures", async (c) =>
  c.json({
    events: await analyticsFailures(c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"),
  })
);
app.get("/reconciliation", async (c) => {
  const createdAt = c.req.query("before_created_at"),
    id = c.req.query("before_id");
  if (
    (createdAt || id) &&
    (!createdAt ||
      !id ||
      !z.string().datetime({ precision: 6 }).safeParse(createdAt).success ||
      id.length > 256)
  ) {
    return c.json({ message: "Both valid cursor fields are required." }, 400);
  }
  return c.json(
    await reconcileAnalytics(
      c.env.SOUNDKIT_ANALYTICS_ENV ?? "test",
      undefined,
      createdAt && id ? { createdAt, id } : undefined
    )
  );
});
app.post("/replay/:id", async (c) => {
  const id = z.string().uuid().safeParse(c.req.param("id"));
  if (!id.success) {
    return c.json({ message: "Invalid event ID." }, 400);
  }
  const replayed = await replayAnalyticsEvent(
    id.data,
    c.env.SOUNDKIT_ANALYTICS_ENV ?? "test"
  );
  return c.json({ replayed });
});
// Self-service opt-out/erasure lives in the authenticated account route below;
// admin access to another account remains an explicitly privileged operation.
app.post("/erase/:userId", async (c) => {
  const id = z.string().min(1).max(256).safeParse(c.req.param("userId"));
  if (!id.success) {
    return c.json({ message: "Invalid account ID." }, 400);
  }
  await eraseAccountAnalytics(id.data);
  return c.json({ erased: true });
});
export default app;
