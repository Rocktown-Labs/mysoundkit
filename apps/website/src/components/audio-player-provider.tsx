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

const audioPlayerStorageKey = "soundkit.audio-player.v1";

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
  queue: PlayerTrack[];
  registerTogglePlay: (fn: (() => void) | null) => void;
  setCurrentTrack: (track: PlayerTrack | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setQueue: (queue: PlayerTrack[]) => void;
  setVisible: (visible: boolean) => void;
  togglePlay: () => void;
  visible: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const isPlayableSrc = (src: unknown): src is string =>
  // blob: URLs die with the tab session that created them, so never restore
  // them from localStorage (they render broken art and reject playback).
  typeof src === "string" && src.length > 0 && !src.startsWith("blob:");

const isPlayerTrack = (value: unknown): value is PlayerTrack => {
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
};

const EMPTY_PLAYER_STATE = {
  currentTrack: null as PlayerTrack | null,
  queue: [] as PlayerTrack[],
  visible: false,
};

const readStoredPlayerState = () => {
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
      visible?: unknown;
    };

    const currentTrack = isPlayerTrack(parsed.currentTrack)
      ? parsed.currentTrack
      : null;
    const queue = Array.isArray(parsed.queue)
      ? parsed.queue.filter(isPlayerTrack)
      : [];

    return {
      currentTrack,
      queue,
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
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [visible, setVisible] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const togglePlayRef = useRef<(() => void) | null>(null);

  const registerTogglePlay = useCallback((fn: (() => void) | null) => {
    togglePlayRef.current = fn;
  }, []);

  const togglePlay = useCallback(() => {
    if (togglePlayRef.current) {
      togglePlayRef.current();
    }
  }, []);

  useEffect(() => {
    const stored = readStoredPlayerState();
    setCurrentTrack(stored.currentTrack);
    setQueue(stored.queue);
    setVisible(stored.visible);
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      audioPlayerStorageKey,
      JSON.stringify({ currentTrack, queue, visible })
    );
  }, [hasRestored, currentTrack, queue, visible]);

  const handleSetCurrentTrack = useCallback((track: PlayerTrack | null) => {
    setCurrentTrack(track);
    setVisible(Boolean(track));
  }, []);

  const addToQueue = useCallback(
    (track: PlayerTrack) => {
      if (queue.some((item) => item.id === track.id)) {
        return false;
      }
      setQueue([...queue, track]);
      return true;
    },
    [queue]
  );

  const value = useMemo(
    () => ({
      addToQueue,
      currentTrack,
      isPlaying,
      queue,
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
      queue,
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
