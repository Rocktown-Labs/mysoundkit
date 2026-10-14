/* oxlint-disable one-var, sort-vars, sort-keys */
/* eslint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary, react/set-state-in-effect, no-void, unicorn/prefer-add-event-listener */
import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE_URL, API_V1_URL } from "@/lib/api";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export type LiveRoomKind = "battle" | "listening_party" | "stream";
export type LiveRoomViewerRole = string;

export interface LiveRoomTrack {
  artistName: string;
  coverArtUrl: string;
  durationMs: number;
  href?: null | string;
  id: string;
  lyrics: { endMs: number; startMs: number; text: string }[];
  status: "played" | "playing" | "queued";
  title: string;
}

export interface LiveRoomArtist {
  avatarUrl: string;
  id: string;
  isMuted: boolean;
  name: string;
  rank?: null | number | string;
  roundsWon: number;
  stagePosition: "left" | "right";
  verified: boolean;
}

export interface LiveBattleRound {
  artistATrack: LiveRoomTrack;
  artistBTrack: LiveRoomTrack;
  id: string;
  isTiebreaker: boolean;
  number: number;
  status: "complete" | "live" | "queued" | "voting";
  voteTotals: Record<string, number>;
  winnerArtistId: null | string;
}

export interface LiveRoomChatMessage {
  avatarUrl?: null | string;
  chatScope?: "battle" | "waiting_room";
  id: string;
  message: string;
  sentAt: string;
  userId?: string;
  userName: string;
  userRole?: LiveRoomViewerRole;
}

export interface LiveRoomState {
  battle?: {
    artists: [LiveRoomArtist, LiveRoomArtist];
    coordination?: {
      format: "best_of_3" | "best_of_5" | "best_of_7";
      phase: string;
      phaseEndsAt: null | number;
      phaseStartedAt: number;
      roundNumber: number;
      winnerUserId: null | string;
    };
    currentRoundId: string;
    phase?: string;
    queueSize?: number;
    replayStatus?: "available" | "none" | "processing";
    rounds: LiveBattleRound[];
    viewerQueueStatus?: "admitted" | "queued" | "waiting" | null;
    waitingRoomCount?: number;
  };
  chat: LiveRoomChatMessage[];
  createdAt: string;
  hostName: string;
  id: string;
  kind: LiveRoomKind;
  party?: {
    playback: {
      hostMode: "off_camera" | "on_camera";
      hostUserId: string;
      mediaAvailable?: boolean;
      playbackState: "paused" | "playing";
      positionMs: number;
      stateChangedAt: number;
      trackId: null | string;
      trackIndex: number;
    };
  };
  role?: LiveRoomViewerRole;
  serverNow?: number;
  startsAt?: null | string;
  status: "ended" | "live" | "upcoming";
  stream?: {
    errorMessage?: null | string;
    ingestStatus:
      | "connected"
      | "disconnected"
      | "error"
      | "idle"
      | "reconnecting";
    nowPlaying?: null | LiveRoomTrack;
    replayStatus: "available" | "none" | "processing";
  };
  summary: string;
  title: string;
  tracklist: LiveRoomTrack[];
  viewerCount: number;
}

const WS_RECONNECT_DELAY_MS = 2500;

export const fetchLiveRoom = async (roomId: string): Promise<LiveRoomState> => {
  const response = await authenticatedFetch(
    `${API_V1_URL}/live/rooms/${encodeURIComponent(roomId)}`
  );
  if (!response.ok) {
    throw new Error(`Unable to load live room: ${response.status}`);
  }
  return (await response.json()) as LiveRoomState;
};

const wsUrlForRoom = (roomId: string) =>
  `${API_BASE_URL.replace(/^https:/u, "wss:").replace(/^http:/u, "ws:")}/v1/live/rooms/${encodeURIComponent(roomId)}/ws`;

/** Best-effort live-room mutation; the server returns the fresh room state. */
export const postLiveRoom = async (
  roomId: string,
  path: "chat" | "leave" | "vote",
  body: unknown
): Promise<LiveRoomState> => {
  const response = await authenticatedFetch(
    `${API_V1_URL}/live/rooms/${encodeURIComponent(roomId)}/${path}`,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error(`Live room request failed: ${response.status}`);
  }
  return (await response.json().catch(() => null)) as LiveRoomState;
};

/**
 * Loads a live room and keeps it fresh: initial REST fetch, then the Durable
 * Object WebSocket pushes state changes (votes, chat, phase transitions).
 * Falls back to polling if the socket cannot connect — everything here is
 * Expo Go-safe (no native modules).
 */
export function useLiveRoom(roomId: string) {
  const [room, setRoom] = useState<LiveRoomState | null>(null),
    [error, setError] = useState<null | string>(null),
    [isConnected, setIsConnected] = useState(false),
    socketRef = useRef<WebSocket | null>(null),
    closedRef = useRef(false),
    retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const state = await fetchLiveRoom(roomId);
      setRoom(state);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this room right now."
      );
    }
  }, [roomId]);

  useEffect(() => {
    closedRef.current = false;
    void load();

    const connect = () => {
      if (closedRef.current) {
        return;
      }
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrlForRoom(roomId));
      } catch {
        // Polling fallback covers connectivity failures.
        retryRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        return;
      }
      socketRef.current = socket;
      socket.onopen = () => {
        setIsConnected(true);
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as
            | { room?: LiveRoomState }
            | LiveRoomState;
          const state = "room" in payload ? payload.room : payload;
          if (state && typeof state === "object" && "id" in state) {
            setRoom(state as LiveRoomState);
          }
        } catch {
          // Ignore malformed frames; the next snapshot replaces them.
        }
      };
      socket.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        if (!closedRef.current) {
          retryRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
        }
      };
      socket.onerror = () => {
        socket.close();
      };
    };
    connect();

    // Polling fallback while the socket is down.
    const poll = setInterval(() => {
      if (!socketRef.current && !closedRef.current) {
        void load();
      }
    }, 10_000);

    return () => {
      closedRef.current = true;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
      }
      clearInterval(poll);
      socketRef.current?.close(1000, "Live room screen unmounted");
      socketRef.current = null;
    };
  }, [load, roomId]);

  return { error, isConnected, load, room, setRoom };
}

export const appendChatMessage = (
  room: LiveRoomState | null,
  message: LiveRoomChatMessage
): LiveRoomState | null =>
  room
    ? {
        ...room,
        chat: room.chat.some((entry) => entry.id === message.id)
          ? room.chat
          : [...room.chat, message].slice(-80),
      }
    : room;
