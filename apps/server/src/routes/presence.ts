/* eslint-disable one-var, sort-vars, complexity, require-await, unicorn/max-nested-calls */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userPresence } from "@soundkit/db/schema/app";
import { and, count, gte, inArray, ne } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { retryDurableObjectCall } from "@/lib/durable-object-retry";
import { isAuthenticatedUser } from "@/lib/entitlements";
import type { AppEnv } from "@/lib/types";

const ACTIVE_THRESHOLD_MS = 90_000,
  MAX_QUERY_IDS = 100,
  app = new OpenAPIHono<AppEnv>(),
  inMemoryPresence = new Map<string, { lastSeen: number; status: string }>(),
  presenceUserSchema = z.object({
    isOnline: z.boolean(),
    lastSeen: z.number(),
    status: z.string(),
  }),
  statusSchema = z.enum(["online", "away", "offline"]),
  unauthorizedResponse = z.object({ message: z.string() }),
  presenceSummarySchema = z.object({ onlineCount: z.number() });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        presenceSummarySchema,
        "Count of currently active users"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        unauthorizedResponse,
        "Authentication required"
      ),
    },
    tags: ["Presence"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(
        { message: "Authentication required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    if (isDatabaseConfigured()) {
      const [result] = await createDb()
        .select({ onlineCount: count() })
        .from(userPresence)
        .where(
          and(
            gte(
              userPresence.lastSeen,
              new Date(Date.now() - ACTIVE_THRESHOLD_MS)
            ),
            ne(userPresence.status, "offline")
          )
        );

      return c.json(
        { onlineCount: Number(result?.onlineCount ?? 0) },
        HttpStatusCodes.OK
      );
    }

    const now = Date.now(),
      onlineCount = [...inMemoryPresence.values()].filter(
        (presence) =>
          presence.status !== "offline" &&
          now - presence.lastSeen < ACTIVE_THRESHOLD_MS
      ).length;

    return c.json({ onlineCount }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/query",
    request: {
      body: jsonContentRequired(
        z.object({
          userIds: z.string().min(1).array().max(MAX_QUERY_IDS),
        }),
        "User IDs to query"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          users: z.record(z.string(), presenceUserSchema),
        }),
        "Presence map for requested user IDs"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        unauthorizedResponse,
        "Authentication required"
      ),
    },
    tags: ["Presence"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(
        { message: "Authentication required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const { userIds } = c.req.valid("json"),
      requestedIds = [...new Set(userIds)],
      now = Date.now(),
      users: Record<
        string,
        { isOnline: boolean; lastSeen: number; status: string }
      > = {};

    if (isDatabaseConfigured() && requestedIds.length > 0) {
      const rows = await createDb()
          .select({
            lastSeen: userPresence.lastSeen,
            status: userPresence.status,
            userId: userPresence.userId,
          })
          .from(userPresence)
          .where(inArray(userPresence.userId, requestedIds)),
        rowsByUserId = new Map(rows.map((row) => [row.userId, row]));

      for (const id of requestedIds) {
        const row = rowsByUserId.get(id),
          lastSeen = row?.lastSeen?.getTime() ?? 0,
          isOnline = Boolean(
            row &&
            row.status !== "offline" &&
            now - lastSeen < ACTIVE_THRESHOLD_MS
          );
        users[id] = {
          isOnline,
          lastSeen,
          status: isOnline ? (row?.status ?? "online") : "offline",
        };
      }

      return c.json({ users }, HttpStatusCodes.OK);
    }

    for (const id of requestedIds) {
      const presence = inMemoryPresence.get(id),
        isOnline = Boolean(
          presence &&
          presence.status !== "offline" &&
          now - presence.lastSeen < ACTIVE_THRESHOLD_MS
        );
      users[id] = {
        isOnline,
        lastSeen: presence?.lastSeen ?? 0,
        status: isOnline ? (presence?.status ?? "online") : "offline",
      };
    }

    return c.json({ users }, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/heartbeat",
    request: {
      body: jsonContentRequired(
        z.object({ status: statusSchema.optional() }),
        "Heartbeat payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ success: z.boolean() }),
        "Heartbeat acknowledgment"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        unauthorizedResponse,
        "Authentication required"
      ),
    },
    tags: ["Presence"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(
        { message: "Authentication required." },
        HttpStatusCodes.UNAUTHORIZED
      );
    }

    const { status = "online" } = c.req.valid("json");
    const presence = c.env.PRESENCE;
    if (presence) {
      await retryDurableObjectCall(() =>
        presence.getByName(user.id).heartbeat(user.id, status)
      );
    } else {
      inMemoryPresence.set(user.id, {
        lastSeen: Date.now(),
        status,
      });
    }

    return c.json({ success: true }, HttpStatusCodes.OK);
  }
);

app.get("/ws", async (c) => {
  if (
    c.req.method !== "GET" ||
    c.req.header("upgrade")?.toLowerCase() !== "websocket"
  ) {
    return c.text("Expected WebSocket upgrade", 426);
  }

  const user = c.get("user");
  if (!isAuthenticatedUser(user)) {
    return c.text("Authentication required", HttpStatusCodes.UNAUTHORIZED);
  }

  if (c.env.PRESENCE) {
    const tabId = c.req.query("tabId"),
      headers = new Headers(c.req.raw.headers);
    headers.set("x-soundkit-user-id", user.id);
    if (tabId) {
      headers.set("x-soundkit-tab-id", tabId);
    }

    const durableObjectUrl = new URL(c.req.raw.url);
    durableObjectUrl.pathname = "/ws";

    return c.env.PRESENCE.getByName(user.id).fetch(
      new Request(durableObjectUrl, {
        headers,
        method: "GET",
      })
    );
  }

  inMemoryPresence.set(user.id, {
    lastSeen: Date.now(),
    status: "online",
  });
  return c.text("WebSocket presence requires Cloudflare DO or local mock", 426);
});

export default app;
