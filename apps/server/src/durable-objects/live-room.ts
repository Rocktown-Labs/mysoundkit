/* eslint-disable one-var, sort-vars, typescript/explicit-member-accessibility, require-await, prefer-destructuring, class-methods-use-this */
import { DurableObject } from "cloudflare:workers";

import type { LiveRoomChatMessage, LiveRoomState } from "@/lib/live-room-data";
import { createSampleLiveRoom } from "@/lib/live-room-data";
import { recordRealtimeMetric } from "@/lib/realtime-metrics";

export interface LiveRoomVoteBody {
  artistId?: string;
  roundId?: string;
}

interface LiveRoomChatBody {
  message?: string;
}

interface LiveRoomSocketMessage {
  payload?: LiveRoomChatBody | LiveRoomVoteBody;
  type?: "chat" | "vote";
}

export interface LiveRoomIdentity {
  displayName: string;
  userId: string;
}

interface LiveRoomSocketAttachment extends LiveRoomIdentity {
  connectedAt: number;
}

export interface LiveRoomChatResult {
  message: LiveRoomChatMessage | null;
  rateLimited?: boolean;
  room: LiveRoomState;
}

const CHAT_RATE_LIMIT = 5,
  CHAT_RATE_WINDOW_MS = 5000,
  CHAT_STORAGE_KEY = "live-room-chat",
  MAX_CHAT_MESSAGES = 80,
  MAX_CHAT_MESSAGE_LENGTH = 500,
  STATE_STORAGE_KEY = "live-room-state",
  voteVotersKey = (roundId: string) => `vote-voters:${roundId}`,
  jsonResponse = (body: unknown, status = 200) =>
    Response.json(body, {
      status,
    }),
  notFoundResponse = () => jsonResponse({ message: "Not found" }, 404),
  isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export class LiveRoomDurableObject extends DurableObject {
  private roomState: LiveRoomState | null = null;
  private requestedRoomId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrateSchema());
  }

  private migrateSchema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    const version = this.ctx.storage.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations"
      )
      .one().version;

    if (version < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS live_room_chat_rate_limits (
          user_id TEXT PRIMARY KEY,
          timestamps TEXT NOT NULL
        );
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.requestedRoomId = request.headers.get("x-soundkit-live-room-id");
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return jsonResponse(await this.loadState());
    }

    if (request.method === "POST" && url.pathname === "/seed") {
      const body = (await request
        .json()
        .catch(() => null)) as LiveRoomState | null;

      if (!body?.id) {
        return jsonResponse({ message: "Seed room state is invalid." }, 400);
      }

      const storedState =
          await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY),
        shouldReplaceStoredState =
          !storedState ||
          storedState.id !== body.id ||
          storedState.kind !== body.kind ||
          storedState.title !== body.title;

      if (shouldReplaceStoredState) {
        await this.persist(body);
        this.broadcast({ room: body, type: "state" });
        return jsonResponse(body, 201);
      }

      return jsonResponse(await this.loadState());
    }

    const identity = this.identityFromRequest(request);
    if (request.method === "POST" && url.pathname === "/chat") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomChatBody,
        result = await this.appendChatMessage(body, identity);
      return jsonResponse(result, result.rateLimited ? 429 : 201);
    }

    if (request.method === "POST" && url.pathname === "/vote") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomVoteBody,
        result = await this.applyVote(body, identity);

      return jsonResponse(result.body, result.status);
    }

    return notFoundResponse();
  }

  async webSocketMessage(socket: WebSocket, message: ArrayBuffer | string) {
    if (typeof message !== "string") {
      return;
    }

    const attachment =
      socket.deserializeAttachment() as LiveRoomSocketAttachment | null;
    if (!attachment) {
      return;
    }

    try {
      const parsed = JSON.parse(message) as LiveRoomSocketMessage;

      if (parsed.type === "chat") {
        await this.appendChatMessage(
          (parsed.payload ?? {}) as LiveRoomChatBody,
          attachment
        );
        return;
      }

      if (parsed.type === "vote") {
        await this.applyVote(
          (parsed.payload ?? {}) as LiveRoomVoteBody,
          attachment
        );
      }
    } catch (error) {
      console.warn("Live room WebSocket message rejected", {
        error: error instanceof Error ? error.message : String(error),
        roomId: this.requestedRoomId,
      });
    }
  }

  async webSocketClose(socket: WebSocket) {
    const attachment =
      socket.deserializeAttachment() as LiveRoomSocketAttachment | null;
    if (attachment) {
      recordRealtimeMetric({
        dataset: this.env.DO_METRICS,
        event: "live_room_ws_close",
        indexes: [attachment.userId],
      });
    }
    await this.broadcastPresence();
  }

  async getState(roomId: string): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    return this.loadState();
  }

  async seed(
    roomId: string,
    body: LiveRoomState
  ): Promise<{ replaced: boolean; room: LiveRoomState }> {
    this.requestedRoomId = roomId;
    const storedState =
        await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY),
      shouldReplaceStoredState =
        !storedState ||
        storedState.id !== body.id ||
        storedState.kind !== body.kind ||
        storedState.title !== body.title;

    if (!shouldReplaceStoredState) {
      return { replaced: false, room: await this.loadState() };
    }

    await this.persist(body);
    this.broadcast({ room: body, type: "state" });
    return { replaced: true, room: body };
  }

  async chat(
    roomId: string,
    body: LiveRoomChatBody,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomChatResult> {
    this.requestedRoomId = roomId;
    return this.appendChatMessage(body, identity);
  }

  async vote(
    roomId: string,
    body: LiveRoomVoteBody,
    identity: LiveRoomIdentity
  ) {
    this.requestedRoomId = roomId;
    return this.applyVote(body, identity);
  }

  private async loadState(): Promise<LiveRoomState> {
    if (this.roomState) {
      return this.roomState;
    }

    const storedState =
      await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY);

    if (storedState) {
      const storedChat =
        await this.ctx.storage.get<LiveRoomChatMessage[]>(CHAT_STORAGE_KEY);
      const room = {
        ...storedState,
        chat: (storedChat ?? storedState.chat ?? []).slice(-MAX_CHAT_MESSAGES),
      };
      if (!storedChat && storedState.chat.length > 0) {
        await this.ctx.storage.put(CHAT_STORAGE_KEY, room.chat);
      }
      this.roomState = room;
      return room;
    }

    const room = createSampleLiveRoom(
      this.requestedRoomId ?? this.ctx.id.toString()
    );
    await this.persist(room);
    return room;
  }

  private async persist(room: LiveRoomState) {
    await Promise.all([
      this.ctx.storage.put(STATE_STORAGE_KEY, { ...room, chat: [] }),
      this.ctx.storage.put(
        CHAT_STORAGE_KEY,
        room.chat.slice(-MAX_CHAT_MESSAGES)
      ),
    ]);
    this.roomState = room;
  }

  private async persistChat(chat: LiveRoomChatMessage[]) {
    await this.ctx.storage.put(
      CHAT_STORAGE_KEY,
      chat.slice(-MAX_CHAT_MESSAGES)
    );
  }

  private async appendChatMessage(
    body: LiveRoomChatBody,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomChatResult> {
    const room = await this.loadState(),
      message = body.message?.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);

    if (!message) {
      return { message: null, room };
    }

    if (!this.consumeChatRate(identity.userId)) {
      recordRealtimeMetric({
        dataset: this.env.DO_METRICS,
        event: "live_room_rate_limited",
        indexes: [identity.userId],
      });
      return { message: null, rateLimited: true, room };
    }

    const chatMessage: LiveRoomChatMessage = {
        id: crypto.randomUUID(),
        message,
        sentAt: new Date().toISOString(),
        userName: identity.displayName,
      },
      nextChat = [...room.chat, chatMessage].slice(-MAX_CHAT_MESSAGES),
      nextRoom = {
        ...room,
        chat: nextChat,
      };

    await this.persistChat(nextChat);
    this.roomState = nextRoom;
    this.broadcast({ message: chatMessage, type: "chat" });
    recordRealtimeMetric({
      dataset: this.env.DO_METRICS,
      doubles: [this.ctx.getWebSockets().length],
      event: "live_room_chat",
      indexes: [identity.userId],
    });
    return { message: chatMessage, room: nextRoom };
  }

  private async applyVote(body: LiveRoomVoteBody, identity: LiveRoomIdentity) {
    const room = await this.loadState();

    if (room.kind !== "battle" || !room.battle) {
      return {
        body: { message: "Voting is only available in battle rooms." },
        status: 400,
      };
    }

    const round = room.battle.rounds.find((entry) => entry.id === body.roundId);

    if (!round) {
      return { body: { message: "Round not found." }, status: 404 };
    }

    if (round.status !== "voting") {
      return {
        body: { message: "Voting is not open for this round." },
        status: 409,
      };
    }

    const artist = room.battle.artists.find(
      (entry) => entry.id === body.artistId
    );

    if (!artist) {
      return { body: { message: "Artist not found." }, status: 404 };
    }

    const votersKey = voteVotersKey(round.id),
      voters = await this.ctx.storage.get<string[]>(votersKey),
      voterId = identity.userId;

    if (voters?.includes(voterId)) {
      return {
        body: { message: "This participant has already voted this round." },
        status: 409,
      };
    }

    await this.ctx.storage.put(votersKey, [...(voters ?? []), voterId]);

    const nextRounds = room.battle.rounds.map((entry) => {
        if (entry.id !== round.id) {
          return entry;
        }

        const currentVotes = entry.voteTotals[artist.id] ?? 0;

        return {
          ...entry,
          voteTotals: {
            ...entry.voteTotals,
            [artist.id]: currentVotes + 1,
          },
        };
      }),
      nextRoom = {
        ...room,
        battle: {
          ...room.battle,
          rounds: nextRounds,
        },
      };

    await this.persist(nextRoom);
    this.broadcast({ room: nextRoom, type: "state" });

    return { body: nextRoom, status: 200 };
  }

  private handleWebSocket(request: Request) {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return jsonResponse({ message: "Expected WebSocket upgrade." }, 426);
    }

    const pair = new WebSocketPair(),
      [client, server] = Object.values(pair) as [WebSocket, WebSocket],
      identity = this.identityFromRequest(request),
      attachment: LiveRoomSocketAttachment = {
        ...identity,
        connectedAt: Date.now(),
      };

    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, [
      `room:${this.requestedRoomId ?? this.ctx.id.toString()}`,
      `user:${identity.userId}`,
    ]);
    recordRealtimeMetric({
      dataset: this.env.DO_METRICS,
      event: "live_room_ws_connect",
      indexes: [identity.userId],
    });
    this.ctx.waitUntil(
      (async () => {
        try {
          await this.sendInitialState(server);
        } catch (error) {
          console.error("Live room initial state delivery failed", {
            error: error instanceof Error ? error.message : String(error),
            roomId: this.requestedRoomId,
          });
          server.close(1011, "Unable to initialize live room.");
        }
      })()
    );

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async sendInitialState(socket: WebSocket) {
    const room = await this.loadState();
    socket.send(JSON.stringify({ room, type: "state" }));
    await this.broadcastPresence();
  }

  private async broadcastPresence() {
    const room = await this.loadState();
    this.broadcast({
      count: this.ctx.getWebSockets().length,
      roomId: room.id,
      type: "presence",
    });
  }

  private broadcast(payload: unknown) {
    const message = JSON.stringify(payload),
      sockets = this.ctx.getWebSockets();
    recordRealtimeMetric({
      dataset: this.env.DO_METRICS,
      doubles: [sockets.length],
      event: "live_room_broadcast_fanout",
      indexes: [this.requestedRoomId ?? this.ctx.id.toString()],
    });

    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch (error) {
        console.warn("Live room broadcast failed", {
          error: error instanceof Error ? error.message : String(error),
          roomId: this.requestedRoomId,
        });
        socket.close(1011, "Unable to deliver room update.");
      }
    }
  }

  private consumeChatRate(userId: string) {
    const row = this.ctx.storage.sql
      .exec<{ timestamps: string }>(
        "SELECT timestamps FROM live_room_chat_rate_limits WHERE user_id = ?",
        userId
      )
      .toArray()[0];
    let timestamps: number[] = [];

    try {
      timestamps = row ? (JSON.parse(row.timestamps) as number[]) : [];
    } catch {
      timestamps = [];
    }

    const now = Date.now(),
      recentTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < CHAT_RATE_WINDOW_MS
      );

    if (recentTimestamps.length >= CHAT_RATE_LIMIT) {
      return false;
    }

    recentTimestamps.push(now);
    this.ctx.storage.sql.exec(
      `INSERT INTO live_room_chat_rate_limits (user_id, timestamps)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET timestamps = excluded.timestamps`,
      userId,
      JSON.stringify(recentTimestamps)
    );
    return true;
  }

  private identityFromRequest(request: Request): LiveRoomIdentity {
    return {
      displayName:
        request.headers.get("x-soundkit-live-display-name") ?? "Listener",
      userId: request.headers.get("x-soundkit-live-user-id") ?? "anonymous",
    };
  }
}

export const isLiveRoomSocketMessage = (
  value: unknown
): value is LiveRoomSocketMessage =>
  isRecord(value) && typeof value.type === "string";
