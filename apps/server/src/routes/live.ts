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

  const voteBody = await response.json();
  return Response.json(voteBody, {
    status: response.status,
  });
});

app.post("/cloudflare-stream", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: string };
  const title = body.title || "Live Stream";

  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
        {
          body: JSON.stringify({
            meta: { name: title },
            recording: { mode: "automatic" },
          }),
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const {result} = data;
        return c.json(
          {
            id: result.uid,
            playbackUrl: result.playback.hls,
            rtmpsKey: result.rtmps.streamKey,
            rtmpsUrl: result.rtmps.url,
            srtKey: result.srt.streamKey,
            srtUrl: result.srt.url,
            status: result.status || "idle",
            title,
          },
          HttpStatusCodes.CREATED
        );
      }
    } catch {
      // Fall back to mock
    }
  }

  const mockId = crypto.randomUUID().replaceAll(/-/g, "");
  return c.json(
    {
      id: mockId,
      playbackUrl: `https://customer-f33cbd.cloudflarestream.com/${mockId}/manifest/video.m3u8`,
      rtmpsKey: `cfs_${mockId}`,
      rtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
      srtKey: `cfs_srt_${mockId}`,
      srtUrl: "srt://live.cloudflare.com:443",
      status: "idle",
      title,
    },
    HttpStatusCodes.CREATED
  );
});

app.get("/cloudflare-stream/:streamId", async (c) => {
  const streamId = c.req.param("streamId");
  const accountId = c.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = c.env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${streamId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          method: "GET",
        }
      );

      if (response.ok) {
        const data = (await response.json()) as any;
        const {result} = data;
        return c.json(
          {
            id: result.uid,
            playbackUrl: result.playback.hls,
            rtmpsKey: result.rtmps.streamKey,
            rtmpsUrl: result.rtmps.url,
            srtKey: result.srt.streamKey,
            srtUrl: result.srt.url,
            status: result.status || "idle",
          },
          HttpStatusCodes.OK
        );
      }
    } catch {
      // Fall back to mock
    }
  }

  return c.json(
    {
      id: streamId,
      playbackUrl: `https://customer-f33cbd.cloudflarestream.com/${streamId}/manifest/video.m3u8`,
      rtmpsKey: `cfs_${streamId}`,
      rtmpsUrl: "rtmps://live.cloudflare.com:443/live/",
      srtKey: `cfs_srt_${streamId}`,
      srtUrl: "srt://live.cloudflare.com:443",
      status: "connected",
    },
    HttpStatusCodes.OK
  );
});

export default app;
