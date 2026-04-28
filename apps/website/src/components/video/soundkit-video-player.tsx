"use client";

import MuxPlayer from "@mux/mux-player-react";
import { ExternalLink, ShieldCheck, VideoOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const YOUTUBE_PATTERNS = [
  /youtu\.be\/([A-Za-z0-9_-]{6,})/,
  /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
] as const;

const getYouTubeEmbedUrl = (url: string) => {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);

    if (match?.[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }

  return null;
};

export function SoundKitVideoPlayer({
  externalPlaybackUrl,
  muxPlaybackId,
  posterUrl,
  title,
  verifiedOnPlatform,
}: {
  externalPlaybackUrl?: string | null;
  muxPlaybackId?: string | null;
  posterUrl: string;
  title: string;
  verifiedOnPlatform: boolean;
}) {
  const externalEmbedUrl = externalPlaybackUrl
    ? getYouTubeEmbedUrl(externalPlaybackUrl)
    : null;

  if (muxPlaybackId) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-black">
        <MuxPlayer
          accentColor="#A798FF"
          className="aspect-video w-full"
          metadata={{
            video_title: title,
          }}
          playbackId={muxPlaybackId}
          poster={posterUrl}
          streamType="on-demand"
        />
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
          src={posterUrl}
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
