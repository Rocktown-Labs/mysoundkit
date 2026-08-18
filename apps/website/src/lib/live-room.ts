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
  ): Promise<LiveRoomState> => {
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

    return response.json() as Promise<LiveRoomState>;
  },
  wsUrlForRoom = (roomId: string) => {
    const url = new URL(`${API_BASE_URL}/v1/live/rooms/${roomId}/ws`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  };

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
        room?: LiveRoomState;
        type?: string;
      };

      if (payload.type === "state" && payload.room) {
        queryClient.setQueryData(liveRoomKey(roomId), payload.room);
      }
    });

    return () => socket.close();
  }, [queryClient, roomId]);

  const chatMutation = useMutation({
      mutationFn: (body: { message: string; userName?: string }) =>
        postLiveRoom(roomId, "chat", body),
      onSuccess: (room) => queryClient.setQueryData(liveRoomKey(roomId), room),
    }),
    voteMutation = useMutation({
      mutationFn: (body: {
        artistId: string;
        roundId: string;
        voterId?: string;
      }) => postLiveRoom(roomId, "vote", body),
      onSuccess: (room) => queryClient.setQueryData(liveRoomKey(roomId), room),
    });

  return {
    chat: chatMutation,
    query,
    vote: voteMutation,
  };
};
