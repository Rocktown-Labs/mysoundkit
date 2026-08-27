/* eslint-disable one-var, sort-vars, typescript/explicit-member-accessibility, require-await, prefer-destructuring, class-methods-use-this */
import { DurableObject } from "cloudflare:workers";

import {
  advanceBattleToNow,
  createBattleCoordination,
  isVotingPhase,
  PRODUCTION_BATTLE_DURATIONS,
} from "@/lib/live-battle-state";
import type { BattleCoordination } from "@/lib/live-battle-state";
import type {
  LiveRoomChatMessage,
  LiveRoomState,
  LiveRoomViewerRole,
} from "@/lib/live-room-data";
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
  role?: LiveRoomViewerRole;
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
    Response.json(body, { status }),
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

  private battleAdmissionBatchSize(): number | undefined {
    const raw = (this.env as { BATTLE_ADMISSION_BATCH_SIZE?: string })
      .BATTLE_ADMISSION_BATCH_SIZE;

    if (!raw) {
      return undefined;
    }

    const parsed = Number.parseInt(raw, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  async fetch(request: Request): Promise<Response> {
    this.requestedRoomId = request.headers.get("x-soundkit-live-room-id");
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return jsonResponse(this.publicState(await this.loadState()));
    }

    if (request.method === "POST" && url.pathname === "/seed") {
      const body = (await request
        .json()
        .catch(() => null)) as LiveRoomState | null;
      if (!body?.id) {
        return jsonResponse({ message: "Seed room state is invalid." }, 400);
      }

      const room = this.normalizeState(body),
        storedState =
          await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY),
        shouldReplaceStoredState =
          !storedState ||
          storedState.id !== room.id ||
          storedState.kind !== room.kind ||
          storedState.title !== room.title;

      if (shouldReplaceStoredState) {
        await this.persist(room);
        this.broadcast({ room: this.publicState(room), type: "state" });
        return jsonResponse(this.publicState(room), 201);
      }

      return jsonResponse(this.publicState(await this.loadState()));
    }

    const identity = this.identityFromRequest(request);
    if (request.method === "POST" && url.pathname === "/chat") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomChatBody,
        result = await this.appendChatMessage(body, identity);
      return jsonResponse(
        this.publicChatResult(result, identity),
        result.rateLimited ? 429 : 201
      );
    }

    if (request.method === "POST" && url.pathname === "/vote") {
      const body = (await request.json().catch(() => ({}))) as LiveRoomVoteBody,
        result = await this.applyVote(body, identity);
      return jsonResponse(
        result.body && "room" in result.body && result.body.room
          ? this.publicState(result.body.room, identity)
          : result.body,
        result.status
      );
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

  async alarm(): Promise<void> {
    const room = await this.loadState(),
      now = Date.now(),
      nextRoom = this.recoverDueState(room, now);

    if (nextRoom !== room) {
      await this.persist(nextRoom);
      this.broadcastStateChange(room, nextRoom);
    }
    await this.scheduleNextAlarm(nextRoom);
  }

  async getState(roomId: string): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    return this.publicState(await this.loadState());
  }

  async getStateForUser(
    roomId: string,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    return this.publicState(await this.loadState(), identity);
  }

  async joinRoom(
    roomId: string,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      return this.publicState(room, identity);
    }
    if (!identity.userId || identity.userId === "anonymous") {
      return this.publicState(room, identity);
    }

    const coordination = room.battle.coordination,
      admittedUserIds = coordination.admittedUserIds ?? [],
      queuedUserIds = coordination.queuedUserIds ?? [],
      waitingUserIds = coordination.waitingUserIds ?? [],
      isAdmissionOpen =
        coordination.phase === "waiting_room" ||
        coordination.phase === "between_rounds" ||
        coordination.phase === "round_intro",
      isScheduled = coordination.phase === "scheduled",
      alreadyPresent = [
        ...admittedUserIds,
        ...queuedUserIds,
        ...waitingUserIds,
      ].includes(identity.userId);
    if (alreadyPresent) {
      return this.publicState(room, identity);
    }

    if ((coordination.removedUserIds ?? []).includes(identity.userId)) {
      return this.publicState(room, identity);
    }

    const nextCoordination = isScheduled
        ? {
            ...coordination,
            queuedUserIds: [...queuedUserIds, identity.userId],
          }
        : (isAdmissionOpen
          ? {
              ...coordination,
              admittedUserIds: [...admittedUserIds, identity.userId],
            }
          : {
              ...coordination,
              waitingUserIds: [...waitingUserIds, identity.userId],
            }),
      nextRoom = {
        ...room,
        battle: { ...room.battle, coordination: nextCoordination },
      };
    await this.persist(nextRoom);
    this.broadcast({
      type: isScheduled
        ? "battle.viewer_queued"
        : (isAdmissionOpen
          ? "battle.viewer_admitted"
          : "battle.viewer_waiting"),
      userId: identity.userId,
    });
    return this.publicState(nextRoom, identity);
  }

  async queueViewer(
    roomId: string,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    return this.joinRoom(roomId, identity);
  }

  async leaveViewer(
    roomId: string,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      return this.publicState(room, identity);
    }

    const coordination = room.battle.coordination,
      nextCoordination = {
        ...coordination,
        admittedUserIds: (coordination.admittedUserIds ?? []).filter(
          (userId) => userId !== identity.userId
        ),
        queuedUserIds: (coordination.queuedUserIds ?? []).filter(
          (userId) => userId !== identity.userId
        ),
        requiredVoterUserIds: (coordination.requiredVoterUserIds ?? []).filter(
          (userId) => userId !== identity.userId
        ),
        votedUserIds: (coordination.votedUserIds ?? []).filter(
          (userId) => userId !== identity.userId
        ),
        waitingUserIds: (coordination.waitingUserIds ?? []).filter(
          (userId) => userId !== identity.userId
        ),
      },
      nextRoom = {
        ...room,
        battle: { ...room.battle, coordination: nextCoordination },
      };
    await this.persist(nextRoom);
    this.broadcast({ type: "battle.viewer_left", userId: identity.userId });
    return this.publicState(nextRoom, identity);
  }

  async seed(
    roomId: string,
    body: LiveRoomState
  ): Promise<{ replaced: boolean; room: LiveRoomState }> {
    this.requestedRoomId = roomId;
    const room = this.normalizeState(body),
      storedState =
        await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY),
      shouldReplaceStoredState =
        !storedState ||
        storedState.id !== room.id ||
        storedState.kind !== room.kind ||
        storedState.title !== room.title;

    if (!shouldReplaceStoredState) {
      return {
        replaced: false,
        room: this.publicState(await this.loadState()),
      };
    }

    await this.persist(room);
    this.broadcast({ room: this.publicState(room), type: "state" });
    return { replaced: true, room: this.publicState(room) };
  }

  async chat(
    roomId: string,
    body: LiveRoomChatBody,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomChatResult> {
    this.requestedRoomId = roomId;
    const result = await this.appendChatMessage(body, identity);
    return this.publicChatResult(result, identity);
  }

  async vote(
    roomId: string,
    body: LiveRoomVoteBody,
    identity: LiveRoomIdentity
  ) {
    this.requestedRoomId = roomId;
    const result = await this.applyVote(body, identity);
    return {
      ...result,
      body:
        result.body && "room" in result.body && result.body.room
          ? this.publicState(result.body.room, identity)
          : result.body,
    };
  }

  async chooseBattleKit(
    roomId: string,
    userId: string,
    kitId: string,
    availableTrackIds: string[]
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      throw new Error("Battle kit selection is not available in this room.");
    }

    const artist = room.battle.artists.find((entry) => entry.id === userId);
    if (!artist) {
      throw new Error("Only a battle competitor can choose a Battle Kit.");
    }

    const currentControls = room.battle.artistControlsByUserId?.[userId],
      nextRoom: LiveRoomState = {
        ...room,
        battle: {
          ...room.battle,
          artistControlsByUserId: {
            ...room.battle.artistControlsByUserId,
            [userId]: {
              availableTrackIds,
              currentTrackId: currentControls?.currentTrackId ?? null,
              selectedKitId: kitId,
              selectedNextTrackId: currentControls?.selectedNextTrackId ?? null,
              usedTrackIds: currentControls?.usedTrackIds ?? [],
            },
          },
        },
      };
    await this.persist(nextRoom);
    this.broadcastToUser(userId, {
      kitId,
      type: "battle.kit_selected",
    });
    return this.publicState(nextRoom);
  }

  async chooseBattleTrack(
    roomId: string,
    trackId: string,
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      throw new Error("Battle controls are not available in this room.");
    }

    const artist = room.battle.artists.find(
      (entry) => entry.id === identity.userId
    );
    if (
      !artist ||
      (identity.role !== "artist_a" && identity.role !== "artist_b")
    ) {
      throw new Error("Only a battle competitor can choose a track.");
    }

    const controls = room.battle.artistControlsByUserId?.[identity.userId];
    if (!controls?.availableTrackIds.includes(trackId)) {
      throw new Error("Track is not available in your locked Battle Kit.");
    }

    const nextRoom: LiveRoomState = {
      ...room,
      battle: {
        ...room.battle,
        artistControlsByUserId: {
          ...room.battle.artistControlsByUserId,
          [identity.userId]: {
            ...controls,
            selectedNextTrackId: trackId,
          },
        },
      },
    };
    await this.persist(nextRoom);
    this.broadcastToUser(identity.userId, {
      trackId,
      type: "battle.track_selected",
    });
    return this.publicState(nextRoom, identity);
  }

  async updatePartyPlayback(
    roomId: string,
    action:
      | { type: "pause" }
      | { type: "resume" }
      | { type: "replay"; trackId?: string }
      | { type: "track_changed"; trackId: string },
    identity: LiveRoomIdentity
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState(),
      playback = room.party?.playback;
    if (!(room.kind === "party" && playback)) {
      throw new Error("Party playback is not available in this room.");
    }
    if (identity.userId !== playback.hostUserId) {
      throw new Error("Only the party host can control playback.");
    }

    const now = Date.now(),
      positionMs = this.authoritativePartyPosition(playback, now),
      nextPlayback = {
        ...playback,
        playbackState:
          action.type === "pause"
            ? ("paused" as const)
            : (action.type === "resume"
              ? ("playing" as const)
              : playback.playbackState),
        positionMs:
          action.type === "replay" || action.type === "track_changed"
            ? 0
            : positionMs,
        stateChangedAt: now,
        ...(action.type === "track_changed"
          ? { trackId: action.trackId }
          : (action.type === "replay" && action.trackId
            ? { trackId: action.trackId }
            : {})),
      },
      nextRoom: LiveRoomState = {
        ...room,
        party: { playback: nextPlayback },
      };

    await this.persist(nextRoom);
    this.broadcast({ playback: nextPlayback, type: "party.playback_changed" });
    return this.publicState(nextRoom, identity);
  }

  private async loadState(): Promise<LiveRoomState> {
    if (this.roomState) {
      const recovered = this.recoverDueState(this.roomState);
      if (recovered !== this.roomState) {
        await this.persist(recovered);
        this.broadcastStateChange(this.roomState, recovered);
      }
      return recovered;
    }

    const storedState =
      await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY);
    if (storedState) {
      const storedChat =
          await this.ctx.storage.get<LiveRoomChatMessage[]>(CHAT_STORAGE_KEY),
        room = this.normalizeState({
          ...storedState,
          chat: (storedChat ?? storedState.chat ?? []).slice(
            -MAX_CHAT_MESSAGES
          ),
        });
      this.roomState = room;
      if (!storedChat && room.chat.length > 0) {
        await this.ctx.storage.put(CHAT_STORAGE_KEY, room.chat);
      }
      await this.scheduleNextAlarm(room);
      return room;
    }

    const room = this.normalizeState(
      createSampleLiveRoom(this.requestedRoomId ?? this.ctx.id.toString())
    );
    await this.persist(room);
    return room;
  }

  private normalizeState(room: LiveRoomState): LiveRoomState {
    if (!(room.kind === "battle" && room.battle)) {
      return room;
    }

    const regularRoundCount = room.battle.rounds.filter(
        (round) => !round.isTiebreaker
      ).length,
      format = (room.battle.coordination?.format ??
        (regularRoundCount === 7
          ? "best_of_7"
          : (regularRoundCount === 5
            ? "best_of_5"
            : "best_of_3"))) as BattleCoordination["format"],
      scheduledStartAt = room.startsAt ? Date.parse(room.startsAt) : null,
      shouldWaitForScheduledStart =
        room.status === "upcoming" &&
        scheduledStartAt !== null &&
        scheduledStartAt > Date.now(),
      coordination = {
        ...(room.battle.coordination ??
          createBattleCoordination({
            admissionBatchSize: this.battleAdmissionBatchSize(),
            battleId: room.id,
            durations: PRODUCTION_BATTLE_DURATIONS,
            format,
            scheduledStartAt,
          })),
        ...(shouldWaitForScheduledStart
          ? {
              phase: "scheduled" as const,
              phaseEndsAt: scheduledStartAt,
              phaseStartedAt: Date.now(),
            }
          : {}),
        admissionBatchSize:
          room.battle.coordination?.admissionBatchSize ??
          this.battleAdmissionBatchSize(),
        admittedUserIds: room.battle.coordination?.admittedUserIds ?? [],
        removedUserIds: room.battle.coordination?.removedUserIds ?? [],
        requiredVoterUserIds:
          room.battle.coordination?.requiredVoterUserIds ?? [],
        votedUserIds: room.battle.coordination?.votedUserIds ?? [],
        waitingUserIds: room.battle.coordination?.waitingUserIds ?? [],
      };

    return {
      ...room,
      battle: {
        ...room.battle,
        coordination,
        phase: coordination.phase,
      },
    };
  }

  private recoverDueState(
    room: LiveRoomState,
    now = Date.now()
  ): LiveRoomState {
    if (room.kind === "battle" && room.battle?.coordination) {
      const coordination = room.battle.coordination,
        next = advanceBattleToNow({ battle: room.battle, coordination }, now),
        changed =
          next.coordination.lastTransitionVersion !==
          coordination.lastTransitionVersion;

      if (changed) {
        const nextRound = next.battle.rounds.find(
          (round) => round.number === next.coordination.roundNumber
        );
        return {
          ...room,
          battle: {
            ...next.battle,
            coordination: next.coordination,
            currentRoundId: nextRound?.id ?? room.battle.currentRoundId,
            phase: next.coordination.phase,
          },
          currentTrackId:
            next.coordination.activeArtistUserId === room.battle.artists[1].id
              ? (nextRound?.artistBTrack.id ?? room.currentTrackId)
              : (nextRound?.artistATrack.id ?? room.currentTrackId),
          serverNow: now,
          status: next.coordination.phase === "ended" ? "ended" : "live",
        };
      }
    }

    if (
      room.kind === "stream" &&
      room.stream?.ingestStatus === "reconnecting" &&
      room.stream.reconnectUntil &&
      now >= room.stream.reconnectUntil
    ) {
      return {
        ...room,
        serverNow: now,
        status: "ended",
        stream: {
          ...room.stream,
          ingestStatus: "disconnected",
          reconnectUntil: null,
        },
      };
    }

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
    await this.scheduleNextAlarm(room);
  }

  private async scheduleNextAlarm(room: LiveRoomState) {
    const timestamps = [
      room.battle?.coordination?.phaseEndsAt ?? null,
      room.stream?.reconnectUntil ?? null,
    ].filter((value): value is number => typeof value === "number");
    if (timestamps.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...timestamps));
  }

  private broadcastStateChange(previous: LiveRoomState, next: LiveRoomState) {
    if (
      previous.battle?.coordination?.phase !== next.battle?.coordination?.phase
    ) {
      this.broadcast({
        phase: next.battle?.coordination?.phase,
        phaseEndsAt: next.battle?.coordination?.phaseEndsAt,
        roundNumber: next.battle?.coordination?.roundNumber,
        type: "battle.phase_changed",
        version: next.battle?.coordination?.lastTransitionVersion,
      });
    }
    const removedUserIds = next.battle?.coordination?.removedUserIds ?? [];
    if (removedUserIds.length > 0) {
      this.broadcast({
        reason:
          "You were removed because voting is required to remain in this battle.",
        type: "battle.non_voters_removed",
        userIds: removedUserIds,
      });
      for (const socket of this.ctx.getWebSockets()) {
        const attachment =
          socket.deserializeAttachment() as LiveRoomSocketAttachment | null;
        if (attachment && removedUserIds.includes(attachment.userId)) {
          socket.close(4003, "Voting is required to remain in this battle.");
        }
      }
    }
    this.broadcast({ room: this.publicState(next), type: "state" });
  }

  private publicState(
    room: LiveRoomState,
    identity?: LiveRoomIdentity
  ): LiveRoomState {
    const role = identity?.role ?? "fan",
      publicRoom: LiveRoomState = { ...room, role, serverNow: Date.now() };

    if (room.battle) {
      const coordination = room.battle.coordination,
        queueSize =
          (coordination?.queuedUserIds?.length ?? 0) +
          (coordination?.waitingUserIds?.length ?? 0),
        viewerQueueStatus = identity?.userId
          ? (coordination?.queuedUserIds ?? []).includes(identity.userId)
            ? "queued"
            : (coordination?.waitingUserIds ?? []).includes(identity.userId)
              ? "waiting"
              : (coordination?.admittedUserIds ?? []).includes(identity.userId)
                ? "admitted"
                : null
          : null;
      publicRoom.battle = {
        ...room.battle,
        artistControlsByUserId: undefined,
        coordination: room.battle.coordination
          ? {
              ...room.battle.coordination,
              admittedUserIds: undefined,
              removedUserIds: undefined,
              requiredVoterUserIds: undefined,
              votedUserIds: undefined,
              waitingUserIds: undefined,
            }
          : undefined,
        queueSize,
        queueUserIds: undefined,
        viewerQueueStatus,
        waitingRoomCount: coordination?.waitingUserIds?.length ?? 0,
      };
    }

    if (
      identity &&
      (role === "artist_a" || role === "artist_b") &&
      room.battle?.artistControlsByUserId?.[identity.userId]
    ) {
      publicRoom.battle = {
        ...room.battle,
        artistControls: room.battle.artistControlsByUserId[identity.userId],
        artistControlsByUserId: undefined,
        coordination: publicRoom.battle?.coordination,
      };
    }
    return publicRoom;
  }

  private publicChatResult(
    result: LiveRoomChatResult,
    identity: LiveRoomIdentity
  ): LiveRoomChatResult {
    return { ...result, room: this.publicState(result.room, identity) };
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
      return { message: null, room: this.publicState(room, identity) };
    }

    if (!this.consumeChatRate(identity.userId)) {
      recordRealtimeMetric({
        dataset: this.env.DO_METRICS,
        event: "live_room_rate_limited",
        indexes: [identity.userId],
      });
      return {
        message: null,
        rateLimited: true,
        room: this.publicState(room, identity),
      };
    }

    const chatMessage: LiveRoomChatMessage = {
        id: crypto.randomUUID(),
        message,
        sentAt: new Date().toISOString(),
        userName: identity.displayName,
      },
      nextChat = [...room.chat, chatMessage].slice(-MAX_CHAT_MESSAGES),
      nextRoom = { ...room, chat: nextChat };

    await this.persistChat(nextChat);
    this.roomState = nextRoom;
    this.broadcast({ message: chatMessage, type: "chat" });
    recordRealtimeMetric({
      dataset: this.env.DO_METRICS,
      doubles: [this.ctx.getWebSockets().length],
      event: "live_room_chat",
      indexes: [identity.userId],
    });
    return {
      message: chatMessage,
      room: this.publicState(nextRoom, identity),
    };
  }

  private async applyVote(body: LiveRoomVoteBody, identity: LiveRoomIdentity) {
    const room = await this.loadState();
    if (room.kind !== "battle" || !room.battle) {
      return {
        body: { message: "Voting is only available in battle rooms." },
        status: 400,
      };
    }
    if (
      !room.battle.coordination ||
      !isVotingPhase(room.battle.coordination.phase)
    ) {
      return { body: { message: "Voting is not open." }, status: 409 };
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

    if (
      !(room.battle.coordination.requiredVoterUserIds ?? []).includes(
        identity.userId
      )
    ) {
      return { body: { message: "Not admitted to this round." }, status: 403 };
    }

    const artist = room.battle.artists.find(
      (entry) => entry.id === body.artistId
    );
    if (!artist) {
      return { body: { message: "Artist not found." }, status: 404 };
    }
    if (identity.userId === artist.id) {
      return {
        body: { message: "Artists cannot vote in their own battle." },
        status: 403,
      };
    }

    const votersKey = voteVotersKey(round.id),
      voters = await this.ctx.storage.get<string[]>(votersKey),
      voterId = identity.userId;
    if (voters?.includes(voterId)) {
      return { body: { message: "Already voted." }, status: 409 };
    }

    await this.ctx.storage.put(votersKey, [...(voters ?? []), voterId]);
    const nextRounds = room.battle.rounds.map((entry) =>
        entry.id === round.id
          ? {
              ...entry,
              voteTotals: {
                ...entry.voteTotals,
                [artist.id]: (entry.voteTotals[artist.id] ?? 0) + 1,
              },
            }
          : entry
      ),
      nextRoom = {
        ...room,
        battle: {
          ...room.battle,
          coordination: {
            ...room.battle.coordination,
            votedUserIds: [
              ...(room.battle.coordination.votedUserIds ?? []),
              identity.userId,
            ],
          },
          rounds: nextRounds,
        },
      };

    await this.persist(nextRoom);
    this.broadcast({
      roundId: round.id,
      type: "battle.vote_cast",
      voteTotals: nextRounds.find((entry) => entry.id === round.id)?.voteTotals,
    });
    return {
      body: { room: this.publicState(nextRoom, identity) },
      status: 200,
    };
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
          const room = await this.joinRoom(
            this.requestedRoomId ?? this.ctx.id.toString(),
            attachment
          );
          server.send(JSON.stringify({ room, type: "state" }));
          await this.broadcastPresence();
        } catch (error) {
          console.error("Live room initial state delivery failed", {
            error: error instanceof Error ? error.message : String(error),
            roomId: this.requestedRoomId,
          });
          server.close(1011, "Unable to initialize live room.");
        }
      })()
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  private async broadcastPresence() {
    const room = await this.loadState();
    this.broadcast({
      count: this.ctx.getWebSockets().length,
      roomId: room.id,
      type: "presence",
    });
  }

  private broadcastToUser(userId: string, payload: unknown) {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      const attachment =
        socket.deserializeAttachment() as LiveRoomSocketAttachment | null;
      if (attachment?.userId !== userId) {
        continue;
      }
      socket.send(message);
    }
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
    const role = request.headers.get("x-soundkit-live-role");
    return {
      displayName:
        request.headers.get("x-soundkit-live-display-name") ?? "Listener",
      role:
        role === "admin" ||
        role === "artist_a" ||
        role === "artist_b" ||
        role === "fan" ||
        role === "host"
          ? role
          : undefined,
      userId: request.headers.get("x-soundkit-live-user-id") ?? "anonymous",
    };
  }

  private authoritativePartyPosition(
    playback: NonNullable<LiveRoomState["party"]>["playback"],
    now: number
  ) {
    return playback.playbackState === "playing"
      ? playback.positionMs + Math.max(0, now - playback.stateChangedAt)
      : playback.positionMs;
  }
}

export const isLiveRoomSocketMessage = (
  value: unknown
): value is LiveRoomSocketMessage =>
  isRecord(value) && typeof value.type === "string";
