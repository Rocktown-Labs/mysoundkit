import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { API_BASE_URL, API_V1_URL } from "./api";

export type LiveRoomKind = "battle" | "party" | "stream";

export interface LiveRoomChatMessage {
  id: string;
  message: string;
  sentAt: string;
  userName: string;
}

export interface LiveRoomLyricsLine {
  endMs: number;
  startMs: number;
  text: string;
}

export interface LiveRoomTrack {
  artistName: string;
  coverArtUrl: string;
  durationMs: number;
  id: string;
  lyrics: LiveRoomLyricsLine[];
  status: "played" | "playing" | "queued";
  title: string;
}

export interface LiveRoomArtist {
  avatarUrl: string;
  id: string;
  isMuted: boolean;
  name: string;
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

export interface LiveRoomState {
  battle?: {
    artists: [LiveRoomArtist, LiveRoomArtist];
    currentRoundId: string;
    rounds: LiveBattleRound[];
    tiePolicy: string;
  };
  chat: LiveRoomChatMessage[];
  createdAt: string;
  currentTrackId: string;
  hostName: string;
  id: string;
  kind: LiveRoomKind;
  status: "ended" | "live" | "upcoming";
  summary: string;
  title: string;
  tracklist: LiveRoomTrack[];
  viewerCount: number;
}

const liveRoomKey = (roomId: string) => ["live-room", roomId] as const,
  appendChatMessage = (
    room: LiveRoomState | undefined,
    message: LiveRoomChatMessage
  ) =>
    room
      ? {
          ...room,
          chat: room.chat.some((entry) => entry.id === message.id)
            ? room.chat
            : [...room.chat, message].slice(-80),
        }
      : room,
  fetchLiveRoom = async (roomId: string): Promise<LiveRoomState> => {
    const response = await fetch(`${API_V1_URL}/live/rooms/${roomId}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Unable to load live room: ${response.status}`);
    }

    return response.json() as Promise<LiveRoomState>;
  },
  postLiveRoom = async (
    roomId: string,
    path: "chat" | "vote",
    body: unknown
  ): Promise<LiveRoomChatResult | LiveRoomState> => {
    const response = await fetch(`${API_V1_URL}/live/rooms/${roomId}/${path}`, {
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(
        payload?.message ?? `Live room update failed: ${response.status}`
      );
    }

    return response.json() as Promise<LiveRoomChatResult | LiveRoomState>;
  },
  wsUrlForRoom = (roomId: string) => {
    const url = new URL(`${API_BASE_URL}/v1/live/rooms/${roomId}/ws`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  };

interface LiveRoomChatResult {
  message: LiveRoomChatMessage | null;
  rateLimited?: boolean;
  room: LiveRoomState;
}

export const useLiveRoom = (roomId: string) => {
  const queryClient = useQueryClient(),
    query = useQuery({
      enabled: Boolean(roomId),
      queryFn: () => fetchLiveRoom(roomId),
      queryKey: liveRoomKey(roomId),
      refetchInterval: 30_000,
      retry: false,
    });

  useEffect(() => {
    if (typeof window === "undefined" || !roomId) {
      return;
    }

    const socket = new WebSocket(wsUrlForRoom(roomId));

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as {
        message?: LiveRoomChatMessage;
        room?: LiveRoomState;
        type?: string;
      };

      if (payload.type === "state" && payload.room) {
        queryClient.setQueryData(liveRoomKey(roomId), payload.room);
      } else if (payload.type === "chat" && payload.message) {
        queryClient.setQueryData<LiveRoomState | undefined>(
          liveRoomKey(roomId),
          (room) =>
            appendChatMessage(room, payload.message as LiveRoomChatMessage)
        );
      }
    });

    return () => socket.close();
  }, [queryClient, roomId]);

  const chatMutation = useMutation({
      mutationFn: (body: { message: string; userName?: string }) =>
        postLiveRoom(roomId, "chat", body),
      onSuccess: (result) => {
        if ("message" in result && result.message) {
          queryClient.setQueryData<LiveRoomState | undefined>(
            liveRoomKey(roomId),
            (room) =>
              appendChatMessage(room, result.message as LiveRoomChatMessage)
          );
          return;
        }
        if ("room" in result) {
          queryClient.setQueryData(liveRoomKey(roomId), result.room);
        }
      },
    }),
    voteMutation = useMutation({
      mutationFn: (body: {
        artistId: string;
        roundId: string;
        voterId?: string;
      }) => postLiveRoom(roomId, "vote", body),
      onSuccess: (result) => {
        if ("room" in result) {
          queryClient.setQueryData(liveRoomKey(roomId), result.room);
        }
      },
    });

  return {
    chat: chatMutation,
    chatMessages: query.data?.chat ?? [],
    query,
    vote: voteMutation,
  };
};
