import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { user as authUser } from "@soundkit/db/schema/auth";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { isConfiguredAdminEmail } from "@/lib/admin";
import { recordAccountActivity } from "@/lib/analytics-outbox";
import type { AppEnv } from "@/lib/types";
import { logWarn, logError } from "@/middleware/structured-logging";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  try {
    const auth = createAuth(),
      session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

    c.set(
      "session",
      session?.session
        ? {
            activeOrganizationId: session.session.activeOrganizationId ?? null,
            id: session.session.id,
            userId: session.session.userId,
          }
        : null
    );
    let role = session?.user?.role ?? null;

    if (
      session?.user &&
      session.user.emailVerified &&
      isConfiguredAdminEmail(session.user.email) &&
      !role?.split(",").includes("admin") &&
      isDatabaseConfigured()
    ) {
      role = "admin";
      await createDb()
        .update(authUser)
        .set({ role })
        .where(eq(authUser.id, session.user.id));
    }

    c.set(
      "user",
      session?.user
        ? {
            banned: session.user.banned ?? false,
            email: session.user.email ?? null,
            emailVerified: session.user.emailVerified === true,
            id: session.user.id,
            name: session.user.name ?? null,
            role,
          }
        : null
    );
    if (c.get("user")?.banned) {
      return c.json(
        { message: "Account suspended." },
        HttpStatusCodes.FORBIDDEN
      );
    }
  } catch (error) {
    logError({
      error: error instanceof Error ? error.message : String(error),
      event: "session_middleware_error",
    });
    c.set("session", null);
    c.set("user", null);
  }

  await next();
  const userId = c.get("user")?.id;
  if (
    userId &&
    isDatabaseConfigured() &&
    c.res.status < 400 &&
    c.req.path.startsWith("/v1/") &&
    !["HEAD", "OPTIONS"].includes(c.req.method) &&
    c.env.ANALYTICS_STREAM &&
    c.env.SOUNDKIT_ANALYTICS_ENV
  ) {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          let cache: Cache | undefined;
          if ("caches" in globalThis) {
            try {
              cache = await caches.open("soundkit-internal-activity-v1");
            } catch {
              logWarn({
                event: "analytics_activity_cache_failed",
                phase: "open",
              });
            }
          }
          await recordAccountActivity(userId, {
            cache,
            environment: c.env.SOUNDKIT_ANALYTICS_ENV ?? "test",
            origin: new URL(c.req.url).origin,
          });
        } catch {
          logWarn({ event: "analytics_activity_record_failed" });
        }
      })()
    );
  }
});
