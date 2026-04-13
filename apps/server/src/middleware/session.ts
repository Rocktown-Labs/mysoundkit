import { createAuth } from "@soundkit/auth";
import { createMiddleware } from "hono/factory";

import type { AppEnv } from "@/lib/types";

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  try {
    const auth = createAuth();
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    c.set("session", session?.session ?? null);
    c.set("user", session?.user ?? null);
  } catch {
    c.set("session", null);
    c.set("user", null);
  }

  await next();
});
