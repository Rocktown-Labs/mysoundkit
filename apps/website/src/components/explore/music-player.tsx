/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop, promise/prefer-await-to-then */
import { Link } from "@tanstack/react-router";
import {
  Laptop2,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Speaker,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { API_V1_URL } from "@/lib/api";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

interface Device {
  active: boolean;
  id: string;
  name: string;
  type: "computer" | "phone" | "speaker";
}

interface PlaybackTelemetrySession {
  id: string;
  lastReportedSeconds: number;
  thresholdReported: boolean;
  trackId: string;
}

const playerRuntimeStorageKey = "soundkit.audio-player-runtime.v1";

const demoPlaybackQueue = [
  {
    artist: "Luna Eclipse",
    artistHref: "/artist/luna-eclipse",
    cover: "/summer-music-album-cover.png",
    id: "track_summer_nights",
    src: "/demo-audio/fantasy26.wav",
    title: "Fantasy 26",
    trackHref: "/tracks/track_summer_nights",
  },
  {
    artist: "Luna Eclipse",
    artistHref: "/artist/luna-eclipse",
    cover: "/summer-music-album-cover.png",
    id: "track_midnight_vibes",
    src: "/demo-audio/dumbledore.wav",
    title: "DUMBLEDORE",
    trackHref: "/tracks/track_midnight_vibes",
  },
  {
    artist: "Neon Pulse",
    artistHref: "/artist/neon-pulse",
    cover: "/hip-hop-album-cover.png",
    id: "track_electric_dreams",
    src: "/demo-audio/long-way-26.wav",
    title: "Long Way 26",
    trackHref: "/tracks/track_electric_dreams",
  },
] as const;

function PlayerRouteLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className: string;
  href: string | null | undefined;
}) {
  const artistMatch = href?.match(/^\/artist\/(?<username>[^/]+)$/u);
  const trackMatch = href?.match(/^\/tracks\/(?<id>[^/]+)$/u);
  const dashboardTrackMatch = href?.match(
    /^\/dashboard\/tracks\/(?<id>[^/]+)$/u
  );

  if (artistMatch?.groups?.username) {
    return (
      <Link
        className={className}
        params={{ username: artistMatch.groups.username }}
        to="/artist/$username"
      >
        {children}
      </Link>
    );
  }

  if (trackMatch?.groups?.id) {
    return (
      <Link className={className} params={{ id: trackMatch.groups.id }} to="/tracks/$id">
        {children}
      </Link>
    );
  }

  if (dashboardTrackMatch?.groups?.id) {
    return (
      <Link
        className={className}
        params={{ id: dashboardTrackMatch.groups.id }}
        to="/dashboard/tracks/$id"
      >
        {children}
      </Link>
    );
  }

  return <span className={className}>{children}</span>;
}

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getDeviceIcon = (type: Device["type"]) => {
  if (type === "phone") {
    return <Smartphone className="size-4" />;
  }

  if (type === "speaker") {
    return <Speaker className="size-4" />;
  }

  return <Laptop2 className="size-4" />;
};

export function MusicPlayer() {
  const { currentTrack, queue, setCurrentTrack, setQueue, setVisible, visible } =
    useAudioPlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackTelemetryRef = useRef<PlaybackTelemetrySession | null>(null);
  const [devices, setDevices] = useState<Device[]>([
    { active: true, id: "computer", name: "This Computer", type: "computer" },
    { active: false, id: "phone", name: "Phone", type: "phone" },
    { active: false, id: "speaker", name: "Studio Speaker", type: "speaker" },
  ]);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [volume, setVolume] = useState(75);

  const meQuery = useMeQuery();
  const isSignedIn = Boolean(meQuery.data);
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // 1-Hour Guest Daily Playback Limit (3600s)
  useEffect(() => {
    if (isSignedIn || !isPlaying || typeof window === "undefined") {
      return;
    }

    const interval = setInterval(() => {
      const today = new Date().toISOString().slice(0, 10);
      const stored = window.localStorage.getItem("soundkit_guest_playback_v1");
      let secondsPlayed = 0;

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { date: string; secondsPlayed: number };
          if (parsed.date === today) {
            secondsPlayed = parsed.secondsPlayed || 0;
          }
        } catch {
          // Reset
        }
      }

      secondsPlayed += 1;
      window.localStorage.setItem(
        "soundkit_guest_playback_v1",
        JSON.stringify({ date: today, secondsPlayed })
      );

      if (secondsPlayed >= 3600) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        setGuestLimitReached(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isSignedIn, isPlaying]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(playerRuntimeStorageKey);

    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        isMuted?: unknown;
        repeatMode?: unknown;
        volume?: unknown;
      };

      if (typeof parsed.volume === "number") {
        setVolume(Math.min(100, Math.max(0, parsed.volume)));
      }
      if (typeof parsed.isMuted === "boolean") {
        setIsMuted(parsed.isMuted);
      }
      if (
        parsed.repeatMode === "off" ||
        parsed.repeatMode === "all" ||
        parsed.repeatMode === "one"
      ) {
        setRepeatMode(parsed.repeatMode);
      }
    } catch {
      window.localStorage.removeItem(playerRuntimeStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      playerRuntimeStorageKey,
      JSON.stringify({ isMuted, repeatMode, volume })
    );
  }, [isMuted, repeatMode, volume]);

  useEffect(() => {
    if (queue.length > 0 || currentTrack?.src) {
      return;
    }

    setQueue([...demoPlaybackQueue]);
  }, [currentTrack?.src, queue.length, setQueue]);

  const sendPlaybackProgress = ({
    ended = false,
    force = false,
  }: { ended?: boolean; force?: boolean } = {}) => {
    const audio = audioRef.current;
    const telemetry = playbackTelemetryRef.current;

    if (!(audio && telemetry)) {
      return;
    }

    const playedSeconds = Math.max(0, Math.floor(audio.currentTime));
    const durationSeconds = Math.ceil(audio.duration || duration || 0);

    if (
      !(
        ended ||
        (force && !telemetry.thresholdReported) ||
        playedSeconds - telemetry.lastReportedSeconds >= 10
      )
    ) {
      return;
    }

    telemetry.lastReportedSeconds = playedSeconds;
    telemetry.thresholdReported ||= force;
    void fetch(
      `${API_V1_URL}/tracks/${encodeURIComponent(
        telemetry.trackId
      )}/playback-sessions/${encodeURIComponent(telemetry.id)}/${
        ended ? "end" : "progress"
      }`,
      {
        body: JSON.stringify({
          durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
          ended,
          isMuted: audio.muted || audio.volume === 0,
          playedSeconds,
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: ended,
        method: "POST",
      }
    ).catch(() => {});
  };

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = isMuted ? 0 : volume / 100;
  }, [isMuted, volume]);

  useEffect(() => {
    const trackId = currentTrack?.id;

    if (!trackId) {
      playbackTelemetryRef.current = null;
      return;
    }

    let cancelled = false;
    playbackTelemetryRef.current = null;

    const startPlaybackSession = async () => {
      const response = await fetch(
        `${API_V1_URL}/tracks/${encodeURIComponent(trackId)}/playback-sessions`,
        {
          body: JSON.stringify({
            clientType: "web",
            sourceType: "library",
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );

      if (!response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;

      if (!(cancelled || !payload?.id)) {
        playbackTelemetryRef.current = {
          id: payload.id,
          lastReportedSeconds: 0,
          thresholdReported: false,
          trackId,
        };
      }
    };

    void startPlaybackSession().catch(() => {});

    return () => {
      cancelled = true;
      sendPlaybackProgress({ ended: true });
      playbackTelemetryRef.current = null;
    };
  }, [currentTrack?.id]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!(audio && currentTrack)) {
      return;
    }

    audio.src = currentTrack.src;
    audio.load();
    setProgress(0);
    setDuration(currentTrack.duration ?? 0);

    if (visible) {
      void audio.play().then(() => setIsPlaying(true));
    }
  }, [currentTrack, visible]);

  useEffect(() => {
    if (!(isPlaying || !visible)) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 300_000);
    } else if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isPlaying, setVisible, visible]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleTimeUpdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
        sendPlaybackProgress({
          force: (audio.currentTime / audio.duration) * 100 >= 70,
        });
      }
    };
    const handleEnded = () => {
      sendPlaybackProgress({ ended: true });

      if (repeatMode === "one") {
        audio.currentTime = 0;
        void audio.play();
        return;
      }

      handleNext();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  });

  const handlePlayPause = () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    setVisible(true);
    void audio.play().then(() => setIsPlaying(true));
  };

  const handleNext = () => {
    if (!(currentTrack && queue.length > 0)) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = queue.findIndex(
      (track) => track.id === currentTrack.id
    );
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % queue.length;
    setCurrentTrack(queue[nextIndex] ?? currentTrack);
  };

  const handlePrevious = () => {
    if (!(currentTrack && queue.length > 0)) {
      return;
    }

    const currentIndex = queue.findIndex(
      (track) => track.id === currentTrack.id
    );
    const previousIndex =
      currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentTrack(queue[previousIndex] ?? currentTrack);
  };

  const handleRepeatToggle = () => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length] ?? "off");
  };

  const handleScrub = (value: number[]) => {
    const nextProgress = value[0] ?? 0;
    const audio = audioRef.current;

    setProgress(nextProgress);

    if (audio?.duration) {
      audio.currentTime = (nextProgress / 100) * audio.duration;
    }
  };

  const handleClose = () => {
    audioRef.current?.pause();
    sendPlaybackProgress({ ended: true });
    setIsPlaying(false);
    setVisible(false);
  };

  if (!(visible && currentTrack)) {
    return null;
  }

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:left-64">
      <audio ref={audioRef} preload="metadata">
        <track kind="captions" />
      </audio>
      <Button
        aria-label="Close player"
        className="absolute top-2 right-2 size-6"
        onClick={handleClose}
        size="icon"
        variant="ghost"
      >
        <X className="size-4" />
      </Button>

      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-3 lg:w-1/4">
            <AppImage
              alt={currentTrack.title}
              className="rounded"
              height={48}
              layout="fixed"
              src={currentTrack.cover || "/placeholder.svg"}
              width={48}
            />
            <div className="min-w-0 flex-1">
              <PlayerRouteLink
                className="block truncate text-sm font-medium transition-colors hover:text-primary"
                href={currentTrack.trackHref}
              >
                {currentTrack.title}
              </PlayerRouteLink>
              <PlayerRouteLink
                className="block truncate text-xs text-muted-foreground transition-colors hover:text-primary"
                href={currentTrack.artistHref}
              >
                {currentTrack.artist}
              </PlayerRouteLink>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:w-1/2">
            <div className="flex items-center justify-center gap-2">
              <Button
                className="size-8"
                onClick={() => setIsShuffled(!isShuffled)}
                size="icon"
                variant="ghost"
              >
                <Shuffle
                  className={`size-4 ${isShuffled ? "text-primary" : ""}`}
                />
              </Button>
              <Button
                className="size-8"
                onClick={handlePrevious}
                size="icon"
                variant="ghost"
              >
                <SkipBack className="size-4" />
              </Button>
              <Button
                className="size-10"
                onClick={handlePlayPause}
                size="icon"
                variant="default"
              >
                {isPlaying ? (
                  <Pause className="size-5" />
                ) : (
                  <Play className="size-5" />
                )}
              </Button>
              <Button
                className="size-8"
                onClick={handleNext}
                size="icon"
                variant="ghost"
              >
                <SkipForward className="size-4" />
              </Button>
              <Button
                className="size-8"
                onClick={handleRepeatToggle}
                size="icon"
                variant="ghost"
              >
                <Repeat
                  className={`size-4 ${repeatMode === "off" ? "" : "text-primary"}`}
                />
                {repeatMode === "one" && (
                  <span className="absolute text-[10px] font-bold">1</span>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(audioRef.current?.currentTime ?? 0)}
              </span>
              <Slider
                className="flex-1"
                max={100}
                onValueChange={handleScrub}
                step={0.1}
                value={[progress]}
              />
              <span className="text-xs text-muted-foreground">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 lg:w-1/4">
            <Sheet onOpenChange={setQueueOpen} open={queueOpen}>
              <SheetTrigger asChild={true}>
                <Button className="size-8" size="icon" variant="ghost">
                  <ListMusic className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:w-96" side="right">
                <SheetHeader>
                  <SheetTitle>Queue</SheetTitle>
                </SheetHeader>
                <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
                  <div className="space-y-2">
                    {queue.map((track, index) => (
                      <button
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-accent ${
                          track.id === currentTrack.id ? "bg-accent" : ""
                        }`}
                        key={track.id}
                        onClick={() => setCurrentTrack(track)}
                        type="button"
                      >
                        <div className="flex size-10 items-center justify-center rounded bg-muted text-xs font-medium">
                          {index + 1}
                        </div>
                        <AppImage
                          alt={track.title}
                          className="rounded"
                          height={40}
                          layout="fixed"
                          src={track.cover || "/placeholder.svg"}
                          width={40}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {track.artist}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <Button
                  className="hidden size-8 lg:flex"
                  size="icon"
                  variant="ghost"
                >
                  {getDeviceIcon(
                    devices.find((device) => device.active)?.type ?? "computer"
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold">
                  Available Devices
                </div>
                {devices.map((device) => (
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    key={device.id}
                    onClick={() =>
                      setDevices((current) =>
                        current.map((entry) => ({
                          ...entry,
                          active: entry.id === device.id,
                        }))
                      )
                    }
                  >
                    {getDeviceIcon(device.type)}
                    <span className="flex-1">{device.name}</span>
                    {device.active && (
                      <div className="size-2 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden items-center gap-2 lg:flex">
              <Button
                className="size-8"
                onClick={() => setIsMuted(!isMuted)}
                size="icon"
                variant="ghost"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </Button>
              <Slider
                className="w-24"
                max={100}
                onValueChange={(value) => {
                  const nextVolume = value[0] ?? 0;
                  setVolume(nextVolume);

                  if (nextVolume > 0) {
                    setIsMuted(false);
                  }
                }}
                step={1}
                value={[isMuted ? 0 : volume]}
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={guestLimitReached} onOpenChange={setGuestLimitReached}>
        <DialogContent className="max-w-md p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-[family-name:var(--font-playfair)]">
              1-Hour Free Listening Limit Reached
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              You&apos;ve enjoyed 1 hour of free guest listening today! Create a free SoundKit account to unlock unlimited streaming, save your favorite tracks, and follow top artists.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-2">
            <Button asChild size="lg" className="w-full font-bold">
              <Link to="/signup">Sign Up Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to="/login">Log In to Existing Account</Link>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Or return tomorrow for another hour of guest listening.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
