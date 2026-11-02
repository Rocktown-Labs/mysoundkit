"use client";

import MuxPlayer from "@mux/mux-player-react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import {
  ExternalLink,
  Maximize,
  Minimize,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useImperativeHandle, useRef } from "react";
import type { Ref } from "react";

import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VideoPlaybackHandle } from "@/components/video/video-playback-handle";
import { YouTubePlayerView } from "@/components/video/youtube-player";
/* eslint-disable no-useless-return, one-var, sort-vars, react/iframe-missing-sandbox */
import { capture } from "@/lib/analytics";
import { directVideoUrl, getYouTubeVideoId, httpUrl } from "@/lib/player-media";
import {
  createVideoViewSession,
  updateVideoViewSession,
} from "@/lib/soundkit-api-hooks";

function videoAnalyticsProvider(
  muxPlaybackId?: string | null,
  externalPlaybackUrl?: string | null
): "mux" | "youtube" | "soundkit" {
  if (muxPlaybackId) return "mux";
  if (externalPlaybackUrl && getYouTubeVideoId(externalPlaybackUrl))
    return "youtube";
  return "soundkit";
}

const VIDEO_VIEWER_STORAGE_KEY = "soundkit.video-viewer-id.v1",
  getAnonymousViewerId = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const existingId = window.localStorage.getItem(VIDEO_VIEWER_STORAGE_KEY);
      if (existingId) {
        return existingId;
      }

      const newId = crypto.randomUUID();
      window.localStorage.setItem(VIDEO_VIEWER_STORAGE_KEY, newId);
      return newId;
    } catch {
      return;
    }
  },
  playbackPositionFromEvent = (event: {
    currentTarget: EventTarget | null;
  }) => {
    const target = event.currentTarget as HTMLMediaElement | null,
      currentTime = Number(target?.currentTime),
      duration = Number(target?.duration);

    return {
      durationSeconds:
        Number.isFinite(duration) && duration > 0
          ? Math.ceil(duration)
          : undefined,
      playedSeconds:
        Number.isFinite(currentTime) && currentTime > 0
          ? Math.floor(currentTime)
          : 0,
    };
  };

interface VideoViewTelemetry {
  id: string;
  lastReportedSeconds: number;
  token: string;
}

const reportAnalytics = async (request: Promise<unknown>) => {
  try {
    await request;
  } catch {
    // Analytics is best effort and must never interrupt playback.
  }
};

export function SoundKitVideoPlayer({
  autoPlay = false,
  externalPlaybackUrl,
  muxPlaybackId,
  onEnded,
  onError,
  onPaused,
  onPlaying,
  onProgress,
  playerRef,
  posterUrl,
  title,
  verifiedOnPlatform,
  videoId,
}: {
  autoPlay?: boolean;
  externalPlaybackUrl?: string | null;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onPaused?: () => void;
  onPlaying?: () => void;
  onProgress?: (seconds: number, duration: number) => void;
  playerRef?: Ref<VideoPlaybackHandle>;
  muxPlaybackId?: string | null;
  posterUrl: string;
  title: string;
  verifiedOnPlatform: boolean;
  videoId?: string;
}) {
  const { containerRef, isFullscreen, toggleFullscreen } =
      useBrowserFullscreen(),
    muxRef = useRef<MuxPlayerRefAttributes>(null),
    nativeRef = useRef<HTMLVideoElement>(null),
    youtubeRef = useRef<VideoPlaybackHandle>(null),
    telemetryRef = useRef<VideoViewTelemetry | null>(null),
    analyticsStartedRef = useRef<string | null>(null),
    analyticsIdentity =
      videoId ?? muxPlaybackId ?? externalPlaybackUrl ?? "video",
    analyticsProvider = videoAnalyticsProvider(
      muxPlaybackId,
      externalPlaybackUrl
    ),
    handleAnalyticsPlaying = () => {
      if (analyticsStartedRef.current !== analyticsIdentity) {
        analyticsStartedRef.current = analyticsIdentity;
        capture("video_play_started", { provider: analyticsProvider });
      }
      onPlaying?.();
    },
    handleAnalyticsEnded = () => {
      if (analyticsStartedRef.current === analyticsIdentity) {
        capture("video_play_completed", { provider: analyticsProvider });
        analyticsStartedRef.current = null;
      }
      onEnded?.();
    },
    handleAnalyticsError = (message: string) => {
      capture("playback_failed", {
        media_type: "video",
        provider: analyticsProvider,
        reason: "provider",
      });
      onError?.(message);
    },
    startViewSession = async (event: { currentTarget: EventTarget | null }) => {
      if (telemetryRef.current || !videoId) {
        return;
      }

      const position = playbackPositionFromEvent(event);
      try {
        const session = await createVideoViewSession(videoId, {
          anonymousId: getAnonymousViewerId(),
          durationSeconds: position.durationSeconds,
        });
        telemetryRef.current = {
          id: session.id,
          lastReportedSeconds: 0,
          token: session.token,
        };
      } catch {
        // Playback analytics must never interrupt video playback.
      }
    },
    sendProgress = (
      event: { currentTarget: EventTarget | null },
      ended = false,
      force = false
    ) => {
      const telemetry = telemetryRef.current;
      if (!telemetry || !videoId) {
        return;
      }

      const position = playbackPositionFromEvent(event);
      if (
        !(
          ended ||
          force ||
          position.playedSeconds - telemetry.lastReportedSeconds >= 10
        )
      ) {
        return;
      }

      telemetry.lastReportedSeconds = position.playedSeconds;
      void reportAnalytics(
        updateVideoViewSession(
          videoId,
          telemetry.id,
          {
            durationSeconds: position.durationSeconds,
            ended,
            playedSeconds: position.playedSeconds,
            token: telemetry.token,
          },
          ended
        )
      );
    },
    youtubeId = externalPlaybackUrl
      ? getYouTubeVideoId(externalPlaybackUrl)
      : null;

  useImperativeHandle(
    playerRef,
    () => ({
      toggleMute: () => {
        if (muxRef.current) muxRef.current.muted = !muxRef.current.muted;
        else if (nativeRef.current)
          nativeRef.current.muted = !nativeRef.current.muted;
        else youtubeRef.current?.toggleMute();
      },
      pause: () => {
        muxRef.current?.pause();
        nativeRef.current?.pause();
        youtubeRef.current?.pause();
      },
      play: async () => {
        try {
          if (muxRef.current) {
            await muxRef.current.play();
          } else if (nativeRef.current) {
            await nativeRef.current.play();
          } else {
            youtubeRef.current?.play();
          }
        } catch {
          onPaused?.();
        }
      },
      requestPictureInPicture: async () => {
        const media = muxRef.current?.media ?? nativeRef.current;
        if (!media) {
          return false;
        }
        const native = nativeRef.current ?? muxRef.current?.media?.nativeEl;
        if (!native) {
          return false;
        }
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          return true;
        }
        if (
          document.pictureInPictureEnabled &&
          typeof media.requestPictureInPicture === "function"
        ) {
          await media.requestPictureInPicture();
          capture("pip_entered", {
            media_type: "video",
            provider: analyticsProvider,
          });
          return true;
        }
        const safari = native as HTMLVideoElement & {
          webkitSetPresentationMode?: (mode: string) => void;
          webkitSupportsPresentationMode?: (mode: string) => boolean;
        };
        if (safari.webkitSupportsPresentationMode?.("picture-in-picture")) {
          safari.webkitSetPresentationMode?.("picture-in-picture");
          return true;
        }
        return false;
      },
      seek: (seconds) => {
        if (muxRef.current) {
          muxRef.current.currentTime = Math.max(0, seconds);
        } else if (nativeRef.current) {
          nativeRef.current.currentTime = Math.max(0, seconds);
        } else {
          youtubeRef.current?.seek(seconds);
        }
      },
    }),
    [onPaused, analyticsProvider]
  );

  useEffect(
    () => () => {
      const telemetry = telemetryRef.current;
      if (!telemetry || !videoId) {
        return;
      }

      void reportAnalytics(
        updateVideoViewSession(
          videoId,
          telemetry.id,
          {
            ended: true,
            playedSeconds: telemetry.lastReportedSeconds,
            token: telemetry.token,
          },
          true
        )
      );
      telemetryRef.current = null;
    },
    [videoId]
  );

  if (muxPlaybackId) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl border border-border/50 bg-black"
        ref={containerRef}
      >
        <MuxPlayer
          accentColor="#A798FF"
          autoPlay={autoPlay}
          ref={muxRef}
          className="aspect-video w-full"
          metadata={{
            video_id: videoId,
            video_title: title,
          }}
          onEnded={(event) => {
            sendProgress(event, true, true);
            handleAnalyticsEnded();
          }}
          onError={() =>
            handleAnalyticsError(
              "This video could not play. Try again or choose another item."
            )
          }
          onPause={(event) => {
            sendProgress(event, false, true);
            onPaused?.();
          }}
          onPlay={startViewSession}
          onPlaying={handleAnalyticsPlaying}
          onTimeUpdate={(event) => {
            sendProgress(event);
            const position = playbackPositionFromEvent(event);
            onProgress?.(position.playedSeconds, position.durationSeconds ?? 0);
          }}
          playbackId={muxPlaybackId}
          poster={posterUrl}
          streamType="on-demand"
        />
        <Button
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="absolute bottom-4 right-4 z-10 size-8 bg-black/70 text-white hover:bg-black/90"
          onClick={toggleFullscreen}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isFullscreen ? (
            <Minimize className="size-4" />
          ) : (
            <Maximize className="size-4" />
          )}
        </Button>
        {verifiedOnPlatform ? (
          <Badge className="absolute left-4 top-4 bg-black/80 text-white">
            <ShieldCheck className="mr-1 size-3.5 text-emerald-400" />
            SoundKit Verified
          </Badge>
        ) : null}
      </div>
    );
  }

  const playbackBaseUrl =
      typeof window === "undefined"
        ? "https://mysoundkit.com"
        : window.location.origin,
    directSource = externalPlaybackUrl
      ? directVideoUrl(externalPlaybackUrl, playbackBaseUrl)
      : null,
    externalSource = externalPlaybackUrl
      ? httpUrl(externalPlaybackUrl, playbackBaseUrl)
      : null;
  if (directSource) {
    return (
      <video
        autoPlay={autoPlay}
        className="aspect-video min-h-[200px] w-full rounded-2xl bg-black"
        controls
        playsInline
        poster={posterUrl}
        ref={nativeRef}
        src={directSource.href}
        onEnded={(event) => {
          sendProgress(event, true, true);
          handleAnalyticsEnded();
        }}
        onError={() =>
          handleAnalyticsError(
            "This video could not play. Try again or choose another item."
          )
        }
        onPause={(event) => {
          sendProgress(event, false, true);
          onPaused?.();
        }}
        onPlay={startViewSession}
        onPlaying={handleAnalyticsPlaying}
        onTimeUpdate={(event) => {
          sendProgress(event);
          const position = playbackPositionFromEvent(event);
          onProgress?.(position.playedSeconds, position.durationSeconds ?? 0);
        }}
      >
        <track kind="captions" />
      </video>
    );
  }

  if (youtubeId) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-black">
        <YouTubePlayerView
          autoPlay={autoPlay}
          onEnded={handleAnalyticsEnded}
          onError={handleAnalyticsError}
          onPaused={onPaused}
          onPlaying={handleAnalyticsPlaying}
          onProgress={onProgress}
          playerRef={youtubeRef}
          title={title}
          youtubeId={youtubeId}
        />
        <p className="px-3 py-2 text-xs text-muted-foreground">YouTube</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/70">
      <div className="aspect-video">
        <img
          alt={`${title} poster`}
          className="h-full w-full object-cover opacity-40"
          height={720}
          src={posterUrl}
          width={1280}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/80 via-black/50 to-black/20 px-6 text-center text-white">
        <div className="rounded-full border border-white/15 bg-black/50 p-4">
          <VideoOff className="size-8 text-white/80" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold">Playback will appear here</p>
          <p className="max-w-md text-sm text-white/75">
            This video is still waiting on an on-platform playback ID or an
            embeddable external source.
          </p>
        </div>
        {externalSource ? (
          <Button asChild={true} variant="secondary">
            <a
              href={externalSource.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink className="mr-2 size-4" />
              Open Source Video
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
