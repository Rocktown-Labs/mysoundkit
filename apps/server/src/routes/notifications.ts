import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb } from "@soundkit/db";
import { userNotifications } from "@soundkit/db/schema/app";
import { eq, desc } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAuthenticatedUser } from "@/lib/entitlements";
import type { AppEnv } from "@/lib/types";

const notificationSchema = z.object({
    createdAt: z.string(),
    id: z.string(),
    link: z.string().nullable(),
    message: z.string(),
    read: z.boolean(),
    title: z.string(),
    type: z.string(),
  }),
  notificationsResponseSchema = z.object({
    items: z.array(notificationSchema),
    unreadCount: z.number(),
  });

type NotificationItem = z.infer<typeof notificationSchema>;

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        notificationsResponseSchema,
        "User notifications"
      ),
    },
    tags: ["Notifications"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      const items: NotificationItem[] = [
        {
          createdAt: new Date().toISOString(),
          id: "notif_welcome",
          link: "/dashboard",
          message: "Welcome to SoundKit! Follow artists to get release alerts.",
          read: false,
          title: "Welcome to SoundKit",
          type: "welcome",
        },
      ];
      return c.json({ items, unreadCount: 1 }, HttpStatusCodes.OK);
    }

    try {
      const db = createDb(),
        rows = await db
          .select()
          .from(userNotifications)
          .where(eq(userNotifications.userId, user.id))
          .orderBy(desc(userNotifications.createdAt))
          .limit(20),
        items: NotificationItem[] = rows.map((r) => ({
          createdAt: r.createdAt.toISOString(),
          id: r.id,
          link: r.link ?? null,
          message: r.message,
          read: r.read,
          title: r.title,
          type: r.type,
        })),
        unreadCount = items.filter((i) => !i.read).length;

      return c.json({ items, unreadCount }, HttpStatusCodes.OK);
    } catch {
      const items: NotificationItem[] = [
        {
          createdAt: new Date().toISOString(),
          id: "notif_welcome",
          link: "/dashboard",
          message: "Welcome to SoundKit! Release updates will appear here.",
          read: false,
          title: "SoundKit Activity Feed",
          type: "welcome",
        },
      ];
      return c.json({ items, unreadCount: 1 }, HttpStatusCodes.OK);
    }
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/read-all",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ success: z.boolean() }),
        "All notifications marked read"
      ),
    },
    tags: ["Notifications"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json({ success: true }, HttpStatusCodes.OK);
    }

    try {
      const db = createDb();
      await db
        .update(userNotifications)
        .set({ read: true })
        .where(eq(userNotifications.userId, user.id));
    } catch {
      // Best effort
    }

    return c.json({ success: true }, HttpStatusCodes.OK);
  }
);

export default app;
