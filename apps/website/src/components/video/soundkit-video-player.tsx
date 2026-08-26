"use client";

/* eslint-disable no-useless-return, one-var, sort-vars, react/iframe-missing-sandbox */
import MuxPlayer from "@mux/mux-player-react";
import {
  ExternalLink,
  Maximize,
  Minimize,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createVideoViewSession,
  updateVideoViewSession,
} from "@/lib/soundkit-api-hooks";

const VIDEO_VIEWER_STORAGE_KEY = "soundkit.video-viewer-id.v1",
  YOUTUBE_PATTERNS = [
    /youtu\.be\/(?<videoId>[A-Za-z0-9_-]{6,})/u,
    /youtube\.com\/watch\?v=(?<videoId>[A-Za-z0-9_-]{6,})/u,
    /youtube(?:-nocookie)?\.com\/(?:embed|live|shorts)\/(?<videoId>[A-Za-z0-9_-]{6,})/u,
  ] as const,
  getYouTubeEmbedUrl = (url: string) => {
    for (const pattern of YOUTUBE_PATTERNS) {
      const match = url.match(pattern);

      if (match?.groups?.videoId) {
        return `https://www.youtube.com/embed/${match.groups.videoId}`;
      }
    }

    return null;
  },
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
  playbackPositionFromEvent = (event: Event) => {
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
  externalPlaybackUrl,
  muxPlaybackId,
  posterUrl,
  title,
  verifiedOnPlatform,
  videoId,
}: {
  externalPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  posterUrl: string;
  title: string;
  verifiedOnPlatform: boolean;
  videoId?: string;
}) {
  const { containerRef, isFullscreen, toggleFullscreen } =
      useBrowserFullscreen(),
    telemetryRef = useRef<VideoViewTelemetry | null>(null),
    startViewSession = async (event: Event) => {
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
    sendProgress = (event: Event, ended = false, force = false) => {
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
    externalEmbedUrl = externalPlaybackUrl
      ? getYouTubeEmbedUrl(externalPlaybackUrl)
      : null;

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
          className="aspect-video w-full"
          metadata={{
            video_id: videoId,
            video_title: title,
          }}
          onEnded={(event) => sendProgress(event, true, true)}
          onPause={(event) => sendProgress(event, false, true)}
          onPlay={startViewSession}
          onTimeUpdate={(event) => sendProgress(event)}
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

  if (externalEmbedUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-black">
        <div className="aspect-video">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={true}
            className="h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            src={externalEmbedUrl}
            title={title}
          />
        </div>
        <Badge className="absolute left-4 top-4 bg-black/80 text-white">
          External Source
        </Badge>
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
        {externalPlaybackUrl ? (
          <Button asChild={true} variant="secondary">
            <a
              href={externalPlaybackUrl}
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
