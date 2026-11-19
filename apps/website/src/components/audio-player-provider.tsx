"use client";

/* eslint-disable one-var, sort-vars, react/set-state-in-effect */
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

export type { PlayerTrack } from "@/lib/audio-player-storage";

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
const migratedStorageKeys = new Set<string>();

export function AudioPlayerProvider({
  children,
  storageScope = "anonymous",
}: Readonly<{ children: ReactNode; storageScope?: string }>) {
  // Always initialize empty so the first client render matches the
  // server-rendered HTML; restore persisted state after mount instead,
  // otherwise hydration fails (React error #418) and the app crashes.
  const storageKey = `${AUDIO_PLAYER_STORAGE_KEY}:${storageScope}`;
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<PlayerRepeatMode>("off");
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<PlayerTrack[]>([]);
  const [visible, setVisible] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const togglePlayRef = useRef<(() => void) | null>(null);

  const registerTogglePlay = useCallback((fn: (() => void) | null) => {
    togglePlayRef.current = fn;
  }, []);

  const togglePlay = useCallback(() => {
    if (togglePlayRef.current) {
      togglePlayRef.current();
    }
  }, []);

  const handleSetQueue = useCallback((nextQueue: PlayerTrack[]) => {
    queueRef.current = nextQueue;
    setQueue(nextQueue);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!migratedStorageKeys.has(storageKey)) {
      migrateLegacyPlayerStorage(window.localStorage, storageKey, {
        removeLegacy: storageScope !== "anonymous",
      });
      migratedStorageKeys.add(storageKey);
    }

    const stored = readStoredPlayerState(window.localStorage, storageKey);
    currentTrackRef.current = stored.currentTrack;
    queueRef.current = stored.queue;
    setCurrentTrack(stored.currentTrack);
    setQueue(stored.queue);
    setRecentlyPlayed(stored.recentlyPlayed);
    setRepeatMode(stored.repeatMode);
    setVisible(stored.visible);
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

  const handleSetCurrentTrack = useCallback((track: PlayerTrack | null) => {
    const previous = currentTrackRef.current;
    currentTrackRef.current = track;
    setCurrentTrack(track);
    if (track?.id !== previous?.id || track?.src !== previous?.src) {
      setIsPlaying(false);
    }
    setVisible(Boolean(track));
  }, []);

  const addToQueue = useCallback((track: PlayerTrack) => {
    if (queueRef.current.some((item) => item.id === track.id)) {
      return false;
    }

    const nextQueue = [...queueRef.current, track];
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    return true;
  }, []);

  const markRecentlyPlayed = useCallback((track: PlayerTrack) => {
    setRecentlyPlayed((currentHistory) =>
      appendRecentlyPlayed(currentHistory, track)
    );
  }, []);

  const value = useMemo(
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
