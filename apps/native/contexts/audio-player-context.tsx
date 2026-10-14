/* eslint-disable one-var, sort-vars, sort-keys, react/immutability, react/set-state-in-effect */
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import * as Haptics from "expo-haptics";
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
  advanceQueue,
  cycleRepeatMode,
  shuffleTracks,
} from "@/lib/player-queue";
import type { PlayerTrack, RepeatMode } from "@/lib/player-queue";

export type { PlayerTrack, RepeatMode } from "@/lib/player-queue";

export interface AudioPlayerContextValue {
  addToQueue: (track: PlayerTrack) => void;
  clearQueue: () => void;
  closeNowPlaying: () => void;
  currentTrack: PlayerTrack | null;
  duration: number;
  isBuffering: boolean;
  isLyricsVisible: boolean;
  isNowPlayingVisible: boolean;
  isPlaying: boolean;
  isQueueVisible: boolean;
  isShuffle: boolean;
  nextTrack: () => void;
  openNowPlaying: () => void;
  pause: () => void;
  playbackPosition: number;
  playTrack: (track: PlayerTrack, newQueue?: PlayerTrack[]) => void;
  previousTrack: () => void;
  progress: number;
  queue: PlayerTrack[];
  removeFromQueue: (trackId: string) => void;
  repeatMode: RepeatMode;
  resume: () => void;
  seekTo: (seconds: number) => Promise<void>;
  setIsLyricsVisible: (visible: boolean) => void;
  setIsQueueVisible: (visible: boolean) => void;
  setVolume: (level: number) => void;
  toggleLyrics: () => void;
  toggleNowPlaying: () => void;
  togglePlay: () => void;
  toggleQueue: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  volume: number;
}

export const DEFAULT_DEMO_TRACKS: PlayerTrack[] = [
  {
    album: "Millionaire Era",
    artist: "CG Stewart, Matt Alvis",
    cover:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    duration: 176,
    id: "track_millionaire_millennials",
    lyrics: `Cruising through the city under amber lights
Millionaire millennials dreaming through the night
We built our sound from concrete and tape
Chasing every rhythm there is no escape
Anxiety and high depression, seasonal if I was guessing
Time for some prioritizing`,
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "Millionaire Millennials",
    trackHref: "/tracks/track_millionaire_millennials",
  },
  {
    album: "Certified Classics",
    artist: "Drake",
    cover:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80",
    duration: 233,
    id: "track_prioritizing",
    lyrics: `Anxiety and high depression
seasonal if I was guessing
Time for some prioritizing
Stacking all the chips while the sun is rising
Yeah, late night in the booth
Only giving them the truth`,
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "Prioritizing",
    trackHref: "/tracks/track_prioritizing",
  },
  {
    album: "Midnight Vibes",
    artist: "Luna Eclipse",
    cover:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80",
    duration: 218,
    id: "track_fantasy_26",
    lyrics: `Midnight echoes on the radio
Where did all the summer memories go?
Neon pulses guiding the beat
Lost together on the midnight street`,
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "Fantasy 26",
    trackHref: "/tracks/track_fantasy_26",
  },
  {
    album: "Electric Dreams",
    artist: "Neon Pulse",
    cover:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80",
    duration: 245,
    id: "track_long_way",
    lyrics: `Long way home through digital skies
Seeing all the hope in your glowing eyes
Synthwave waves washing over the shore
Never gonna let you go anymore`,
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    title: "Long Way 26",
    trackHref: "/tracks/track_long_way",
  },
];

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({
  children,
  initialTracks = DEFAULT_DEMO_TRACKS,
}: {
  children: ReactNode;
  initialTracks?: PlayerTrack[];
}) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(
    () => initialTracks[0] ?? null
  );
  const [queue, setQueue] = useState<PlayerTrack[]>(() =>
    initialTracks.slice(1)
  );
  const [originalQueue, setOriginalQueue] = useState<PlayerTrack[]>(() =>
    initialTracks.slice(1)
  );
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolume] = useState(0.85);
  const [isNowPlayingVisible, setIsNowPlayingVisible] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);

  // Keep the hook source stable (null): useAudioPlayer recreates the native
  // player whenever its `source` argument changes, which would discard the
  // replace()+play() calls below and silently pause playback on every track
  // switch. replace() on this persistent instance is the only source switch.
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const isPlaying = Boolean(status.playing);
  const isBuffering = Boolean(status.isBuffering);
  const playbackPosition = status.currentTime ?? 0;
  const duration =
    status.duration > 0 ? status.duration : (currentTrack?.duration ?? 0);
  const progress =
    duration > 0 ? Math.min(1, Math.max(0, playbackPosition / duration)) : 0;

  // Configure audio session on mount
  useEffect(() => {
    void setAudioModeAsync({
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
    });
  }, []);

  // Sync player volume
  useEffect(() => {
    try {
      player.volume = volume;
    } catch {
      // Ignore if volume setting not supported on platform
    }
  }, [player, volume]);

  const resume = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.play();
  }, [player]);

  const pause = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    player.pause();
  }, [player]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  const seekTo = useCallback(
    async (seconds: number) => {
      try {
        await player.seekTo(Math.max(0, Math.min(seconds, duration)));
      } catch {
        // Fallback or ignore
      }
    },
    [duration, player]
  );

  const nextTrack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const advanceResult = advanceQueue({
      currentTrack,
      queue,
      repeatMode,
    });

    if (advanceResult.restartCurrent && advanceResult.nextTrack) {
      player.seekTo(0);
      player.play();
      return;
    }

    if (advanceResult.nextTrack) {
      const next = advanceResult.nextTrack;
      if (currentTrack) {
        historyRef.current = [...historyRef.current, currentTrack].slice(-50);
      }
      setCurrentTrack(next);
      setQueue(advanceResult.queue);
      // Keep the unshuffle order in sync as tracks advance so toggling
      // shuffle off never restores played tracks or the one already playing.
      if (isShuffle) {
        if (repeatMode !== "all") {
          setOriginalQueue((prev) => prev.filter((t) => t.id !== next.id));
        }
      } else {
        setOriginalQueue(advanceResult.queue);
      }
      player.replace(next.src);
      player.play();
    } else {
      player.pause();
    }
  }, [currentTrack, isShuffle, player, queue, repeatMode]);

  const previousTrack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Apple Music behavior: mid-track restarts the current track; near the
    // start it goes back to the previously played track (if there is one).
    if (playbackPosition > 3 || historyRef.current.length === 0) {
      player.seekTo(0);
      player.play();
      return;
    }
    const previous = historyRef.current.pop();
    if (!previous) {
      player.seekTo(0);
      player.play();
      return;
    }
    if (currentTrack) {
      const resumeCurrent = currentTrack;
      setQueue((prev) => [
        resumeCurrent,
        ...prev.filter((t) => t.id !== resumeCurrent.id),
      ]);
      setOriginalQueue((prev) => [
        resumeCurrent,
        ...prev.filter((t) => t.id !== resumeCurrent.id),
      ]);
    }
    setCurrentTrack(previous);
    player.replace(previous.src);
    player.play();
  }, [currentTrack, playbackPosition, player]);

  // Handle track finished automatically
  const hasFinishedRef = useRef(false);
  // Tracks played before the current one, oldest first, for previousTrack().
  const historyRef = useRef<PlayerTrack[]>([]);
  useEffect(() => {
    if (status.didJustFinish && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      if (repeatMode === "one") {
        player.seekTo(0);
        player.play();
      } else {
        nextTrack();
      }
    } else if (!status.didJustFinish) {
      hasFinishedRef.current = false;
    }
  }, [nextTrack, player, repeatMode, status.didJustFinish]);

  const playTrack = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (newQueue) {
        // Fresh queue context — playback history no longer applies.
        historyRef.current = [];
      } else if (currentTrack) {
        historyRef.current = [...historyRef.current, currentTrack].slice(-50);
      }
      setCurrentTrack(track);
      if (newQueue) {
        const filtered = newQueue.filter((t) => t.id !== track.id);
        setQueue(filtered);
        setOriginalQueue(filtered);
      }
      player.replace(track.src);
      player.play();
    },
    [currentTrack, player]
  );

  const addToQueue = useCallback((track: PlayerTrack) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue((prev) => [...prev, track]);
    setOriginalQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
    setOriginalQueue((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const clearQueue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue([]);
    setOriginalQueue([]);
  }, []);

  const toggleShuffle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    if (nextShuffle) {
      setQueue((curr) => shuffleTracks(curr));
    } else {
      setQueue([...originalQueue]);
    }
  }, [isShuffle, originalQueue]);

  const toggleRepeat = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRepeatMode((prev) => cycleRepeatMode(prev));
  }, []);

  const handleSetVolume = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    setVolume(clamped);
  }, []);

  const openNowPlaying = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsNowPlayingVisible(true);
  }, []);

  const closeNowPlaying = useCallback(() => {
    setIsNowPlayingVisible(false);
  }, []);

  const toggleNowPlaying = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsNowPlayingVisible((prev) => !prev);
  }, []);

  const toggleLyrics = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLyricsVisible((prev) => !prev);
  }, []);

  const toggleQueue = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsQueueVisible((prev) => !prev);
  }, []);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      addToQueue,
      clearQueue,
      closeNowPlaying,
      currentTrack,
      duration,
      isBuffering,
      isLyricsVisible,
      isNowPlayingVisible,
      isPlaying,
      isQueueVisible,
      isShuffle,
      nextTrack,
      openNowPlaying,
      pause,
      playbackPosition,
      playTrack,
      previousTrack,
      progress,
      queue,
      removeFromQueue,
      repeatMode,
      resume,
      seekTo,
      setIsLyricsVisible,
      setIsQueueVisible,
      setVolume: handleSetVolume,
      toggleLyrics,
      toggleNowPlaying,
      togglePlay,
      toggleQueue,
      toggleRepeat,
      toggleShuffle,
      volume,
    }),
    [
      addToQueue,
      clearQueue,
      closeNowPlaying,
      currentTrack,
      duration,
      handleSetVolume,
      isBuffering,
      isLyricsVisible,
      isNowPlayingVisible,
      isPlaying,
      isQueueVisible,
      isShuffle,
      nextTrack,
      openNowPlaying,
      pause,
      playbackPosition,
      playTrack,
      previousTrack,
      progress,
      queue,
      removeFromQueue,
      repeatMode,
      resume,
      seekTo,
      toggleLyrics,
      toggleNowPlaying,
      togglePlay,
      toggleQueue,
      toggleRepeat,
      toggleShuffle,
      volume,
    ]
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayerContext(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error(
      "useAudioPlayerContext must be used within an AudioPlayerProvider"
    );
  }
  return context;
}
