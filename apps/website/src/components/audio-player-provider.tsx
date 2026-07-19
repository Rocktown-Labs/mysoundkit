"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

const audioPlayerStorageKey = "soundkit.audio-player.v1";

export interface PlayerTrack {
  album?: string;
  artist: string;
  cover?: string | null;
  duration?: number | null;
  id: string;
  src: string;
  artistHref?: string | null;
  title: string;
  trackHref?: string | null;
}

interface AudioPlayerContextValue {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  setCurrentTrack: (track: PlayerTrack | null) => void;
  setQueue: (queue: PlayerTrack[]) => void;
  setVisible: (visible: boolean) => void;
  visible: boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const isPlayerTrack = (value: unknown): value is PlayerTrack => {
  if (!(value && typeof value === "object")) {
    return false;
  }

  const track = value as Partial<PlayerTrack>;

  return (
    typeof track.artist === "string" &&
    typeof track.id === "string" &&
    typeof track.src === "string" &&
    typeof track.title === "string"
  );
};

const readStoredPlayerState = () => {
  if (typeof window === "undefined") {
    return {
      currentTrack: null as PlayerTrack | null,
      queue: [] as PlayerTrack[],
      visible: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(audioPlayerStorageKey);

    if (!raw) {
      return {
        currentTrack: null as PlayerTrack | null,
        queue: [] as PlayerTrack[],
        visible: false,
      };
    }

    const parsed = JSON.parse(raw) as {
      currentTrack?: unknown;
      queue?: unknown;
      visible?: unknown;
    };

    return {
      currentTrack: isPlayerTrack(parsed.currentTrack)
        ? parsed.currentTrack
        : null,
      queue: Array.isArray(parsed.queue)
        ? parsed.queue.filter(isPlayerTrack)
        : [],
      visible: parsed.visible === true,
    };
  } catch {
    return {
      currentTrack: null as PlayerTrack | null,
      queue: [] as PlayerTrack[],
      visible: false,
    };
  }
};

export function AudioPlayerProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [initialState] = useState(readStoredPlayerState);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(
    initialState.currentTrack
  );
  const [queue, setQueue] = useState<PlayerTrack[]>(initialState.queue);
  const [visible, setVisible] = useState(initialState.visible);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      audioPlayerStorageKey,
      JSON.stringify({ currentTrack, queue, visible })
    );
  }, [currentTrack, queue, visible]);

  const handleSetCurrentTrack = useCallback((track: PlayerTrack | null) => {
    setCurrentTrack(track);
    setVisible(Boolean(track));
  }, []);

  const value = useMemo(
    () => ({
      currentTrack,
      queue,
      setCurrentTrack: handleSetCurrentTrack,
      setQueue,
      setVisible,
      visible,
    }),
    [currentTrack, handleSetCurrentTrack, queue, visible]
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
