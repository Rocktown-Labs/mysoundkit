import { Hono } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { createSampleLiveRoom } from "@/lib/live-room-data";
import type { AppEnv } from "@/lib/types";

const app = new Hono<AppEnv>();

const durableRequest = (
  c: { env: AppEnv["Bindings"] },
  roomId: string,
  path: string,
  init?: RequestInit
) => {
  if (!c.env.LIVE_ROOMS) {
    return null;
  }

  const id = c.env.LIVE_ROOMS.idFromName(roomId);
  const stub = c.env.LIVE_ROOMS.get(id);
  const headers = new Headers(init?.headers);
  headers.set("x-soundkit-live-room-id", roomId);

  return stub.fetch(`https://live-room.soundkit.internal${path}`, {
    ...init,
    headers,
  });
};

app.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/state");

  if (!response) {
    return c.json(createSampleLiveRoom(roomId), HttpStatusCodes.OK);
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.OK);
});

app.get("/rooms/:roomId/ws", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/ws", {
    headers: c.req.raw.headers,
    method: "GET",
  });

  if (!response) {
    return c.json(
      { message: "Live room WebSocket binding is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return response;
});

app.post("/rooms/:roomId/chat", async (c) => {
  const roomId = c.req.param("roomId");
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    userName?: string;
  };
  const response = await durableRequest(c, roomId, "/chat", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    const room = createSampleLiveRoom(roomId);
    if (body.message?.trim()) {
      room.chat.push({
        id: crypto.randomUUID(),
        message: body.message.trim(),
        sentAt: new Date().toISOString(),
        userName: body.userName?.trim() || "Listener",
      });
    }

    return c.json(room, HttpStatusCodes.CREATED);
  }

  const room = await response.json();
  return c.json(room, HttpStatusCodes.CREATED);
});

app.post("/rooms/:roomId/vote", async (c) => {
  const roomId = c.req.param("roomId");
  const response = await durableRequest(c, roomId, "/vote", {
    body: JSON.stringify(await c.req.json().catch(() => ({}))),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response) {
    return c.json(
      { message: "Live room voting is not configured." },
      HttpStatusCodes.SERVICE_UNAVAILABLE
    );
  }

  const body = await response.json();
  return Response.json(body, {
    status: response.status,
  });
});

export default app;
