import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  inMemoryPresence = new Map<string, { lastSeen: number; status: string }>(),
  presenceUserSchema = z.object({
    isOnline: z.boolean(),
    lastSeen: z.number(),
    status: z.string(),
  }),
  presenceResponseSchema = z.object({
    onlineUserIds: z.string().array(),
    users: z.record(z.string(), presenceUserSchema),
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        presenceResponseSchema,
        "List of currently active online users"
      ),
    },
    tags: ["Presence"],
  }),
  async (c) => {
    if (c.env?.PRESENCE) {
      const id = c.env?.PRESENCE.idFromName("global"),
        stub = c.env?.PRESENCE.get(id),
        response = await stub.fetch(new Request("https://internal/presence")),
       data = (await response.json()) as {
        users: Record<string, { lastSeen: number; status: string }>;
      },
       users: Record<
        string,
        { isOnline: boolean; lastSeen: number; status: string }
      > = {};
      for (const [uid, u] of Object.entries(data.users ?? {})) {
        users[uid] = {
          isOnline: true,
          lastSeen: u.lastSeen,
          status: u.status,
        };
      }
      return c.json(
        {
          onlineUserIds: Object.keys(users),
          users,
        },
        HttpStatusCodes.OK
      );
    }

    // In-memory fallback
    const now = Date.now(),
      users: Record<
        string,
        { isOnline: boolean; lastSeen: number; status: string }
      > = {};
    for (const [id, user] of inMemoryPresence) {
      if (now - user.lastSeen < 60_000 && user.status !== "offline") {
        users[id] = {
          isOnline: true,
          lastSeen: user.lastSeen,
          status: user.status,
        };
      }
    }

    return c.json(
      {
        onlineUserIds: Object.keys(users),
        users,
      },
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/query",
    request: {
      body: jsonContentRequired(
        z.object({
          userIds: z.string().array(),
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
    },
    tags: ["Presence"],
  }),
  async (c) => {
    const { userIds } = c.req.valid("json");

    if (c.env?.PRESENCE) {
      const id = c.env?.PRESENCE.idFromName("global"),
        stub = c.env?.PRESENCE.get(id),
        response = await stub.fetch(
          new Request("https://internal/query", {
            body: JSON.stringify({ userIds }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          })
        ),
       data = (await response.json()) as {
        users: Record<
          string,
          { isOnline: boolean; lastSeen: number; status: string }
        >;
      };
      return c.json({ users: data.users ?? {} }, HttpStatusCodes.OK);
    }

    // In-memory fallback
    const now = Date.now(),
      users: Record<
        string,
        { isOnline: boolean; lastSeen: number; status: string }
      > = {};
    for (const id of userIds) {
      const user = inMemoryPresence.get(id),
        isOnline = Boolean(
          user && now - user.lastSeen < 60_000 && user.status !== "offline"
        );
      users[id] = {
        isOnline,
        lastSeen: user?.lastSeen ?? 0,
        status: isOnline ? (user?.status ?? "online") : "offline",
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
        z.object({
          status: z.enum(["online", "away", "offline", "typing"]).optional(),
          userId: z.string().min(1),
        }),
        "Heartbeat payload"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ success: z.boolean() }),
        "Heartbeat acknowledgment"
      ),
    },
    tags: ["Presence"],
  }),
  async (c) => {
    const { status, userId } = c.req.valid("json");

    if (c.env?.PRESENCE) {
      const id = c.env?.PRESENCE.idFromName("global"),
        stub = c.env?.PRESENCE.get(id);
      await stub.fetch(
        new Request("https://internal/heartbeat", {
          body: JSON.stringify({ status, userId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      );
      return c.json({ success: true }, HttpStatusCodes.OK);
    }

    inMemoryPresence.set(userId, {
      lastSeen: Date.now(),
      status: status || "online",
    });

    return c.json({ success: true }, HttpStatusCodes.OK);
  }
);

// WebSocket upgrade route handler
app.get("/ws", async (c) => {
  const userId = c.req.query("userId");
  if (!userId) {
    return c.text("Missing userId query parameter", 400);
  }

  if (c.env?.PRESENCE) {
    const id = c.env?.PRESENCE.idFromName("global"),
      stub = c.env?.PRESENCE.get(id);
    return stub.fetch(c.req.raw);
  }

  // If running in local dev without DO, update in-memory presence and return standard response
  inMemoryPresence.set(userId, {
    lastSeen: Date.now(),
    status: "online",
  });
  return c.text("WebSocket presence requires Cloudflare DO or local mock", 426);
});

export default app;
