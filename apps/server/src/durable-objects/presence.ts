import { DurableObject } from "cloudflare:workers";

export interface UserPresence {
  lastSeen: number;
  status: "online" | "away" | "offline" | "typing";
}

export class PresenceDurableObject extends DurableObject {
  private users = new Map<string, UserPresence>();
  private initialized = false;

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }
    const saved =
      await this.ctx.storage.get<Record<string, UserPresence>>(
        "presence_users"
      );
    if (saved) {
      this.users = new Map(Object.entries(saved));
    }
    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);

    // WebSocket connection for real-time presence synchronization
    if (
      url.pathname === "/ws" ||
      request.headers.get("Upgrade") === "websocket"
    ) {
      const userId =
        url.searchParams.get("userId") || request.headers.get("x-user-id");
      if (!userId) {
        return new Response("Missing userId parameter", { status: 400 });
      }

      const pair = new WebSocketPair(),
       [client, server] = [pair[0], pair[1]];

      this.ctx.acceptWebSocket(server, [`user:${userId}`]);

      this.users.set(userId, {
        lastSeen: Date.now(),
        status: "online",
      });
      await this.persist();
      this.broadcastPresence();

      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) {
        await this.ctx.storage.setAlarm(Date.now() + 30_000);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP GET: list all online / active users
    if (
      request.method === "GET" &&
      (url.pathname === "/presence" ||
        url.pathname === "" ||
        url.pathname === "/")
    ) {
      const now = Date.now(),
       result: Record<string, UserPresence> = {};
      for (const [id, user] of this.users) {
        if (now - user.lastSeen < 60_000 && user.status !== "offline") {
          result[id] = user;
        }
      }
      return Response.json({
        count: Object.keys(result).length,
        users: result,
      });
    }

    // HTTP POST: heartbeat
    if (request.method === "POST" && url.pathname === "/heartbeat") {
      const body = (await request.json().catch(() => ({}))) as {
        status?: "away" | "offline" | "online" | "typing";
        userId?: string;
      };
      if (body.userId) {
        this.users.set(body.userId, {
          lastSeen: Date.now(),
          status: body.status || "online",
        });
        await this.persist();
        this.broadcastPresence();
        return Response.json({ success: true });
      }
      return Response.json({ error: "Missing userId" }, { status: 400 });
    }

    // HTTP POST: query online status for a specific list of user IDs
    if (request.method === "POST" && url.pathname === "/query") {
      const body = (await request.json().catch(() => ({}))) as {
        userIds?: string[];
      },
       now = Date.now(),
       requestedIds = body.userIds ?? [],
       result: Record<
        string,
        { isOnline: boolean; lastSeen: number; status: string }
      > = {};
      for (const id of requestedIds) {
        const user = this.users.get(id),
         isOnline = Boolean(
          user && now - user.lastSeen < 60_000 && user.status !== "offline"
        );
        result[id] = {
          isOnline,
          lastSeen: user?.lastSeen ?? 0,
          status: isOnline ? (user?.status ?? "online") : "offline",
        };
      }
      return Response.json({ users: result });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message !== "string") {
      return;
    }
    const userId = this.ctx
      .getTags(ws)
      .find((t) => t.startsWith("user:"))
      ?.slice(5);
    if (!userId) {
      return;
    }

    try {
      const data = JSON.parse(message) as {
        status?: "away" | "online" | "typing";
        type?: string;
      };
      if (data.type === "heartbeat") {
        const existing = this.users.get(userId) ?? {
          lastSeen: Date.now(),
          status: "online",
        };
        existing.lastSeen = Date.now();
        if (data.status) {
          existing.status = data.status;
        }
        this.users.set(userId, existing);
      } else if (data.type === "typing") {
        const existing = this.users.get(userId) ?? {
          lastSeen: Date.now(),
          status: "online",
        };
        existing.lastSeen = Date.now();
        existing.status = "typing";
        this.users.set(userId, existing);
        this.broadcastPresence();
      }
    } catch {
      // Ignore unparseable socket messages
    }
  }

  async webSocketClose(ws: WebSocket) {
    const userId = this.ctx
      .getTags(ws)
      .find((t) => t.startsWith("user:"))
      ?.slice(5);
    if (!userId) {
      return;
    }

    // Check if there are other active sockets for this user
    const otherSockets = this.ctx.getWebSockets(`user:${userId}`);
    if (otherSockets.length === 0) {
      const user = this.users.get(userId);
      if (user) {
        user.status = "offline";
        user.lastSeen = Date.now();
        this.broadcastPresence();
      }
    }
  }

  async alarm() {
    const now = Date.now();
    let changed = false;
    for (const [, user] of this.users) {
      if (now - user.lastSeen > 60_000 && user.status !== "offline") {
        user.status = "offline";
        changed = true;
      }
    }
    if (changed) {
      await this.persist();
      this.broadcastPresence();
    }

    // Reschedule alarm if any users remain active
    const hasActive = [...this.users.values()].some(
      (u) => u.status !== "offline"
    );
    if (hasActive) {
      await this.ctx.storage.setAlarm(Date.now() + 30_000);
    }
  }

  private async persist() {
    try {
      await this.ctx.storage.put(
        "presence_users",
        Object.fromEntries(this.users)
      );
    } catch {
      // Storage failure should not crash DO
    }
  }

  private broadcastPresence() {
    const now = Date.now(),
     activeUsers: Record<string, UserPresence> = {};
    for (const [id, user] of this.users) {
      if (now - user.lastSeen < 60_000 && user.status !== "offline") {
        activeUsers[id] = user;
      }
    }

    const payload = JSON.stringify({
      onlineUserIds: Object.keys(activeUsers),
      type: "presence",
      users: activeUsers,
    });

    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket error on send
      }
    }
  }
}
