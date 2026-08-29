/* eslint-disable one-var, sort-vars, typescript/explicit-member-accessibility */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userPresence } from "@soundkit/db/schema/app";
import { DurableObject } from "cloudflare:workers";

import { recordRealtimeMetric } from "@/lib/realtime-metrics";

const ACTIVE_THRESHOLD_MS = 90_000,
  FLUSH_DELAY_MS = 30_000,
  OFFLINE_GRACE_MS = 15_000,
  PRESENCE_STATE_KEY = "presence_state",
  PRESENCE_USER_ID_KEY = "presence_user_id",
  presenceStatuses = ["online", "away", "offline"] as const;

type PresenceStatus = (typeof presenceStatuses)[number];

export interface UserPresence {
  lastSeen: number;
  status: PresenceStatus;
}

export interface PresenceSnapshot extends UserPresence {
  isOnline: boolean;
  userId: string;
}

interface PresenceSocketMessage {
  status?: PresenceStatus;
  type?: "heartbeat";
}

interface PresenceSocketAttachment {
  connectedAt: number;
  tabId: string;
  userId: string;
}

const isPresenceStatus = (value: unknown): value is PresenceStatus =>
  typeof value === "string" &&
  (presenceStatuses as readonly string[]).includes(value);

export class PresenceDurableObject extends DurableObject {
  private initialized = false;
  private offlineGraceUntil: number | null = null;
  private presence: UserPresence = {
    lastSeen: 0,
    status: "offline",
  };
  private userId: string | null = null;
  private dirty = false;
  private stateVersion = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const [savedPresence, savedUserId] = await Promise.all([
        ctx.storage.get<UserPresence>(PRESENCE_STATE_KEY),
        ctx.storage.get<string>(PRESENCE_USER_ID_KEY),
      ]);

      if (savedPresence && isPresenceStatus(savedPresence.status)) {
        this.presence = savedPresence;
      }
      this.userId = savedUserId ?? null;
      this.initialized = true;
    });
  }

  async heartbeat(
    userId: string,
    status: PresenceStatus = "online"
  ): Promise<PresenceSnapshot> {
    await this.ensureUser(userId);
    this.offlineGraceUntil = null;
    const changed = this.presence.status !== status;
    this.presence = {
      lastSeen: Date.now(),
      status,
    };
    this.stateVersion += 1;
    this.dirty = true;

    if (changed) {
      this.broadcastPresence();
      recordRealtimeMetric({
        dataset: this.env.DO_METRICS,
        event: "presence_transition",
        indexes: [status],
      });
    }

    await this.scheduleFlush();
    return this.snapshot();
  }

  async getStatus(userId: string): Promise<PresenceSnapshot> {
    await this.ensureUser(userId);
    return this.snapshot();
  }

  async fetch(request: Request): Promise<Response> {
    const requestedUserId = request.headers.get("x-soundkit-user-id");
    if (!requestedUserId) {
      return new Response("Missing authenticated user identity", {
        status: 401,
      });
    }

    await this.ensureUser(requestedUserId);
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return Response.json(
          { message: "Expected WebSocket upgrade." },
          { status: 426 }
        );
      }

      const pair = new WebSocketPair(),
        [client, server] = Object.values(pair) as [WebSocket, WebSocket],
        tabId = request.headers.get("x-soundkit-tab-id") ?? crypto.randomUUID(),
        attachment: PresenceSocketAttachment = {
          connectedAt: Date.now(),
          tabId,
          userId: requestedUserId,
        };

      this.ctx.acceptWebSocket(server, [
        `user:${requestedUserId}`,
        `tab:${tabId}`,
      ]);
      server.serializeAttachment(attachment);
      this.offlineGraceUntil = null;

      const changed = this.presence.status !== "online";
      this.presence = {
        lastSeen: Date.now(),
        status: "online",
      };
      this.stateVersion += 1;
      this.dirty = true;
      if (changed) {
        this.broadcastPresence();
        recordRealtimeMetric({
          dataset: this.env.DO_METRICS,
          event: "presence_ws_connect",
          indexes: [requestedUserId],
        });
      }
      await this.scheduleFlush();
      server.send(
        JSON.stringify({
          ...this.snapshot(),
          type: "presence",
        })
      );

      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/heartbeat") {
      const body = (await request.json().catch(() => ({}))) as {
          status?: unknown;
        },
        status = isPresenceStatus(body.status) ? body.status : "online";
      return Response.json(await this.heartbeat(requestedUserId, status));
    }

    if (request.method === "GET" && url.pathname === "/status") {
      return Response.json(await this.getStatus(requestedUserId));
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message !== "string") {
      return;
    }

    const attachment =
      ws.deserializeAttachment() as PresenceSocketAttachment | null;
    if (!attachment?.userId) {
      return;
    }

    try {
      const parsed = JSON.parse(message) as PresenceSocketMessage;
      if (parsed.type !== "heartbeat") {
        return;
      }

      const status = isPresenceStatus(parsed.status) ? parsed.status : "online",
        snapshot = await this.heartbeat(attachment.userId, status);
      ws.send(
        JSON.stringify({
          ...snapshot,
          type: "presence",
        })
      );
    } catch (error) {
      console.warn("Presence WebSocket message rejected", {
        error: error instanceof Error ? error.message : String(error),
        userId: attachment.userId,
      });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const attachment =
      ws.deserializeAttachment() as PresenceSocketAttachment | null;
    if (!attachment || this.ctx.getWebSockets().length > 0) {
      return;
    }

    this.offlineGraceUntil = Date.now() + OFFLINE_GRACE_MS;
    recordRealtimeMetric({
      dataset: this.env.DO_METRICS,
      event: "presence_ws_close",
      indexes: [attachment.userId],
    });
    await this.ctx.storage.setAlarm(this.offlineGraceUntil);
  }

  async alarm() {
    const now = Date.now(),
      hasSockets = this.ctx.getWebSockets().length > 0;

    if (
      !hasSockets &&
      this.presence.status !== "offline" &&
      ((this.offlineGraceUntil !== null && now >= this.offlineGraceUntil) ||
        now - this.presence.lastSeen >= ACTIVE_THRESHOLD_MS)
    ) {
      this.presence = {
        lastSeen: now,
        status: "offline",
      };
      this.offlineGraceUntil = null;
      this.stateVersion += 1;
      this.dirty = true;
      this.broadcastPresence();
    }

    if (this.dirty) {
      await this.flush();
    }

    if (this.dirty || (!hasSockets && this.presence.status !== "offline")) {
      await this.scheduleFlush();
    }
  }

  private async ensureUser(userId: string) {
    if (!this.initialized) {
      await Promise.resolve();
    }

    if (this.userId && this.userId !== userId) {
      throw new Error("Presence Durable Object identity mismatch");
    }

    if (!this.userId) {
      this.userId = userId;
      await this.ctx.storage.put(PRESENCE_USER_ID_KEY, userId);
    }
  }

  private snapshot(): PresenceSnapshot {
    const { userId } = this;
    if (!userId) {
      throw new Error("Presence Durable Object is not initialized");
    }

    return {
      ...this.presence,
      isOnline:
        this.presence.status !== "offline" &&
        Date.now() - this.presence.lastSeen < ACTIVE_THRESHOLD_MS,
      userId,
    };
  }

  private async scheduleFlush() {
    await this.ctx.storage.setAlarm(Date.now() + FLUSH_DELAY_MS);
  }

  private async flush() {
    const { userId } = this;
    if (!userId) {
      return;
    }

    const flushVersion = this.stateVersion,
      snapshot = { ...this.presence },
      updatedAt = new Date();

    // Persist locally before attempting external I/O so hibernation/crashes do
    // not lose the snapshot being flushed.
    await this.ctx.storage.put(PRESENCE_STATE_KEY, snapshot);

    if (!isDatabaseConfigured()) {
      if (this.stateVersion === flushVersion) {
        this.dirty = false;
      }
      return;
    }

    try {
      await createDb()
        .insert(userPresence)
        .values({
          lastSeen: new Date(snapshot.lastSeen),
          status: snapshot.status,
          updatedAt,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            lastSeen: new Date(snapshot.lastSeen),
            status: snapshot.status,
            updatedAt,
          },
          target: userPresence.userId,
        });
      if (this.stateVersion === flushVersion) {
        this.dirty = false;
      } else {
        this.dirty = true;
        await this.scheduleFlush();
      }
      recordRealtimeMetric({
        dataset: this.env.DO_METRICS,
        event: "presence_db_flush",
        indexes: [userId],
      });
    } catch (error) {
      console.error("Presence database flush failed", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }

  private broadcastPresence() {
    const payload = JSON.stringify({
      ...this.snapshot(),
      type: "presence",
    });

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch (error) {
        console.warn("Presence WebSocket broadcast failed", {
          error: error instanceof Error ? error.message : String(error),
          userId: this.userId,
        });
      }
    }
  }
}
