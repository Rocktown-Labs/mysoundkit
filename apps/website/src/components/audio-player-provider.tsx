"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

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

export function AudioPlayerProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [visible, setVisible] = useState(false);

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
