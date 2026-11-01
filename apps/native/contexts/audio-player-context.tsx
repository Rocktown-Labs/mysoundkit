import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
/* eslint-disable one-var, sort-vars, sort-keys, react/immutability, react/set-state-in-effect, complexity, no-nested-ternary */
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import { Pressable, StyleSheet, Text, View } from "react-native";

import { API_BASE_URL, API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  loadPendingPlayback,
  resolvePlaybackSource,
} from "@/lib/playback-source";
import {
  advanceQueue,
  cycleRepeatMode,
  shuffleTracks,
} from "@/lib/player-queue";
import type { PlayerTrack, RepeatMode } from "@/lib/player-queue";
import { useMeEntitlementsQuery } from "@/lib/soundkit-api";

export type { PlayerTrack, RepeatMode } from "@/lib/player-queue";

export interface AudioPlayerContextValue {
  activeAd: ServedAd | null;
  addToQueue: (track: PlayerTrack) => void;
  clearQueue: () => void;
  closeNowPlaying: () => void;
  currentTrack: PlayerTrack | null;
  dismissPlayer: () => void;
  duration: number;
  isBuffering: boolean;
  isGuestLimitReached: boolean;
  isLyricsVisible: boolean;
  isNowPlayingVisible: boolean;
  isPlaying: boolean;
  isQueueVisible: boolean;
  isShuffle: boolean;
  moveQueueItem: (trackId: string, delta: number) => void;
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

/** Web-parity guest policy: 5 minutes of free listening per calendar day. */
const GUEST_DAILY_PLAYBACK_LIMIT_SECONDS = 300,
  GUEST_PLAYBACK_STORAGE_KEY = "soundkit_guest_playback_v1";

interface GuestPlaybackMeter {
  date: string;
  secondsPlayed: number;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

const readGuestMeter = async (): Promise<GuestPlaybackMeter> => {
  const stored = await AsyncStorage.getItem(GUEST_PLAYBACK_STORAGE_KEY),
    today = todayKey();
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as GuestPlaybackMeter;
      if (parsed.date === today && typeof parsed.secondsPlayed === "number") {
        return { date: today, secondsPlayed: parsed.secondsPlayed };
      }
    } catch {
      // Corrupt meter — restart the window.
    }
  }
  return { date: today, secondsPlayed: 0 };
};

const writeGuestMeter = async (seconds: number) => {
  await AsyncStorage.setItem(
    GUEST_PLAYBACK_STORAGE_KEY,
    JSON.stringify({ date: todayKey(), secondsPlayed: Math.max(0, seconds) })
  );
};

export interface ServedAd {
  campaignId: string;
  clickthroughUrl: string | null;
  imageUrl: string | null;
  mediaUrl: string;
  title: string;
}

/** Best-effort ad events; the player must never fail because of them. */
const sendAdEvent = async (campaignId: string, eventType: string) => {
  try {
    await authenticatedFetch(`${API_V1_URL}/ads/event`, {
      body: JSON.stringify({ campaignId, eventType }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Ad telemetry is non-critical.
  }
};

const requestAudioPreroll = async (
  trackId: string
): Promise<ServedAd | null> => {
  try {
    const response = await authenticatedFetch(
      `${API_V1_URL}/ads/serve?placement=audio_preroll&contentType=audio&trackId=${encodeURIComponent(trackId)}`
    );
    if (response.status === 204 || !response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      ad?: Partial<ServedAd>;
      hasAd?: boolean;
    };
    if (!payload.hasAd || !payload.ad?.campaignId || !payload.ad.mediaUrl) {
      return null;
    }
    return {
      campaignId: payload.ad.campaignId,
      clickthroughUrl: payload.ad.clickthroughUrl ?? null,
      imageUrl: payload.ad.imageUrl ?? null,
      mediaUrl: payload.ad.mediaUrl,
      title: payload.ad.title ?? "Sponsored audio",
    };
  } catch {
    return null;
  }
};

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
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>(() => initialTracks);
  const [originalQueue, setOriginalQueue] = useState<PlayerTrack[]>(
    () => initialTracks
  );
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolume] = useState(0.85);
  const [isNowPlayingVisible, setIsNowPlayingVisible] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const [isGuestLimitReached, setIsGuestLimitReached] = useState(false);

  const [activeAd, setActiveAd] = useState<ServedAd | null>(null);

  const { data: session } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);

  const { data: entitlements } = useMeEntitlementsQuery(isSignedIn);
  const isPremium = Boolean(entitlements?.isPremium);

  // Keep the hook source stable (null): useAudioPlayer recreates the native
  // player whenever its `source` argument changes, which would discard the
  // replace()+play() calls below and silently pause playback on every track
  // switch. replace() on this persistent instance is the only source switch.
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const dismissPlayer = useCallback(() => {
    player.pause();
    setCurrentTrack(null);
    setIsNowPlayingVisible(false);
  }, [player]);

  const isPlaying = Boolean(status.playing),
    isBuffering = Boolean(status.isBuffering),
    playbackPosition = status.currentTime ?? 0,
    duration =
      status.duration > 0 ? status.duration : (currentTrack?.duration ?? 0),
    progress =
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

  const pendingTrackRef = useRef<PlayerTrack | null>(null),
    prerollServedTrackRef = useRef<string | null>(null);

  // Credentials can resolve after the user selects another track. Apply the
  // source only while the captured selection is still current.
  const loadPendingContent = useCallback(async () => {
    await loadPendingPlayback({
      getPendingTrack: () => pendingTrackRef.current,
      resolveSource: (track) =>
        resolvePlaybackSource({
          uri: track.src,
          apiBaseUrl: API_BASE_URL,
          getCookie: async () => await authClient.getCookie(),
        }),
      replaceSource: (source) => player.replace(source),
      play: () => player.play(),
    });
  }, [player]);

  /** Starts a track: pre-roll ad first (skipped for premium, one attempt per
   * track), then the guarded audio source with the session cookie attached.
   * When an ad plays, the didJustFinish handler hands off to content. */
  const startTrack = useCallback(
    async (track: PlayerTrack, queueSeed?: PlayerTrack[]) => {
      if (queueSeed) {
        const filtered = queueSeed.filter((t) => t.id !== track.id);
        setQueue(filtered);
        setOriginalQueue(filtered);
      }
      setCurrentTrack(track);
      pendingTrackRef.current = track;
      setActiveAd(null);

      if (
        !isPremium &&
        prerollServedTrackRef.current !== track.id &&
        track.src.length > 0
      ) {
        prerollServedTrackRef.current = track.id;
        const ad = await requestAudioPreroll(track.id);
        if (ad) {
          setActiveAd(ad);
          player.replace({ uri: ad.mediaUrl });
          player.play();
          void sendAdEvent(ad.campaignId, "impression");
          return;
        }
      } else {
        prerollServedTrackRef.current = track.id;
      }

      await loadPendingContent();
    },
    [isPremium, loadPendingContent, player]
  );

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
      void startTrack(next);
    } else {
      player.pause();
    }
  }, [currentTrack, isShuffle, player, queue, repeatMode, startTrack]);

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
    void startTrack(previous);
  }, [currentTrack, playbackPosition, player, startTrack]);

  // Handle track finished automatically — ad-end hands off to content.
  const hasFinishedRef = useRef(false);
  // Tracks played before the current one, oldest first, for previousTrack().
  const historyRef = useRef<PlayerTrack[]>([]);
  useEffect(() => {
    if (status.didJustFinish && !hasFinishedRef.current) {
      hasFinishedRef.current = true;
      if (activeAd) {
        void sendAdEvent(activeAd.campaignId, "complete");
        setActiveAd(null);
        void loadPendingContent();
        return;
      }
      if (repeatMode === "one") {
        player.seekTo(0);
        player.play();
      } else {
        nextTrack();
      }
    } else if (!status.didJustFinish) {
      hasFinishedRef.current = false;
    }
  }, [
    activeAd,
    loadPendingContent,
    nextTrack,
    player,
    repeatMode,
    status.didJustFinish,
  ]);

  const playTrack = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (newQueue) {
        // Fresh queue context — playback history no longer applies.
        historyRef.current = [];
      } else if (currentTrack) {
        historyRef.current = [...historyRef.current, currentTrack].slice(-50);
      }
      void startTrack(track, newQueue);
    },
    [currentTrack, startTrack]
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

  /** Moves a queued track by delta positions (-1 up, +1 down), keeping the
   * unshuffle order in sync when shuffle is off. */
  const moveQueueItem = useCallback(
    (trackId: string, delta: number) => {
      const reorder = (tracks: PlayerTrack[]) => {
        const index = tracks.findIndex((t) => t.id === trackId),
          target = index + delta;
        if (index === -1 || target < 0 || target >= tracks.length) {
          return tracks;
        }
        const next = [...tracks],
          moved = next[index];
        next[index] = next[target];
        next[target] = moved;
        return next;
      };
      setQueue((prev) => reorder(prev));
      if (!isShuffle) {
        setOriginalQueue((prev) => reorder(prev));
      }
    },
    [isShuffle]
  );

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

  // Guest listening window (web parity): meter anonymous playback and pause
  // with a signup wall after the daily free limit.
  useEffect(() => {
    if (isSignedIn || !isPlaying) {
      return;
    }
    const interval = setInterval(() => {
      void (async () => {
        const meter = await readGuestMeter();
        const secondsPlayed = meter.secondsPlayed + 1;
        await writeGuestMeter(secondsPlayed);
        if (secondsPlayed >= GUEST_DAILY_PLAYBACK_LIMIT_SECONDS) {
          player.pause();
          setIsGuestLimitReached(true);
        }
      })();
    }, 1000);
    return () => clearInterval(interval);
  }, [isSignedIn, isPlaying, player]);

  // Dismiss the wall once the visitor signs in.
  useEffect(() => {
    if (isSignedIn) {
      setIsGuestLimitReached(false);
    }
  }, [isSignedIn]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      activeAd,
      addToQueue,
      clearQueue,
      closeNowPlaying,
      currentTrack,
      dismissPlayer,
      duration,
      isBuffering,
      isGuestLimitReached,
      isLyricsVisible,
      isNowPlayingVisible,
      isPlaying,
      isQueueVisible,
      isShuffle,
      moveQueueItem,
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
      activeAd,
      addToQueue,
      clearQueue,
      closeNowPlaying,
      currentTrack,
      dismissPlayer,
      duration,
      handleSetVolume,
      isBuffering,
      isGuestLimitReached,
      isLyricsVisible,
      isNowPlayingVisible,
      isPlaying,
      isQueueVisible,
      isShuffle,
      moveQueueItem,
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
      <GuestLimitWall
        onContinueToAuth={() => {
          setIsGuestLimitReached(false);
        }}
        visible={isGuestLimitReached}
      />
    </AudioPlayerContext.Provider>
  );
}

/** Web-parity "Guest Preview Limit Reached" wall shown by the provider so it
 * appears no matter which surface is hosting the player. */
function GuestLimitWall({
  onContinueToAuth,
  visible,
}: {
  onContinueToAuth: () => void;
  visible: boolean;
}) {
  const router = useRouter();
  if (!visible) {
    return null;
  }
  return (
    <View style={wallStyles.scrim}>
      <View style={wallStyles.card}>
        <Text style={wallStyles.title}>Guest Preview Limit Reached</Text>
        <Text style={wallStyles.body}>
          You&apos;ve enjoyed 5 minutes of free guest listening today. Create a
          free SoundKit account to keep streaming, save your favorite tracks,
          and follow artists.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onContinueToAuth();
            router.push("/signup");
          }}
          style={({ pressed }) => [
            wallStyles.primaryButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={wallStyles.primaryButtonText}>Sign Up Free</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onContinueToAuth();
            router.push("/login");
          }}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={wallStyles.secondaryButtonText}>
            Log In to Existing Account
          </Text>
        </Pressable>
        <Text style={wallStyles.footnote}>
          Or return tomorrow for another guest preview.
        </Text>
      </View>
    </View>
  );
}

const wallStyles = StyleSheet.create({
  body: {
    color: "#8F8F8F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 24,
    maxWidth: 360,
    padding: 22,
  },
  footnote: {
    color: "#8F8F8F",
    fontSize: 11,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  scrim: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 999,
  },
  secondaryButtonText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  title: {
    color: "#F8F8F8",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
});

export function useAudioPlayerContext(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error(
      "useAudioPlayerContext must be used within an AudioPlayerProvider"
    );
  }
  return context;
}
