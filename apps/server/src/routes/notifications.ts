/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb } from "@soundkit/db";
import { userNotifications } from "@soundkit/db/schema/app";
import { and, count, desc, eq, lt, or } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { isAuthenticatedUser } from "@/lib/entitlements";
import type { AppEnv } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 20,
  MAX_PAGE_SIZE = 50,
  notificationSchema = z.object({
    createdAt: z.string(),
    id: z.string(),
    link: z.string().nullable(),
    message: z.string(),
    read: z.boolean(),
    title: z.string(),
    type: z.string(),
  }),
  notificationsQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .default(DEFAULT_PAGE_SIZE),
  }),
  notificationsResponseSchema = z.object({
    items: z.array(notificationSchema),
    nextCursor: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(),
  }),
  notificationIdParamSchema = z.object({ notificationId: z.string().min(1) }),
  app = new OpenAPIHono<AppEnv>();

interface NotificationCursor {
  createdAt: Date;
  id: string;
}
type NotificationItem = z.infer<typeof notificationSchema>;

const encodeCursor = ({ createdAt, id }: NotificationCursor): string =>
    btoa(JSON.stringify([createdAt.toISOString(), id]))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, ""),
  decodeCursor = (cursor?: string): NotificationCursor | null => {
    if (!cursor) {
      return null;
    }

    try {
      const normalized = cursor.replaceAll("-", "+").replaceAll("_", "/"),
        padded = normalized.padEnd(
          normalized.length + ((4 - (normalized.length % 4)) % 4),
          "="
        ),
        [createdAtValue, id] = JSON.parse(atob(padded)) as unknown[];

      if (typeof createdAtValue !== "string" || typeof id !== "string") {
        return null;
      }

      const createdAt = new Date(createdAtValue);
      return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
    } catch {
      return null;
    }
  },
  mapNotification = (
    row: typeof userNotifications.$inferSelect
  ): NotificationItem => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    link: row.link ?? null,
    message: row.message,
    read: row.read,
    title: row.title,
    type: row.type,
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    request: { query: notificationsQuerySchema },
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
      return c.json(
        { items: [], nextCursor: null, unreadCount: 0 },
        HttpStatusCodes.OK
      );
    }

    try {
      const { cursor: encodedCursor, limit } = c.req.valid("query"),
        cursor = decodeCursor(encodedCursor),
        db = createDb(),
        cursorCondition = cursor
          ? or(
              lt(userNotifications.createdAt, cursor.createdAt),
              and(
                eq(userNotifications.createdAt, cursor.createdAt),
                lt(userNotifications.id, cursor.id)
              )
            )
          : undefined,
        [rows, [unread]] = await Promise.all([
          db
            .select()
            .from(userNotifications)
            .where(and(eq(userNotifications.userId, user.id), cursorCondition))
            .orderBy(
              desc(userNotifications.createdAt),
              desc(userNotifications.id)
            )
            .limit(limit + 1),
          db
            .select({ count: count() })
            .from(userNotifications)
            .where(
              and(
                eq(userNotifications.userId, user.id),
                eq(userNotifications.read, false)
              )
            ),
        ]),
        hasNextPage = rows.length > limit,
        pageRows = hasNextPage ? rows.slice(0, limit) : rows,
        lastRow = pageRows.at(-1),
        nextCursor =
          hasNextPage && lastRow
            ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
            : null;

      return c.json(
        {
          items: pageRows.map(mapNotification),
          nextCursor,
          unreadCount: Number(unread?.count ?? 0),
        },
        HttpStatusCodes.OK
      );
    } catch {
      return c.json(
        { items: [], nextCursor: null, unreadCount: 0 },
        HttpStatusCodes.OK
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{notificationId}/read",
    request: { params: notificationIdParamSchema },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ success: z.boolean() }),
        "Notification marked read"
      ),
    },
    tags: ["Notifications"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json({ success: true }, HttpStatusCodes.OK);
    }

    const { notificationId } = c.req.valid("param");
    await createDb()
      .update(userNotifications)
      .set({ read: true })
      .where(
        and(
          eq(userNotifications.id, notificationId),
          eq(userNotifications.userId, user.id)
        )
      );

    return c.json({ success: true }, HttpStatusCodes.OK);
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

    await createDb()
      .update(userNotifications)
      .set({ read: true })
      .where(
        and(
          eq(userNotifications.userId, user.id),
          eq(userNotifications.read, false)
        )
      );

    return c.json({ success: true }, HttpStatusCodes.OK);
  }
);

export default app;
