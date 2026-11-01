/* eslint-disable one-var, sort-vars */
import { Link } from "@tanstack/react-router";
import {
  ListMusic,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import type { VideoPlaybackHandle } from "@/components/video/video-playback-handle";
import { isVideoQueueItem } from "@/lib/player-media";
import {
  completeQueuedTrack,
  shouldRestartCurrentTrack,
} from "@/lib/player-queue";

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

export function QueueVideoPlayer() {
  const {
    currentTrack,
    isPlaying,
    markRecentlyPlayed,
    queue,
    registerTogglePlay,
    repeatMode,
    setCurrentTrack,
    setIsPlaying,
    setQueue,
    setRepeatMode,
    setVisible,
  } = useAudioPlayer();
  const playerRef = useRef<VideoPlaybackHandle>(null);
  const endedRef = useRef(false);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const toggle = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
  }, [isPlaying]);

  useEffect(() => {
    registerTogglePlay(toggle);
    return () => registerTogglePlay(null);
  }, [registerTogglePlay, toggle]);

  useEffect(
    () => () => {
      playerRef.current?.pause();
    },
    []
  );

  const advance = useCallback(
    (completed = false) => {
      if (!currentTrack) {
        return;
      }
      if (completed) {
        if (endedRef.current) {
          return;
        }
        endedRef.current = true;
        markRecentlyPlayed(currentTrack);
        const next = completeQueuedTrack({ currentTrack, queue, repeatMode });
        if (next.restartCurrent) {
          endedRef.current = false;
          playerRef.current?.seek(0);
          playerRef.current?.play();
          return;
        }
        setQueue(next.queue);
        setIsPlaying(false);
        setCurrentTrack(
          next.nextTrack ? { ...next.nextTrack, autoplay: true } : null
        );
        return;
      }
      const currentIndex = queue.findIndex(
        (item) => item.id === currentTrack.id
      );
      const next = queue[currentIndex + 1] ?? queue[0];
      if (next && next.id !== currentTrack.id) {
        playerRef.current?.pause();
        setIsPlaying(false);
        setCurrentTrack({ ...next, autoplay: true });
      }
    },
    [
      currentTrack,
      markRecentlyPlayed,
      queue,
      repeatMode,
      setCurrentTrack,
      setIsPlaying,
      setQueue,
    ]
  );
  const previous = useCallback(() => {
    if (!currentTrack) {
      return;
    }
    const currentIndex = queue.findIndex((item) => item.id === currentTrack.id);
    if (
      shouldRestartCurrentTrack({
        currentIndex,
        currentTime: seconds,
        queueLength: queue.length,
      })
    ) {
      playerRef.current?.seek(0);
      return;
    }
    const item = queue[currentIndex - 1];
    if (item) {
      playerRef.current?.pause();
      setIsPlaying(false);
      setCurrentTrack({ ...item, autoplay: true });
    }
  }, [currentTrack, queue, seconds, setCurrentTrack, setIsPlaying]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']"
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.shiftKey && event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        playerRef.current?.toggleMute();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advance, previous, toggle]);

  const enterPictureInPicture = async () => {
    try {
      const supported = await playerRef.current?.requestPictureInPicture();
      if (!supported) {
        setNotice(
          "This video stays in the floating player as you browse. Your browser may offer picture-in-picture in its video controls."
        );
      }
    } catch {
      setNotice(
        "Picture-in-picture is unavailable right now. Keep watching in the floating player."
      );
    }
  };

  const cycleRepeat = () => {
    const next = { all: "one", off: "all", one: "off" } as const;
    setRepeatMode(next[repeatMode]);
  };

  if (!isVideoQueueItem(currentTrack)) {
    return null;
  }

  return (
    <section
      aria-label="Now playing video"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-40 w-[calc(100vw-2rem)] max-w-[480px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-6"
      data-testid="video-queue-player"
    >
      <header className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{currentTrack.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {currentTrack.artist} ·{" "}
            {currentTrack.video.muxPlaybackId ||
            currentTrack.video.verifiedOnPlatform
              ? "SoundKit video"
              : "YouTube"}
          </p>
        </div>
        <Button
          aria-label="Close video player"
          onClick={() => {
            playerRef.current?.pause();
            setIsPlaying(false);
            setCurrentTrack(null);
            setVisible(false);
          }}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <SoundKitVideoPlayer
        autoPlay={currentTrack.autoplay !== false}
        externalPlaybackUrl={currentTrack.video.externalPlaybackUrl}
        muxPlaybackId={currentTrack.video.muxPlaybackId}
        onEnded={() => advance(true)}
        onError={(message) => {
          setNotice(message);
          setIsPlaying(false);
        }}
        onPaused={() => setIsPlaying(false)}
        onPlaying={() => {
          endedRef.current = false;
          setNotice(null);
          setIsPlaying(true);
        }}
        onProgress={(position, total) => {
          setSeconds(position);
          setDuration(total);
        }}
        playerRef={playerRef}
        posterUrl={currentTrack.cover ?? "/soundkit-default-banner.svg"}
        title={currentTrack.title}
        verifiedOnPlatform={currentTrack.video.verifiedOnPlatform}
        videoId={currentTrack.video.videoId}
      />
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatTime(seconds)}</span>
          <Slider
            aria-label="Video playback position"
            disabled={duration <= 0}
            max={duration || 1}
            onValueChange={([value]) => playerRef.current?.seek(value ?? 0)}
            step={1}
            value={[Math.min(seconds, duration || 0)]}
          />
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <Button
            aria-label="Previous media"
            onClick={previous}
            size="icon"
            variant="ghost"
          >
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            aria-label={isPlaying ? "Pause video" : "Play video"}
            onClick={toggle}
            size="icon"
            variant="secondary"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </Button>
          <Button
            aria-label="Next media"
            disabled={!queue.some((item) => item.id !== currentTrack.id)}
            onClick={() => advance()}
            size="icon"
            variant="ghost"
          >
            <SkipForward aria-hidden="true" />
          </Button>
          <Button
            aria-label={`Repeat ${repeatMode}`}
            aria-pressed={repeatMode !== "off"}
            onClick={cycleRepeat}
            size="icon"
            variant="ghost"
          >
            <Repeat aria-hidden="true" />
            {repeatMode === "one" ? <span className="text-xs">1</span> : null}
          </Button>
          <Button
            aria-label="Picture-in-picture"
            onClick={enterPictureInPicture}
            size="icon"
            variant="ghost"
          >
            <PictureInPicture2 aria-hidden="true" />
          </Button>
          <Sheet onOpenChange={setQueueOpen} open={queueOpen}>
            <SheetTrigger asChild>
              <Button
                aria-label={`Open queue with ${queue.length} items`}
                size="icon"
                variant="ghost"
              >
                <ListMusic aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Up next</SheetTitle>
              </SheetHeader>
              <ol className="flex flex-col gap-2 p-4">
                {queue.map((item) => (
                  <li
                    className="flex items-center gap-2 rounded-xl border border-border p-2"
                    key={item.id}
                  >
                    <button
                      aria-current={
                        item.id === currentTrack.id ? "true" : undefined
                      }
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        if (item.id === currentTrack.id) {
                          toggle();
                        } else {
                          playerRef.current?.pause();
                          setIsPlaying(false);
                          setCurrentTrack({ ...item, autoplay: true });
                        }
                        setQueueOpen(false);
                      }}
                      type="button"
                    >
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.artist} ·{" "}
                        {item.mediaType === "video" ? "Video" : "Song"}
                      </span>
                    </button>
                    <Button
                      aria-label={`Remove ${item.title} from queue`}
                      onClick={() =>
                        setQueue(queue.filter((entry) => entry.id !== item.id))
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ol>
            </SheetContent>
          </Sheet>
        </div>
        {notice ? (
          <output className="text-xs text-muted-foreground">{notice}</output>
        ) : null}
        {currentTrack.trackHref ? (
          <Link
            className="text-xs text-muted-foreground underline underline-offset-4"
            params={{ id: currentTrack.video.videoId }}
            to="/videos/$id"
          >
            Open video page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
