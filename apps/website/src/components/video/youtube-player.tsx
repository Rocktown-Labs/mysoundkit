/* eslint-disable one-var, sort-vars */
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import type { VideoPlaybackHandle } from "@/components/video/video-playback-handle";
import { loadYouTubePlayerApi } from "@/lib/youtube-player-api";
import type { YouTubePlayer } from "@/lib/youtube-player-api";

export function YouTubePlayerView({
  autoPlay = false,
  onEnded,
  onError,
  onPaused,
  onPlaying,
  onProgress,
  playerRef,
  title,
  youtubeId,
}: {
  autoPlay?: boolean;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onPaused?: () => void;
  onPlaying?: () => void;
  onProgress?: (seconds: number, duration: number) => void;
  playerRef?: Ref<VideoPlaybackHandle>;
  title: string;
  youtubeId: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<YouTubePlayer | null>(null);
  const callbacks = useRef({
    onEnded,
    onError,
    onPaused,
    onPlaying,
    onProgress,
  });
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    callbacks.current = { onEnded, onError, onPaused, onPlaying, onProgress };
  }, [onEnded, onError, onPaused, onPlaying, onProgress]);

  useImperativeHandle(
    playerRef,
    () => ({
      toggleMute: () => {
        const player = apiRef.current;
        if (player?.isMuted()) player.unMute();
        else player?.mute();
      },
      pause: () => apiRef.current?.pauseVideo(),
      play: () => apiRef.current?.playVideo(),
      requestPictureInPicture: () => Promise.resolve(false),
      seek: (seconds) => apiRef.current?.seekTo(Math.max(0, seconds), true),
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let progressTimer: number | undefined;
    const reportError = (message: string) => {
      if (!cancelled) {
        setPlayerError(message);
        callbacks.current.onPaused?.();
        callbacks.current.onError?.(message);
      }
    };
    const initialize = async () => {
      try {
        const api = await loadYouTubePlayerApi();
        const host = hostRef.current;
        if (cancelled || !host) {
          return;
        }
        const mount = document.createElement("div");
        host.replaceChildren(mount);
        player = new api.Player(mount, {
          events: {
            onAutoplayBlocked: () =>
              reportError("Press play in the YouTube player to continue."),
            onError: () =>
              reportError(
                "YouTube could not play this video. Try again or choose another item."
              ),
            onReady: ({ target }) => {
              if (cancelled) {
                return;
              }
              apiRef.current = target;
              const iframe = host.querySelector("iframe");
              iframe?.setAttribute("title", title);
              iframe?.setAttribute(
                "allow",
                "autoplay; encrypted-media; picture-in-picture; fullscreen"
              );
              if (autoPlay) {
                target.playVideo();
              }
            },
            onStateChange: ({ data }) => {
              if (cancelled) {
                return;
              }
              if (data === 1) {
                setPlayerError(null);
                callbacks.current.onPlaying?.();
              } else if (data === 2) {
                callbacks.current.onPaused?.();
              } else if (data === 0) {
                callbacks.current.onPaused?.();
                callbacks.current.onEnded?.();
              }
            },
          },
          height: "100%",
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          videoId: youtubeId,
          width: "100%",
        });
        progressTimer = window.setInterval(() => {
          if (!cancelled && apiRef.current) {
            callbacks.current.onProgress?.(
              apiRef.current.getCurrentTime(),
              apiRef.current.getDuration()
            );
          }
        }, 1000);
      } catch (error) {
        reportError(
          error instanceof Error ? error.message : "YouTube could not load."
        );
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      window.clearInterval(progressTimer);
      apiRef.current = null;
      player?.destroy();
    };
    // The embed lifetime follows the media identity, never changing callback identities or routes.
    // Retry intentionally recreates the same source after a provider load failure.
    // eslint-disable-next-line react/exhaustive-effect-dependencies
  }, [autoPlay, attempt, title, youtubeId]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="aspect-video min-h-[200px] w-full [&_iframe]:min-h-[200px]"
        data-testid="youtube-player"
        ref={hostRef}
      />
      {playerError ? (
        <output className="flex items-center justify-between gap-3 p-3">
          <p className="text-sm text-muted-foreground">{playerError}</p>
          <Button
            onClick={() => {
              setPlayerError(null);
              setAttempt((value) => value + 1);
            }}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        </output>
      ) : null}
    </div>
  );
}
