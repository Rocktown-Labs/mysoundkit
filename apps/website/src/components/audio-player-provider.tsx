"use client";

/* eslint-disable one-var, sort-vars, react/immutability, react/preserve-manual-memoization */
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

import {
  AUDIO_PLAYER_STORAGE_KEY,
  appendRecentlyPlayed,
  migrateLegacyPlayerStorage,
  readStoredPlayerState,
  sanitizePlayerStateForStorage,
} from "@/lib/audio-player-storage";
import type { PlayerRepeatMode, PlayerTrack } from "@/lib/audio-player-storage";

export type { PlayerRepeatMode, PlayerTrack } from "@/lib/audio-player-storage";

interface AudioPlayerContextValue {
  addToQueue: (track: PlayerTrack) => boolean;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  markRecentlyPlayed: (track: PlayerTrack) => void;
  queue: PlayerTrack[];
  recentlyPlayed: PlayerTrack[];
  registerTogglePlay: (fn: (() => void) | null) => void;
  repeatMode: PlayerRepeatMode;
  setCurrentTrack: (track: PlayerTrack | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setQueue: (queue: PlayerTrack[]) => void;
  setRepeatMode: (mode: PlayerRepeatMode) => void;
  setVisible: (visible: boolean) => void;
  togglePlay: () => void;
  visible: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({
  children,
  storageScope = "anonymous",
}: Readonly<{ children: ReactNode; storageScope?: string }>) {
  // Always initialize empty so the first client render matches the
  // server-rendered HTML; restore persisted state after mount instead,
  // otherwise hydration fails (React error #418) and the app crashes.
  const storageKey = `${AUDIO_PLAYER_STORAGE_KEY}:${storageScope}`,
    [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null),
    [isPlaying, setIsPlaying] = useState(false),
    [repeatMode, setRepeatMode] = useState<PlayerRepeatMode>("off"),
    [queue, setQueue] = useState<PlayerTrack[]>([]),
    [recentlyPlayed, setRecentlyPlayed] = useState<PlayerTrack[]>([]),
    [visible, setVisible] = useState(false),
    [hasRestored, setHasRestored] = useState(false),
    currentTrackRef = useRef<PlayerTrack | null>(null),
    queueRef = useRef<PlayerTrack[]>([]),
    togglePlayRef = useRef<(() => void) | null>(null),
    registerTogglePlay = useCallback((fn: (() => void) | null) => {
      togglePlayRef.current = fn;
    }, []),
    togglePlay = useCallback(() => {
      if (togglePlayRef.current) {
        togglePlayRef.current();
      }
    }, []),
    handleSetQueue = useCallback((nextQueue: PlayerTrack[]) => {
      queueRef.current = nextQueue;
      setQueue(nextQueue);
    }, []);

  // Post-mount hydration-safe restore from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storage = window.localStorage;
      migrateLegacyPlayerStorage(storage, storageKey, {
        removeLegacy: storageScope !== "anonymous",
      });

      const stored = readStoredPlayerState(storage, storageKey);
      currentTrackRef.current = stored.currentTrack;
      queueRef.current = stored.queue;
      // eslint-disable-next-line react/set-state-in-effect
      setCurrentTrack(stored.currentTrack);
      setQueue(stored.queue);
      setRecentlyPlayed(stored.recentlyPlayed);
      setRepeatMode(stored.repeatMode);
      setVisible(stored.visible);
    } catch {
      // localStorage may throw SecurityError in sandboxed/private contexts.
    }
    setHasRestored(true);
  }, [storageKey, storageScope]);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") {
      return;
    }

    try {
      const persistable = sanitizePlayerStateForStorage({
        currentTrack,
        queue,
        recentlyPlayed,
        repeatMode,
        visible,
      });

      window.localStorage.setItem(storageKey, JSON.stringify(persistable));
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

  const addToQueue = useCallback((track: PlayerTrack) => {
      if (queueRef.current.some((item) => item.id === track.id)) {
        return false;
      }

      const nextQueue = [...queueRef.current, track];
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      return true;
    }, []),
    handleSetCurrentTrack = useCallback((track: PlayerTrack | null) => {
      const previous = currentTrackRef.current;
      currentTrackRef.current = track;
      setCurrentTrack(track);
      if (track?.id !== previous?.id || track?.src !== previous?.src) {
        setIsPlaying(false);
      }
      setVisible(Boolean(track));
    }, []),
    markRecentlyPlayed = useCallback((track: PlayerTrack) => {
      setRecentlyPlayed((currentHistory) =>
        appendRecentlyPlayed(currentHistory, track)
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
        setQueue: handleSetQueue,
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
        handleSetQueue,
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
