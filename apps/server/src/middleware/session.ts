import { createAuth } from "@soundkit/auth";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { user as authUser } from "@soundkit/db/schema/auth";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { isConfiguredAdminEmail } from "@/lib/admin";
import type { AppEnv } from "@/lib/types";

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
            id: session.user.id,
            name: session.user.name ?? null,
            role,
          }
        : null
    );
  } catch {
    c.set("session", null);
    c.set("user", null);
  }

  await next();
});
