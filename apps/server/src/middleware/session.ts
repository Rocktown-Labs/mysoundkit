import { createAuth } from "@soundkit/auth";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "@/lib/types";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  try {
    const auth = createAuth();
    const session = await auth.api.getSession({
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
    c.set(
      "user",
      session?.user
        ? {
            email: session.user.email ?? null,
            id: session.user.id,
            name: session.user.name ?? null,
          }
        : null
    );
  } catch {
    c.set("session", null);
    c.set("user", null);
  }

  await next();
});
