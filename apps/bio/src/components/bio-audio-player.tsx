/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/memo-dependencies, react/preserve-manual-memoization, react/immutability, react/exhaustive-effect-dependencies, promise/prefer-await-to-then */
"use client";

import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  ListMusic,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { buildSoundKitWebUrl } from "@/lib/api";
import type { BioTrack } from "@/lib/api";

const bioAudioPlayerStorageKey = "soundkit.bio.audio-player.v1";

interface BioAudioPlayerContextValue {
  addToQueue: (track: BioTrack) => boolean;
  clearQueue: () => void;
  currentTrack: BioTrack | null;
  duration: number;
  isMuted: boolean;
  isPlaying: boolean;
  isQueueOpen: boolean;
  nextTrack: () => void;
  playProjectTracks: (tracks: BioTrack[]) => void;
  playTrack: (track: BioTrack, queue?: BioTrack[]) => void;
  previousTrack: () => void;
  progress: number;
  queue: BioTrack[];
  removeFromQueue: (index: number) => void;
  seek: (seconds: number) => void;
  setIsQueueOpen: (open: boolean) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
  toggleMute: () => void;
  togglePlay: () => void;
  volume: number;
}

const BioAudioPlayerContext = createContext<BioAudioPlayerContextValue | null>(
  null
);

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60),
    secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const isStoredTrack = (value: unknown): value is BioTrack => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const track = value as Partial<BioTrack>;
  return (
    typeof track.artistName === "string" &&
    typeof track.duration === "string" &&
    typeof track.id === "string" &&
    typeof track.title === "string" &&
    (typeof track.playbackUrl === "string" && track.playbackUrl.length > 0) ||
    (typeof track.previewUrl === "string" && track.previewUrl.length > 0)
  );
};

const readStoredPlayerState = () => {
  if (typeof window === "undefined") {
    return { currentTrack: null as BioTrack | null, queue: [] as BioTrack[] };
  }

  try {
    const raw = window.localStorage.getItem(bioAudioPlayerStorageKey);
    if (!raw) {
      return { currentTrack: null, queue: [] };
    }

    const parsed = JSON.parse(raw) as {
        currentTrack?: unknown;
        queue?: unknown;
      },
      currentTrack = isStoredTrack(parsed.currentTrack)
        ? parsed.currentTrack
        : null,
      queue = Array.isArray(parsed.queue)
        ? parsed.queue.filter(isStoredTrack)
        : [];

    return { currentTrack, queue };
  } catch {
    return { currentTrack: null, queue: [] };
  }
};

export function BioAudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null),
    [currentTrack, setCurrentTrack] = useState<BioTrack | null>(null),
    [queue, setQueue] = useState<BioTrack[]>([]),
    [isPlaying, setIsPlaying] = useState(false),
    [isQueueOpen, setIsQueueOpen] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(0),
    [volumeLevel, setVolumeLevel] = useState(0.85),
    [isMuted, setIsMuted] = useState(false),
    [hasRestored, setHasRestored] = useState(false),
    activeSrc = useMemo(() => {
      if (!currentTrack) {
        return "";
      }
      return currentTrack.playbackUrl || currentTrack.previewUrl || "";
    }, [currentTrack]),
    playTrack = useCallback(
      (track: BioTrack, newQueue?: BioTrack[]) => {
        if (!track.playbackUrl && !track.previewUrl) {
          return;
        }

        setCurrentTrack(track);
        if (newQueue && newQueue.length > 0) {
          setQueue(newQueue);
        } else if (!queue.some((item) => item.id === track.id)) {
          setQueue((prev) => [...prev, track]);
        }
        setIsPlaying(true);
        setProgress(0);
        setDuration(0);
      },
      [queue]
    ),
    playProjectTracks = useCallback((tracks: BioTrack[]) => {
      const playableTracks = tracks.filter(
        (track) => track.playbackUrl || track.previewUrl
      );
      if (playableTracks.length === 0) {
        return;
      }
      setQueue(playableTracks);
      setCurrentTrack(playableTracks[0] ?? null);
      setIsPlaying(true);
      setProgress(0);
      setDuration(0);
    }, []),
    addToQueue = useCallback((track: BioTrack) => {
      if (!track.playbackUrl && !track.previewUrl) {
        return false;
      }

      setQueue((prev) => {
        if (prev.some((item) => item.id === track.id)) {
          return prev;
        }
        return [...prev, track];
      });
      return true;
    }, []),
    removeFromQueue = useCallback(
      (index: number) => {
        const removedTrack = queue[index];
        if (!removedTrack) {
          return;
        }

        const nextQueue = queue.filter((_, queueIndex) => queueIndex !== index);
        setQueue(nextQueue);
        if (removedTrack.id !== currentTrack?.id) {
          return;
        }

        const replacement = nextQueue[index] ?? nextQueue[index - 1] ?? null;
        setCurrentTrack(replacement);
        setProgress(0);
        setDuration(0);
        setIsPlaying(Boolean(replacement));
      },
      [currentTrack, queue]
    ),
    clearQueue = useCallback(() => {
      setQueue(currentTrack ? [currentTrack] : []);
    }, [currentTrack]),
    togglePlay = useCallback(() => {
      if (!currentTrack) {
        return;
      }
      setIsPlaying((prev) => !prev);
    }, [currentTrack]),
    stop = useCallback(() => {
      setIsPlaying(false);
      setCurrentTrack(null);
      setProgress(0);
      setIsQueueOpen(false);
    }, []),
    currentIndex = useMemo(() => {
      if (!currentTrack || queue.length === 0) {
        return -1;
      }
      return queue.findIndex((item) => item.id === currentTrack.id);
    }, [currentTrack, queue]),
    nextTrack = useCallback(() => {
      if (queue.length === 0 || currentIndex === -1) {
        return;
      }
      const nextIndex = (currentIndex + 1) % queue.length,
        next = queue[nextIndex];
      if (next) {
        setCurrentTrack(next);
        setIsPlaying(true);
        setProgress(0);
        setDuration(0);
      }
    }, [currentIndex, queue]),
    previousTrack = useCallback(() => {
      if (queue.length === 0 || currentIndex === -1) {
        return;
      }
      // If more than 3 seconds in, restart current track
      if (progress > 3 && audioRef.current) {
        audioRef.current.currentTime = 0;
        setProgress(0);
        return;
      }
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length,
        prev = queue[prevIndex];
      if (prev) {
        setCurrentTrack(prev);
        setIsPlaying(true);
        setProgress(0);
        setDuration(0);
      }
    }, [currentIndex, progress, queue]),
    seek = useCallback((seconds: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = seconds;
        setProgress(seconds);
      }
    }, []),
    setVolume = useCallback(
      (val: number) => {
        const clamped = Math.max(0, Math.min(1, val));
        setVolumeLevel(clamped);
        if (audioRef.current) {
          audioRef.current.volume = clamped;
        }
        if (clamped > 0 && isMuted) {
          setIsMuted(false);
          if (audioRef.current) {
            audioRef.current.muted = false;
          }
        }
      },
      [isMuted]
    ),
    toggleMute = useCallback(() => {
      setIsMuted((prev) => {
        const next = !prev;
        if (audioRef.current) {
          audioRef.current.muted = next;
        }
        return next;
      });
    }, []);

  useEffect(() => {
    const stored = readStoredPlayerState();
    setCurrentTrack(stored.currentTrack);
    setQueue(stored.queue);
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        bioAudioPlayerStorageKey,
        JSON.stringify({ currentTrack, queue })
      );
    } catch {
      // Storage is optional; playback still works for this tab.
    }
  }, [currentTrack, hasRestored, queue]);

  // Sync audio element with state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, activeSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.muted = isMuted;
    audio.volume = volumeLevel;
  }, [isMuted, volumeLevel, activeSrc]);

  // Sync media session for background playback & mobile controls
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      artist: currentTrack.artistName,
      artwork: currentTrack.coverArtUrl
        ? [
            {
              sizes: "512x512",
              src: currentTrack.coverArtUrl,
              type: "image/jpeg",
            },
          ]
        : [],
      title: currentTrack.title,
    });

    navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler("nexttrack", nextTrack);
    navigator.mediaSession.setActionHandler("previoustrack", previousTrack);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    };
  }, [currentTrack, nextTrack, previousTrack]);

  const contextValue = useMemo<BioAudioPlayerContextValue>(
    () => ({
      addToQueue,
      clearQueue,
      currentTrack,
      duration,
      isMuted,
      isPlaying,
      isQueueOpen,
      nextTrack,
      playProjectTracks,
      playTrack,
      previousTrack,
      progress,
      queue,
      removeFromQueue,
      seek,
      setIsQueueOpen,
      setVolume,
      stop,
      toggleMute,
      togglePlay,
      volume: volumeLevel,
    }),
    [
      addToQueue,
      clearQueue,
      currentTrack,
      duration,
      isMuted,
      isPlaying,
      isQueueOpen,
      nextTrack,
      playProjectTracks,
      playTrack,
      previousTrack,
      progress,
      queue,
      removeFromQueue,
      seek,
      setIsQueueOpen,
      setVolume,
      stop,
      toggleMute,
      togglePlay,
      volumeLevel,
    ]
  );

  return (
    <BioAudioPlayerContext.Provider value={contextValue}>
      {children}
      {activeSrc ? (
        <audio
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onEnded={nextTrack}
          onError={() => setIsPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime || 0)}
          crossOrigin="use-credentials"
          preload="auto"
          ref={audioRef}
          src={activeSrc}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      <BioBottomPlayer />
    </BioAudioPlayerContext.Provider>
  );
}

export function useBioAudioPlayer() {
  const context = useContext(BioAudioPlayerContext);
  if (!context) {
    throw new Error(
      "useBioAudioPlayer must be used within a BioAudioPlayerProvider"
    );
  }
  return context;
}

export function BioBottomPlayer() {
  const {
    clearQueue,
    currentTrack,
    duration,
    isMuted,
    isPlaying,
    isQueueOpen,
    nextTrack,
    playTrack,
    previousTrack,
    progress,
    queue,
    removeFromQueue,
    seek,
    setIsQueueOpen,
    setVolume,
    stop,
    toggleMute,
    togglePlay,
    volume,
  } = useBioAudioPlayer();

  if (!currentTrack) {
    return null;
  }

  const soundKitTrackUrl = buildSoundKitWebUrl(
    `/tracks/${encodeURIComponent(currentTrack.id)}`,
    currentTrack.artistUsername ?? undefined
  );

  return (
    <section
      aria-label="Audio player"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl transition-all duration-300"
    >
      {/* Top thin scrubber line for mobile */}
      <div className="sm:hidden relative h-1 w-full bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{
            width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
          }}
        />
      </div>

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Track Info */}
        <div className="flex min-w-0 items-center gap-3 w-1/3 sm:w-1/4">
          <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-black/40">
            {currentTrack.coverArtUrl ? (
              <img
                alt={`${currentTrack.title} artwork`}
                className="size-full object-cover"
                src={currentTrack.coverArtUrl}
              />
            ) : (
              <Music className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              className="block truncate font-medium text-sm text-foreground hover:text-primary transition-colors"
              params={{ id: currentTrack.id }}
              to="/tracks/$id"
            >
              {currentTrack.title}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {currentTrack.artistName}
            </p>
          </div>
        </div>

        {/* Center Controls & Scrubber */}
        <div className="flex flex-1 flex-col items-center justify-center max-w-xl px-2 sm:px-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              aria-label="Previous track"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              disabled={queue.length <= 1}
              onClick={previousTrack}
              type="button"
            >
              <SkipBack className="size-4 sm:size-5" />
            </button>

            <button
              aria-label={isPlaying ? "Pause track" : "Play track"}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
              onClick={togglePlay}
              type="button"
            >
              {isPlaying ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="ml-0.5 size-5 fill-current" />
              )}
            </button>

            <button
              aria-label="Next track"
              className="rounded-full p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              disabled={queue.length <= 1}
              onClick={nextTrack}
              type="button"
            >
              <SkipForward className="size-4 sm:size-5" />
            </button>
          </div>

          {/* Desktop scrubber */}
          <div className="hidden sm:flex w-full items-center gap-2 mt-1">
            <span className="w-10 text-right text-[11px] font-mono text-muted-foreground">
              {formatTime(progress)}
            </span>
            <input
              aria-label="Playback seek"
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary outline-none hover:bg-white/25"
              max={duration || 100}
              min={0}
              onChange={(e) => seek(Number(e.target.value))}
              step="any"
              type="range"
              value={progress}
            />
            <span className="w-10 text-left text-[11px] font-mono text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Actions & Volume */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 w-1/3 sm:w-1/4">
          {/* Queue toggle button */}
          <button
            aria-label={`Open queue with ${queue.length} track${queue.length === 1 ? "" : "s"}`}
            className={`relative rounded-full p-2 transition-colors ${
              isQueueOpen
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setIsQueueOpen(!isQueueOpen)}
            type="button"
          >
            <ListMusic className="size-4 sm:size-5" />
            {queue.length > 0 ? (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {queue.length}
              </span>
            ) : null}
          </button>

          {/* Volume slider */}
          <div className="hidden md:flex items-center gap-2">
            <button
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleMute}
              type="button"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
            <input
              aria-label="Volume slider"
              className="w-20 h-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-primary outline-none"
              max={1}
              min={0}
              onChange={(e) => setVolume(Number(e.target.value))}
              step={0.05}
              type="range"
              value={isMuted ? 0 : volume}
            />
          </div>

          <a
            aria-label="Open track on SoundKit"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground transition-colors"
            href={soundKitTrackUrl}
            rel="noopener noreferrer"
            target="_blank"
            title="Open in SoundKit"
          >
            <span className="hidden lg:inline">SoundKit</span>
            <ExternalLink className="size-3" />
          </a>

          <button
            aria-label="Close player"
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={stop}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Queue Drawer Panel */}
      {isQueueOpen ? (
        <div className="fixed bottom-24 right-4 z-50 w-full max-w-sm sm:max-w-md rounded-3xl border border-border/60 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl space-y-4 max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="size-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">
                Play Queue ({queue.length})
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {queue.length > 1 ? (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={clearQueue}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
              <button
                aria-label="Close queue"
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setIsQueueOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {queue.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Your queue is empty.
              </p>
            ) : (
              queue.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <div
                    className={`flex items-center justify-between gap-3 rounded-2xl p-2.5 transition-colors ${
                      isCurrent
                        ? "border border-primary/40 bg-primary/10"
                        : "hover:bg-white/5"
                    }`}
                    key={track.id}
                  >
                    <button
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      onClick={() => playTrack(track, queue)}
                      type="button"
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-black/40">
                        {track.coverArtUrl ? (
                          <img
                            alt={track.title}
                            className="size-full object-cover"
                            src={track.coverArtUrl}
                          />
                        ) : (
                          <Music className="size-4 m-3 text-muted-foreground" />
                        )}
                        {isCurrent && isPlaying ? (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Pause className="size-4 text-primary fill-current" />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate font-medium text-xs sm:text-sm ${
                            isCurrent
                              ? "text-primary font-bold"
                              : "text-foreground"
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {track.artistName}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {track.duration}
                      </span>
                      <button
                        aria-label="Remove from queue"
                        className="rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => removeFromQueue(idx)}
                        type="button"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
