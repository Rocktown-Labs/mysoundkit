import { DurableObject } from "cloudflare:workers";

import type { LiveRoomChatMessage, LiveRoomState } from "@/lib/live-room-data";
import { createSampleLiveRoom } from "@/lib/live-room-data";

interface LiveRoomVoteBody {
  artistId?: string;
  roundId?: string;
  voterId?: string;
}

interface LiveRoomChatBody {
  message?: string;
  userName?: string;
}

interface LiveRoomSocketMessage {
  payload?: LiveRoomChatBody | LiveRoomVoteBody;
  type?: "chat" | "vote";
}

const STATE_STORAGE_KEY = "live-room-state";
const MAX_CHAT_MESSAGES = 80;
const voteVotersKey = (roundId: string) => `vote-voters:${roundId}`;

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
  });

const notFoundResponse = () => jsonResponse({ message: "Not found" }, 404);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class LiveRoomDurableObject extends DurableObject {
  private roomState: LiveRoomState | null = null;
  private requestedRoomId: string | null = null;

  async fetch(request: Request): Promise<Response> {
    this.requestedRoomId = request.headers.get("x-soundkit-live-room-id");
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return jsonResponse(await this.getState());
    }

    if (request.method === "POST" && url.pathname === "/seed") {
      const body = (await request
        .json()
        .catch(() => null)) as LiveRoomState | null;

      if (!body?.id) {
        return jsonResponse({ message: "Seed room state is invalid." }, 400);
      }

      const storedState =
        await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY);
      const shouldReplaceStoredState =
        !storedState ||
        storedState.id !== body.id ||
        storedState.kind !== body.kind ||
        storedState.title !== body.title;

      if (shouldReplaceStoredState) {
        await this.persist(body);
        this.broadcast({ room: body, type: "state" });
        return jsonResponse(body, 201);
      }

      return jsonResponse(storedState);
    }

    if (request.method === "POST" && url.pathname === "/chat") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomChatBody;
      const room = await this.addChatMessage(body);
      return jsonResponse(room, 201);
    }

    if (request.method === "POST" && url.pathname === "/vote") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomVoteBody;
      const result = await this.recordVote(body);

      return jsonResponse(result.body, result.status);
    }

    return notFoundResponse();
  }

  async webSocketMessage(_socket: WebSocket, message: ArrayBuffer | string) {
    if (typeof message !== "string") {
      return;
    }

    const parsed = JSON.parse(message) as LiveRoomSocketMessage;

    if (parsed.type === "chat") {
      await this.addChatMessage(parsed.payload as LiveRoomChatBody);
      return;
    }

    if (parsed.type === "vote") {
      await this.recordVote(parsed.payload as LiveRoomVoteBody);
    }
  }

  async webSocketClose() {
    await this.broadcastPresence();
  }

  private async getState() {
    if (this.roomState) {
      return this.roomState;
    }

    const storedState =
      await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY);

    if (storedState) {
      this.roomState = storedState;
      return storedState;
    }

    const room = createSampleLiveRoom(
      this.requestedRoomId ?? this.ctx.id.toString()
    );
    this.roomState = room;
    await this.persist(room);
    return room;
  }

  private async persist(room: LiveRoomState) {
    this.roomState = room;
    await this.ctx.storage.put(STATE_STORAGE_KEY, room);
  }

  private async addChatMessage(body: LiveRoomChatBody) {
    const room = await this.getState();
    const message = body.message?.trim();

    if (!message) {
      return room;
    }

    const chatMessage: LiveRoomChatMessage = {
      id: crypto.randomUUID(),
      message,
      sentAt: new Date().toISOString(),
      userName: body.userName?.trim() || "Listener",
    };

    const nextRoom = {
      ...room,
      chat: [...room.chat, chatMessage].slice(-MAX_CHAT_MESSAGES),
    };

    await this.persist(nextRoom);
    this.broadcast({ room: nextRoom, type: "state" });
    return nextRoom;
  }

  private async recordVote(body: LiveRoomVoteBody) {
    const room = await this.getState();

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

    if (!body.voterId) {
      return {
        body: { message: "A voter is required to record a vote." },
        status: 400,
      };
    }

    const votersKey = voteVotersKey(round.id);
    const voters = await this.ctx.storage.get<string[]>(votersKey);

    if (voters?.includes(body.voterId)) {
      return {
        body: { message: "This participant has already voted this round." },
        status: 409,
      };
    }

    await this.ctx.storage.put(votersKey, [...(voters ?? []), body.voterId]);

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
    });

    const nextRoom = {
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
    if (request.headers.get("upgrade") !== "websocket") {
      return jsonResponse({ message: "Expected WebSocket upgrade." }, 426);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.serializeAttachment({ connectedAt: Date.now() });
    this.ctx.acceptWebSocket(server);
    void this.sendInitialState(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async sendInitialState(socket: WebSocket) {
    const room = await this.getState();
    socket.send(JSON.stringify({ room, type: "state" }));
    await this.broadcastPresence();
  }

  private async broadcastPresence() {
    const room = await this.getState();
    this.broadcast({
      count: this.ctx.getWebSockets().length,
      roomId: room.id,
      type: "presence",
    });
  }

  private broadcast(payload: unknown) {
    const message = JSON.stringify(payload);

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        socket.close(1011, "Unable to deliver room update.");
      }
    }
  }
}

export const isLiveRoomSocketMessage = (
  value: unknown
): value is LiveRoomSocketMessage =>
  isRecord(value) && typeof value.type === "string";
