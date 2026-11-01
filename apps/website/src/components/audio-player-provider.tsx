"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { isStoredVideoMetadata } from "@/lib/player-media";
import type { PlayerVideoMetadata } from "@/lib/player-media";

const audioPlayerStorageKey = "soundkit.audio-player.v1",
  recentlyPlayedLimit = 20;

export interface PlayerTrack {
  album?: string;
  artist: string;
  cover?: string | null;
  autoplay?: boolean;
  duration?: number | null;
  id: string;
  mediaType?: "audio" | "video";
  video?: PlayerVideoMetadata;
  src: string;
  sourceType?: "battle" | "library" | "listening_party" | "vod";
  artistHref?: string | null;
  title: string;
  trackHref?: string | null;
}

interface AudioPlayerContextValue {
  addToQueue: (track: PlayerTrack) => boolean;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  markRecentlyPlayed: (track: PlayerTrack) => void;
  queue: PlayerTrack[];
  recentlyPlayed: PlayerTrack[];
  registerTogglePlay: (fn: (() => void) | null) => void;
  setCurrentTrack: (track: PlayerTrack | null) => void;
  repeatMode: "off" | "all" | "one";
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  setIsPlaying: (playing: boolean) => void;
  setQueue: (queue: PlayerTrack[]) => void;
  setVisible: (visible: boolean) => void;
  togglePlay: () => void;
  visible: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null),
  isPlayableSrc = (src: unknown): src is string =>
    // blob: URLs die with the tab session that created them, so never restore
    // them from localStorage (they render broken art and reject playback).
    typeof src === "string" && src.length > 0 && !src.startsWith("blob:"),
  isPlayerTrack = (value: unknown): value is PlayerTrack => {
    if (!(value && typeof value === "object")) {
      return false;
    }

    const track = value as Partial<PlayerTrack>;

    return (
      (track.mediaType === undefined ||
        track.mediaType === "audio" ||
        (track.mediaType === "video" && isStoredVideoMetadata(track.video))) &&
      typeof track.artist === "string" &&
      typeof track.id === "string" &&
      isPlayableSrc(track.src) &&
      typeof track.title === "string"
    );
  },
  EMPTY_PLAYER_STATE = {
    currentTrack: null as PlayerTrack | null,
    queue: [] as PlayerTrack[],
    recentlyPlayed: [] as PlayerTrack[],
    repeatMode: "off" as "off" | "all" | "one",
    visible: false,
  },
  readStoredPlayerState = (storageKey: string): typeof EMPTY_PLAYER_STATE => {
    if (typeof window === "undefined") {
      return EMPTY_PLAYER_STATE;
    }

    try {
      window.localStorage.removeItem(audioPlayerStorageKey);
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        return EMPTY_PLAYER_STATE;
      }

      const parsed = JSON.parse(raw) as {
          currentTrack?: unknown;
          queue?: unknown;
          recentlyPlayed?: unknown;
          visible?: unknown;
          repeatMode?: unknown;
        },
        currentTrack = isPlayerTrack(parsed.currentTrack)
          ? { ...parsed.currentTrack, autoplay: false }
          : null,
        queue = Array.isArray(parsed.queue)
          ? parsed.queue.filter(isPlayerTrack)
          : [],
        recentlyPlayed = Array.isArray(parsed.recentlyPlayed)
          ? parsed.recentlyPlayed
              .filter(isPlayerTrack)
              .slice(0, recentlyPlayedLimit)
          : [];

      return {
        currentTrack,
        queue,
        recentlyPlayed,
        // Only restore visibility when there is a playable track to show.
        visible: parsed.visible === true && currentTrack !== null,
        repeatMode:
          parsed.repeatMode === "all" || parsed.repeatMode === "one"
            ? parsed.repeatMode
            : ("off" as const),
      };
    } catch {
      return EMPTY_PLAYER_STATE;
    }
  };

export function AudioPlayerProvider({
  children,
  storageScope = "anonymous",
}: Readonly<{ children: ReactNode; storageScope?: string }>) {
  // Always initialize empty so the first client render matches the
  // server-rendered HTML; restore persisted state after mount instead,
  // otherwise hydration fails (React error #418) and the app crashes.
  const storageKey = `${audioPlayerStorageKey}:${storageScope}`,
    [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null),
    [isPlaying, setIsPlaying] = useState(false),
    [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off"),
    [queue, setQueue] = useState<PlayerTrack[]>([]),
    [recentlyPlayed, setRecentlyPlayed] = useState<PlayerTrack[]>([]),
    [visible, setVisible] = useState(false),
    [hasRestored, setHasRestored] = useState(false),
    togglePlayRef = useRef<(() => void) | null>(null),
    registerTogglePlay = useCallback((fn: (() => void) | null) => {
      togglePlayRef.current = fn;
    }, []),
    togglePlay = useCallback(() => {
      if (togglePlayRef.current) {
        togglePlayRef.current();
      }
    }, []);

  useEffect(() => {
    const stored = readStoredPlayerState(storageKey);
    setCurrentTrack(stored.currentTrack);
    setQueue(stored.queue);
    setRecentlyPlayed(stored.recentlyPlayed);
    setRepeatMode(stored.repeatMode);
    setVisible(stored.visible);
    setHasRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          currentTrack,
          queue,
          recentlyPlayed,
          repeatMode,
          visible,
        })
      );
    } catch {
      // Storage quotas and private browsing must not stop active playback.
    }
  }, [
    hasRestored,
    storageKey,
    currentTrack,
    queue,
    recentlyPlayed,
    repeatMode,
    visible,
  ]);

  const handleSetCurrentTrack = useCallback(
      (track: PlayerTrack | null) => {
        setCurrentTrack(track);
        if (
          track?.id !== currentTrack?.id ||
          track?.src !== currentTrack?.src
        ) {
          setIsPlaying(false);
        }
        setVisible(Boolean(track));
      },
      [currentTrack]
    ),
    addToQueue = useCallback(
      (track: PlayerTrack) => {
        if (queue.some((item) => item.id === track.id)) {
          return false;
        }
        setQueue((currentQueue) => [...currentQueue, track]);
        return true;
      },
      [queue]
    ),
    markRecentlyPlayed = useCallback((track: PlayerTrack) => {
      setRecentlyPlayed((currentHistory) =>
        [track, ...currentHistory.filter((item) => item.id !== track.id)].slice(
          0,
          recentlyPlayedLimit
        )
      );
    }, []),
    value = useMemo(
      () => ({
        addToQueue,
        currentTrack,
        isPlaying,
        markRecentlyPlayed,
        queue,
        recentlyPlayed,
        registerTogglePlay,
        repeatMode,
        setCurrentTrack: handleSetCurrentTrack,
        setIsPlaying,
        setQueue,
        setRepeatMode,
        setVisible,
        togglePlay,
        visible,
      }),
      [
        addToQueue,
        currentTrack,
        isPlaying,
        handleSetCurrentTrack,
        markRecentlyPlayed,
        queue,
        recentlyPlayed,
        repeatMode,
        registerTogglePlay,
        togglePlay,
        visible,
      ]
    );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);

  if (!context) {
    throw new Error("useAudioPlayer must be used inside AudioPlayerProvider.");
  }

  return context;
};
