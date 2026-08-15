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

const audioPlayerStorageKey = "soundkit.audio-player.v1",
  recentlyPlayedLimit = 20;

export interface PlayerTrack {
  album?: string;
  artist: string;
  cover?: string | null;
  autoplay?: boolean;
  duration?: number | null;
  id: string;
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
    visible: false,
  },
  readStoredPlayerState = () => {
    if (typeof window === "undefined") {
      return EMPTY_PLAYER_STATE;
    }

    try {
      const raw = window.localStorage.getItem(audioPlayerStorageKey);

      if (!raw) {
        return EMPTY_PLAYER_STATE;
      }

      const parsed = JSON.parse(raw) as {
          currentTrack?: unknown;
          queue?: unknown;
          recentlyPlayed?: unknown;
          visible?: unknown;
        },
        currentTrack = isPlayerTrack(parsed.currentTrack)
          ? parsed.currentTrack
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
      };
    } catch {
      return EMPTY_PLAYER_STATE;
    }
  };

export function AudioPlayerProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Always initialize empty so the first client render matches the
  // server-rendered HTML; restore persisted state after mount instead,
  // otherwise hydration fails (React error #418) and the app crashes.
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null),
    [isPlaying, setIsPlaying] = useState(false),
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
    const stored = readStoredPlayerState();
    setCurrentTrack(stored.currentTrack);
    setQueue(stored.queue);
    setRecentlyPlayed(stored.recentlyPlayed);
    setVisible(stored.visible);
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      audioPlayerStorageKey,
      JSON.stringify({ currentTrack, queue, recentlyPlayed, visible })
    );
  }, [hasRestored, currentTrack, queue, recentlyPlayed, visible]);

  const handleSetCurrentTrack = useCallback((track: PlayerTrack | null) => {
      setCurrentTrack(track);
      setVisible(Boolean(track));
    }, []),
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
        setCurrentTrack: handleSetCurrentTrack,
        setIsPlaying,
        setQueue,
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
