/* eslint-disable complexity, one-var, sort-vars, typescript/explicit-member-accessibility, require-await, prefer-destructuring, class-methods-use-this */
import { DurableObject } from "cloudflare:workers";

import type { BattleDirectoryDurableObject } from "@/durable-objects/battle-directory";
import { finalizeBattleNoShow } from "@/lib/battle-service";
import {
  advanceBattleToNow,
  battleArtistsArePresent,
  battleArtistsAreReady,
  createBattleCoordination,
  isBattleTerminalState,
  isVotingPhase,
  PRODUCTION_BATTLE_DURATIONS,
} from "@/lib/live-battle-state";
import type { BattleCoordination, BattlePhase } from "@/lib/live-battle-state";
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

export type LiveRoomBattleBotAction =
  | "close_voting"
  | "complete_round"
  | "move_lobby_to_round"
  | "open_lobby"
  | "snapshot_voters"
  | "start_battle";

export interface LiveRoomBattleDisposition {
  affectedUserId?: string | null;
  kind: "canceled" | "ducked" | "forfeited" | "quit";
  reason:
    | "artist_unavailable"
    | "ducked"
    | "moderation"
    | "other"
    | "platform_issue"
    | "schedule_conflict"
    | "technical_issue";
}

export interface LiveRoomIdentity {
  avatarUrl?: string | null;
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

const BATTLE_BOT_USER_ID = "soundkit-battlebot",
  CHAT_RATE_LIMIT = 5,
  CHAT_RATE_WINDOW_MS = 5000,
  CHAT_STORAGE_KEY = "live-room-chat",
  MAX_CHAT_MESSAGES = 80,
  MAX_CHAT_MESSAGE_LENGTH = 500,
  NO_SHOW_RECONCILED_STORAGE_KEY = "battle-no-show-reconciled-at",
  STATE_STORAGE_KEY = "live-room-state",
  voteVotersKey = (roundId: string) => `vote-voters:${roundId}`,
  jsonResponse = (body: unknown, status = 200) =>
    Response.json(body, { status }),
  notFoundResponse = () => jsonResponse({ message: "Not found" }, 404),
  isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null,
  stringListsEqual = (left?: string[], right?: string[]) => {
    const leftValues = (left ?? []).toSorted(),
      rightValues = (right ?? []).toSorted();
    return (
      leftValues.length === rightValues.length &&
      leftValues.every((value, index) => value === rightValues[index])
    );
  },
  isEndedBattleRoom = (room: LiveRoomState) =>
    room.kind === "battle" &&
    isBattleTerminalState({
      phase: room.battle?.coordination?.phase,
      status: room.status,
    });

export const battleOutcomeMessage = (room: LiveRoomState) => {
  const outcome = room.battle?.coordination?.outcome;
  if (!outcome) {
    return null;
  }

  const affectedArtist = room.battle?.artists.find(
      (artist) => artist.id === outcome.affectedUserId
    ),
    coordination = room.battle?.coordination,
    currentRound = room.battle?.rounds.find(
      (round) => round.number === coordination?.roundNumber
    ),
    affectedTrack = affectedArtist
      ? affectedArtist.id === room.battle?.artists[0]?.id
        ? currentRound?.artistATrack
        : currentRound?.artistBTrack
      : undefined,
    roundNumber = coordination?.roundNumber ?? 1;

  if (outcome.kind === "canceled") {
    return outcome.reason === "artist_unavailable"
      ? "The battle was canceled before the first turn. No result was recorded. The room is now closed."
      : "The battle was canceled. No result was recorded. The room is now closed.";
  }

  if (outcome.kind === "ducked") {
    return `${affectedArtist?.name ?? "The opponent"} did not check in. The battle was canceled before the first turn. The room is now closed.`;
  }

  const verb = outcome.kind === "forfeited" ? "forfeited" : "quit",
    trackContext = affectedTrack ? ` while “${affectedTrack.title}” was on stage` : "";
  return `${affectedArtist?.name ?? "An artist"} ${verb} during Round ${roundNumber}${trackContext}. The battle ended with no rated result. The room is now closed.`;
};

export const battleBotMessageForPhase = (
  room: LiveRoomState,
  phase: BattlePhase
) => {
  const battle = room.battle;
  if (!battle) {
    return null;
  }

  const { artists, coordination } = battle,
    activeArtist = artists.find(
      (artist) => artist.id === coordination?.activeArtistUserId
    ),
    currentRound = coordination
      ? battle.rounds.find((round) => round.number === coordination.roundNumber)
      : undefined,
    roundNumber = coordination?.roundNumber ?? currentRound?.number ?? 1,
    [artistA, artistB] = artists,
    votesA = currentRound?.voteTotals[artistA?.id ?? ""] ?? 0,
    votesB = currentRound?.voteTotals[artistB?.id ?? ""] ?? 0,
    roundLabel = currentRound?.isTiebreaker
      ? `Tiebreaker ${roundNumber}`
      : `Round ${roundNumber}`;

  switch (phase) {
    case "waiting_room": {
      return "The lobby is open. Waiting for both artists to check in and lock their Battle Kits.";
    }
    case "round_intro": {
      return `${roundLabel} is next. Both artists are on deck.`;
    }
    case "turn_transition":
    case "tiebreaker_transition": {
      return activeArtist
        ? `${roundLabel}: ${activeArtist.name} is up next.`
        : `${roundLabel}: the stage is changing hands.`;
    }
    case "pre_vote": {
      return `${roundLabel}: both turns are in. Voting opens next.`;
    }
    case "artist_a_turn":
    case "artist_b_turn":
    case "tiebreaker_a":
    case "tiebreaker_b": {
      const activeTrack =
        activeArtist?.id === artistA?.id
          ? currentRound?.artistATrack
          : currentRound?.artistBTrack;
      return `${roundLabel}: ${activeArtist?.name ?? "The active artist"} is up${activeTrack ? ` with “${activeTrack.title}”` : ""}.`;
    }
    case "voting":
    case "tiebreaker_voting": {
      const trackNames = currentRound
        ? ` “${currentRound.artistATrack.title}” vs “${currentRound.artistBTrack.title}”`
        : "";
      return `${roundLabel} is open.${trackNames} Vote for the track that takes the round.`;
    }
    case "round_result": {
      if (votesA === votesB) {
        return `${roundLabel} is tied at ${votesA}–${votesB}.`;
      }

      const winner = votesA > votesB ? artistA : artistB,
        winningTrack = votesA > votesB
          ? currentRound?.artistATrack
          : currentRound?.artistBTrack;
      return `${roundLabel} goes to ${winner?.name ?? "the winning artist"}${winningTrack ? ` with “${winningTrack.title}”` : ""}, ${votesA}–${votesB}.`;
    }
    case "between_rounds": {
      return `Round ${Math.max(1, roundNumber - 1)} is complete. The audience is resetting for Round ${roundNumber}.`;
    }
    case "battle_result": {
      const artistAWins = battle.rounds.filter(
          (round) => round.winnerArtistId === artistA?.id
        ).length,
        artistBWins = battle.rounds.filter(
          (round) => round.winnerArtistId === artistB?.id
        ).length,
        winner = artists.find(
          (artist) => artist.id === coordination?.winnerUserId
        );

      return winner
        ? `Battle complete: ${winner.name} wins ${artistAWins}–${artistBWins}.`
        : `Battle complete: the match ends in a tie at ${artistAWins}–${artistBWins}.`;
    }
    case "ended": {
      const outcomeMessage = battleOutcomeMessage(room);
      if (outcomeMessage) {
        const lastMessage = room.chat.at(-1);
        return lastMessage?.userId === BATTLE_BOT_USER_ID &&
          lastMessage.message === outcomeMessage
          ? null
          : outcomeMessage;
      }

      return null;
    }
    default: {
      return null;
    }
  }
};

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
          storedState.title !== room.title ||
          (isEndedBattleRoom(room) && !isEndedBattleRoom(storedState));

      if (shouldReplaceStoredState) {
        await this.persist(room);
        this.broadcast({ room: this.publicState(room), type: "state" });
        if (room.kind === "battle") {
          this.publishBattleDirectoryUpdate(room.id);
        }
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
        return;
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
    await this.loadState();
    await this.broadcastPresence();
  }

  async alarm(): Promise<void> {
    const room = await this.loadState(),
      now = Date.now(),
      nextRoom = this.recoverDueState(room, now);

    if (nextRoom !== room) {
      await this.persist(nextRoom);
      await this.broadcastStateChange(room, nextRoom);
    }
    const noShowReconciled = await this.reconcileAutomaticNoShow(nextRoom);
    if (noShowReconciled) {
      await this.scheduleNextAlarm(nextRoom);
    }
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
    if (
      identity.role === "admin" ||
      identity.role === "artist_a" ||
      identity.role === "artist_b" ||
      identity.role === "host"
    ) {
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

  async getBattleAudienceUserIds(roomId: string): Promise<string[]> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      return [];
    }

    const artistIds = new Set(room.battle.artists.map((artist) => artist.id));
    return [
      ...(room.battle.coordination.admittedUserIds ?? []),
      ...(room.battle.coordination.queuedUserIds ?? []),
      ...(room.battle.coordination.waitingUserIds ?? []),
      ...(room.battle.coordination.requiredVoterUserIds ?? []),
    ].filter(
      (userId, index, userIds) =>
        userId !== "anonymous" &&
        !artistIds.has(userId) &&
        userIds.indexOf(userId) === index
    );
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
        await this.ctx.storage.get<LiveRoomState>(STATE_STORAGE_KEY);
    let roomToPersist = room;
    const shouldRepairBattleRounds =
        storedState &&
        room.kind === "battle" &&
        room.battle &&
        room.battle.rounds.length > 0 &&
        (!storedState.battle || storedState.battle.rounds.length === 0),
      shouldRepairTerminalState =
        isEndedBattleRoom(room) &&
        (!storedState || !isEndedBattleRoom(storedState));

    if (
      shouldRepairBattleRounds &&
      !shouldRepairTerminalState &&
      storedState?.battle &&
      room.kind === "battle" &&
      room.battle
    ) {
      const incomingBattle = room.battle;
      roomToPersist = {
        ...room,
        battle: {
          ...incomingBattle,
          ...storedState.battle,
          coordination:
            storedState.battle.coordination ?? incomingBattle.coordination,
          currentRoundId:
            storedState.battle.currentRoundId || incomingBattle.currentRoundId,
          rounds: incomingBattle.rounds,
        },
      };
    }

    const shouldReplaceStoredState =
      !storedState ||
      storedState.id !== roomToPersist.id ||
      storedState.kind !== roomToPersist.kind ||
      storedState.title !== roomToPersist.title ||
      shouldRepairBattleRounds ||
      shouldRepairTerminalState;

    if (!shouldReplaceStoredState) {
      return {
        replaced: false,
        room: this.publicState(await this.loadState()),
      };
    }

    await this.persist(roomToPersist);
    this.broadcast({ room: this.publicState(roomToPersist), type: "state" });
    if (roomToPersist.kind === "battle") {
      this.publishBattleDirectoryUpdate(roomToPersist.id);
    }
    return { replaced: true, room: this.publicState(roomToPersist) };
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

  async setArtistReady(
    roomId: string,
    identity: LiveRoomIdentity,
    ready: boolean
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      throw new Error("Battle readiness is not available in this room.");
    }
    if (!(identity.role === "artist_a" || identity.role === "artist_b")) {
      throw new Error("Only battle artists can change readiness.");
    }
    if (
      room.battle.coordination.phase !== "waiting_room" &&
      room.battle.coordination.phase !== "between_rounds"
    ) {
      throw new Error(
        "Artists can only change readiness in the waiting room or between rounds."
      );
    }
    if (
      ready &&
      !room.battle.artistControlsByUserId?.[identity.userId]?.selectedKitId
    ) {
      throw new Error("Lock a battle-ready Battle Kit before marking ready.");
    }

    const artistIds = new Set(room.battle.artists.map((artist) => artist.id)),
      readyUserIds = new Set(
        (room.battle.coordination.artistReadyUserIds ?? []).filter((userId) =>
          artistIds.has(userId)
        )
      );
    if (ready) {
      readyUserIds.add(identity.userId);
    } else {
      readyUserIds.delete(identity.userId);
    }

    const nextRoom: LiveRoomState = {
      ...room,
      battle: {
        ...room.battle,
        coordination: {
          ...room.battle.coordination,
          artistReadyUserIds: [...readyUserIds],
        },
      },
    };
    await this.persist(nextRoom);
    const artistName =
      room.battle.artists.find((artist) => artist.id === identity.userId)
        ?.name ?? "An artist";
    const announcedRoom = await this.appendBotChatMessage(
      nextRoom,
      ready
        ? `${artistName} is ready. ${readyUserIds.size}/2 artists are ready.`
        : `${artistName} is no longer marked ready.`
    );
    const bothReady = battleArtistsAreReady(
      room.battle,
      announcedRoom.battle?.coordination ?? room.battle.coordination
    );
    const bothPresent = battleArtistsArePresent(
      room.battle,
      announcedRoom.battle?.coordination ?? room.battle.coordination
    );
    if (!(bothReady && bothPresent)) {
      this.broadcast({ room: this.publicState(announcedRoom), type: "state" });
      this.publishBattleDirectoryUpdate(roomId);
      return this.publicState(announcedRoom, identity);
    }

    const announcedBattle = announcedRoom.battle;
    if (!announcedBattle?.coordination) {
      throw new Error("Battle state was lost while starting the battle.");
    }
    const now = Date.now(),
      startedRoom = this.recoverDueState(
        {
          ...announcedRoom,
          battle: {
            ...announcedBattle,
            coordination: {
              ...announcedBattle.coordination,
              phaseEndsAt: now,
            },
          },
        },
        now
      );
    await this.persist(startedRoom);
    await this.broadcastStateChange(announcedRoom, startedRoom);
    return this.publicState(startedRoom, identity);
  }

  async resolveBattleDisposition(
    roomId: string,
    identity: LiveRoomIdentity,
    disposition: LiveRoomBattleDisposition
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      throw new Error("Battle disposition is not available in this room.");
    }

    const { phase } = room.battle.coordination,
      isAdmin = identity.role === "admin",
      battleHasStarted = phase !== "scheduled" && phase !== "waiting_room";
    if (phase === "ended") {
      throw new Error("This battle has already ended.");
    }
    if (disposition.kind === "forfeited" || disposition.kind === "quit") {
      if (!(battleHasStarted && phase !== "round_intro")) {
        throw new Error(
          "A forfeit or quit is only available after both artists are ready and turns have started."
        );
      }
      if (
        disposition.affectedUserId &&
        !room.battle.artists.some(
          (artist) => artist.id === disposition.affectedUserId
        )
      ) {
        throw new Error("The affected artist is not in this battle.");
      }
      if (!isAdmin && disposition.affectedUserId !== identity.userId) {
        throw new Error("Artists can only leave their own battle seat.");
      }
    } else if (!(isAdmin || !battleHasStarted)) {
      throw new Error(
        "Battle cancellation is only available before turns start."
      );
    }

    if (disposition.kind === "ducked") {
      if (battleHasStarted || !disposition.affectedUserId) {
        throw new Error(
          "A duck can only be recorded for a waiting-room no-show."
        );
      }
      if (
        disposition.affectedUserId === identity.userId ||
        !room.battle.artists.some(
          (artist) => artist.id === disposition.affectedUserId
        )
      ) {
        throw new Error("Choose the opponent as the ducked artist.");
      }
    }

    const outcome = {
      affectedUserId: disposition.affectedUserId ?? null,
      kind: disposition.kind,
      reason: disposition.reason,
      recordedAt: Date.now(),
    } as const;
    const nextRoom: LiveRoomState = {
      ...room,
      battle: {
        ...room.battle,
        coordination: {
          ...room.battle.coordination,
          activeArtistUserId: null,
          outcome,
          phase: "ended",
          phaseEndsAt: null,
        },
      },
      status: "ended",
    };
    await this.persist(nextRoom);
    const announcedRoom = await this.appendBotChatMessage(
      nextRoom,
      battleOutcomeMessage(nextRoom) ??
        "The battle ended. The room is now closed. No new turns, votes, or lineup changes are available."
    );
    await this.broadcastStateChange(room, announcedRoom);
    return this.publicState(announcedRoom, identity);
  }

  async announceBattleBotAction(
    roomId: string,
    action: LiveRoomBattleBotAction
  ): Promise<LiveRoomState> {
    this.requestedRoomId = roomId;
    const room = await this.loadState();
    if (!(room.kind === "battle" && room.battle?.coordination)) {
      return this.publicState(room);
    }
    if (isEndedBattleRoom(room)) {
      return this.publicState(room);
    }

    const phase = room.battle.coordination.phase,
      artistsCanStart =
        battleArtistsAreReady(room.battle, room.battle.coordination) &&
        battleArtistsArePresent(room.battle, room.battle.coordination),
      shouldAdvance =
        (action === "open_lobby" && phase === "scheduled") ||
        (action === "move_lobby_to_round" &&
          ((phase === "waiting_room" && artistsCanStart) ||
            phase === "between_rounds")) ||
        (action === "start_battle" && phase === "waiting_room" && artistsCanStart) ||
        ((action === "close_voting" || action === "complete_round") &&
          isVotingPhase(phase));

    if (shouldAdvance) {
      const now = Date.now(),
        nextRoom = this.recoverDueState(
          {
            ...room,
            battle: {
              ...room.battle,
              coordination: {
                ...room.battle.coordination,
                phaseEndsAt: now,
              },
            },
          },
          now
        );
      if (nextRoom !== room) {
        await this.persist(nextRoom);
        await this.broadcastStateChange(room, nextRoom);
        return this.publicState(nextRoom);
      }
    }

    this.broadcast({
      action,
      activeArtistUserId: room.battle.coordination.activeArtistUserId,
      phase,
      type: "battle.bot_stage_control",
    });

    const message =
      action === "open_lobby"
        ? "The battle lobby is open."
        : action === "move_lobby_to_round" || action === "start_battle"
          ? "The next round is being staged."
          : action === "close_voting"
            ? "Voting is closed. The round result is being calculated."
            : action === "complete_round"
              ? "The round is complete. The next transition is being prepared."
              : "The audience vote snapshot is recorded.";
    const nextRoom = await this.appendBotChatMessage(room, message);
    return this.publicState(nextRoom);
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
    if (isEndedBattleRoom(room)) {
      throw new Error(
        "This battle has ended. The artist room is now read-only."
      );
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
    if (isEndedBattleRoom(room)) {
      throw new Error(
        "This battle has ended. The artist room is now read-only."
      );
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
    if (
      controls.usedTrackIds.includes(trackId) ||
      controls.currentTrackId === trackId
    ) {
      throw new Error("Choose an unused track from your Battle Kit.");
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
    const artistName =
        room.battle.artists.find((entry) => entry.id === identity.userId)
          ?.name ?? "An artist",
      selectedTrack = room.battle.rounds
        .flatMap((round) => [round.artistATrack, round.artistBTrack])
        .find((track) => track.id === trackId),
      announcedRoom = await this.appendBotChatMessage(
        nextRoom,
        `${artistName} selected “${selectedTrack?.title ?? "a track"}” from their locked Battle Kit.`
      );
    this.broadcastToUser(identity.userId, {
      trackId,
      type: "battle.track_selected",
    });
    return this.publicState(announcedRoom, identity);
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

    const requestedTrackId =
        action.type === "track_changed" ||
        (action.type === "replay" && action.trackId)
          ? action.trackId
          : playback.trackId,
      selectedTrack = requestedTrackId
        ? room.tracklist.find((track) => track.id === requestedTrackId)
        : undefined;
    if (requestedTrackId && !selectedTrack) {
      throw new Error("The selected track is not part of this party.");
    }

    const now = Date.now(),
      positionMs = this.authoritativePartyPosition(playback, now),
      nextPlayback = {
        ...playback,
        playbackState:
          action.type === "pause"
            ? ("paused" as const)
            : (action.type === "resume" || action.type === "track_changed"
              ? ("playing" as const)
              : playback.playbackState),
        positionMs:
          action.type === "replay" || action.type === "track_changed"
            ? 0
            : positionMs,
        stateChangedAt: now,
        trackId: requestedTrackId ?? null,
        trackIndex: selectedTrack
          ? room.tracklist.findIndex((track) => track.id === selectedTrack.id)
          : playback.trackIndex,
      },
      nextRoom: LiveRoomState = {
        ...room,
        currentTrackId: nextPlayback.trackId ?? room.currentTrackId,
        party: { playback: nextPlayback },
        tracklist: room.tracklist.map((track, index) => ({
          ...track,
          status:
            track.id === nextPlayback.trackId
              ? "playing"
              : (index < nextPlayback.trackIndex
                ? "played"
                : "queued"),
        })),
      };

    await this.persist(nextRoom);
    this.broadcast({ playback: nextPlayback, type: "party.playback_changed" });
    return this.publicState(nextRoom, identity);
  }

  private async loadState(): Promise<LiveRoomState> {
    const currentRoom = this.roomState;
    if (currentRoom) {
      const recovered = this.recoverDueState(currentRoom);
      if (recovered !== currentRoom) {
        await this.persist(recovered);
        await this.broadcastStateChange(currentRoom, recovered);
      }
      await this.reconcileAutomaticNoShow(recovered);
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
      await this.reconcileAutomaticNoShow(room);
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
      existingCoordination = room.battle.coordination,
      format = (existingCoordination?.format ??
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
          : (existingCoordination?.phase === "waiting_room" &&
              !existingCoordination.phaseEndsAt
            ? {
                phaseEndsAt:
                  existingCoordination.phaseStartedAt +
                  existingCoordination.durations.waitingRoomMs,
              }
            : {})),
        admissionBatchSize:
          room.battle.coordination?.admissionBatchSize ??
          this.battleAdmissionBatchSize(),
        admittedUserIds: room.battle.coordination?.admittedUserIds ?? [],
        artistPresentUserIds:
          room.battle.coordination?.artistPresentUserIds ?? [],
        artistReadyUserIds: room.battle.coordination?.artistReadyUserIds ?? [],
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
        chatStarted:
          room.battle.chatStarted ??
          !["scheduled", "waiting_room"].includes(coordination.phase),
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
        artistPresentUserIds =
          coordination.phase === "waiting_room"
            ? this.connectedArtistUserIds(room)
            : coordination.artistPresentUserIds,
        coordinationWithPresence =
          coordination.phase === "waiting_room"
            ? { ...coordination, artistPresentUserIds }
            : coordination,
        next = advanceBattleToNow(
          { battle: room.battle, coordination: coordinationWithPresence },
          now
        ),
        presenceChanged =
          !stringListsEqual(
            coordination.artistPresentUserIds,
            next.coordination.artistPresentUserIds
          ) && coordination.phase === "waiting_room",
        changed =
          next.coordination.lastTransitionVersion !==
            coordination.lastTransitionVersion || presenceChanged;

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

  private chatScopeForRoom(room: LiveRoomState): "battle" | "waiting_room" {
    if (
      room.kind === "battle" &&
      (!room.battle?.chatStarted ||
        room.battle.coordination?.phase === "between_rounds")
    ) {
      return "waiting_room";
    }

    return "battle";
  }

  private prepareBattleChatForPhaseTransition(
    previous: LiveRoomState,
    next: LiveRoomState
  ): LiveRoomState {
    const previousPhase = previous.battle?.coordination?.phase,
      nextPhase = next.battle?.coordination?.phase;
    if (
      !(
        previousPhase &&
        nextPhase &&
        previousPhase !== nextPhase &&
        next.battle
      )
    ) {
      return next;
    }

    if (
      previousPhase === "waiting_room" &&
      nextPhase !== "scheduled" &&
      nextPhase !== "waiting_room"
    ) {
      return {
        ...next,
        battle: { ...next.battle, chatStarted: true },
        chat: next.chat.map((message) =>
          message.chatScope === "waiting_room"
            ? { ...message, chatScope: "battle" as const }
            : message
        ),
      };
    }

    if (previousPhase === "between_rounds" && nextPhase !== "between_rounds") {
      return {
        ...next,
        chat: next.chat.filter(
          (message) => message.chatScope !== "waiting_room"
        ),
      };
    }

    return next;
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

  private async broadcastStateChange(
    previous: LiveRoomState,
    next: LiveRoomState
  ) {
    let announcedRoom = this.prepareBattleChatForPhaseTransition(
      previous,
      next
    );
    if (announcedRoom !== next) {
      await this.persist(announcedRoom);
    }
    const phaseChanged =
      previous.battle?.coordination?.phase !== next.battle?.coordination?.phase;

    if (phaseChanged && next.battle?.coordination?.phase) {
      const phase = next.battle.coordination.phase;
      this.broadcast({
        action:
          phase === "waiting_room" ||
          phase === "round_intro" ||
          phase === "between_rounds"
            ? "open"
            : (phase === "ended" || phase === "battle_result"
              ? "close"
              : "sync"),
        activeArtistUserId: next.battle.coordination.activeArtistUserId,
        phase,
        type: "battle.bot_stage_control",
      });
      const message = battleBotMessageForPhase(announcedRoom, phase);
      if (message) {
        announcedRoom = await this.appendBotChatMessage(announcedRoom, message);
      }
      this.broadcast({
        phase,
        phaseEndsAt: next.battle.coordination.phaseEndsAt,
        roundNumber: next.battle.coordination.roundNumber,
        type: "battle.phase_changed",
        version: next.battle.coordination.lastTransitionVersion,
      });
    }
    const removedUserIds =
      announcedRoom.battle?.coordination?.removedUserIds ?? [];
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
    const battleEnded =
      announcedRoom.kind === "battle" &&
      announcedRoom.battle?.coordination?.phase === "ended";
    this.broadcast({ room: this.publicState(announcedRoom), type: "state" });
    if (battleEnded) {
      for (const socket of this.ctx.getWebSockets()) {
        socket.close(4000, "The battle room has ended.");
      }
    }
    if (announcedRoom.kind === "battle") {
      this.publishBattleDirectoryUpdate(announcedRoom.id);
    }
  }

  private publishBattleDirectoryUpdate(battleId: string) {
    const directory = (
      this.env as {
        BATTLE_DIRECTORY?: DurableObjectNamespace<BattleDirectoryDurableObject>;
      }
    ).BATTLE_DIRECTORY;
    if (!directory) {
      return;
    }
    this.ctx.waitUntil(
      directory
        .getByName("public")
        .publish(battleId)
        .catch(() => {})
    );
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
      !isEndedBattleRoom(room) &&
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

  private async appendBotChatMessage(
    room: LiveRoomState,
    message: string
  ): Promise<LiveRoomState> {
    const chatMessage: LiveRoomChatMessage = {
        avatarUrl: "/soundkit-default-avatar.svg",
        chatScope: this.chatScopeForRoom(room),
        id: `${BATTLE_BOT_USER_ID}:${crypto.randomUUID()}`,
        message,
        sentAt: new Date().toISOString(),
        userId: BATTLE_BOT_USER_ID,
        userName: "BattleBot",
        userRole: "host",
      },
      nextChat = [...room.chat, chatMessage].slice(-MAX_CHAT_MESSAGES),
      nextRoom = { ...room, chat: nextChat };

    await this.persistChat(nextChat);
    this.roomState = nextRoom;
    this.broadcast({ message: chatMessage, type: "chat" });
    return nextRoom;
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
        avatarUrl: identity.avatarUrl,
        chatScope: this.chatScopeForRoom(room),
        id: crypto.randomUUID(),
        message,
        sentAt: new Date().toISOString(),
        userId: identity.userId,
        userName: identity.displayName,
        userRole: identity.role,
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

  private connectedArtistUserIds(room: LiveRoomState): string[] {
    const artistIds = new Set(
      room.battle?.artists.map((artist) => artist.id) ?? []
    );
    return [
      ...new Set(
        this.ctx
          .getWebSockets()
          .map(
            (socket) =>
              (
                socket.deserializeAttachment() as LiveRoomSocketAttachment | null
              )?.userId
          )
          .filter(
            (userId): userId is string =>
              typeof userId === "string" && artistIds.has(userId)
          )
      ),
    ];
  }

  private async reconcileAutomaticNoShow(
    room: LiveRoomState
  ): Promise<boolean> {
    const outcome = room.battle?.coordination?.outcome;
    if (
      !outcome ||
      outcome.kind !== "canceled" ||
      outcome.reason !== "artist_unavailable"
    ) {
      return true;
    }

    const reconciledAt =
      await this.ctx.storage.get<number>(NO_SHOW_RECONCILED_STORAGE_KEY);
    if (reconciledAt === outcome.recordedAt) {
      return true;
    }

    try {
      const artistIds = new Set(
          room.battle?.artists.map((artist) => artist.id) ?? []
        ),
        coordination = room.battle?.coordination,
        audienceUserIds = [
          ...(coordination?.admittedUserIds ?? []),
          ...(coordination?.queuedUserIds ?? []),
          ...(coordination?.waitingUserIds ?? []),
          ...(coordination?.requiredVoterUserIds ?? []),
        ].filter(
          (userId, index, userIds) =>
            userId !== "anonymous" &&
            !artistIds.has(userId) &&
            userIds.indexOf(userId) === index
        );
      await finalizeBattleNoShow({
        audienceUserIds,
        battleId: room.battle?.coordination?.battleId ?? room.id,
        recordedAt: outcome.recordedAt,
      });
      await this.ctx.storage.put(
        NO_SHOW_RECONCILED_STORAGE_KEY,
        outcome.recordedAt
      );
      return true;
    } catch (error) {
      console.error("Automatic battle no-show reconciliation failed", {
        battleId: room.battle?.coordination?.battleId ?? room.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
      return false;
    }
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
      avatarUrl: request.headers.get("x-soundkit-live-avatar-url"),
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
