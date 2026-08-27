import { Link } from "@tanstack/react-router";
import { Eye, Lock, Play, Radio, ShieldCheck } from "lucide-react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface ExploreVideoCardData {
  creator: {
    avatarUrl?: null | string;
    name: string;
    slug: string;
  };
  duration: string;
  id: string;
  playbackPolicy: "premium_only_live" | "public" | "signed";
  regionSlug?: string | null;
  slug?: string | null;
  status: string;
  thumbnail: string;
  title: string;
  verifiedOnPlatform: boolean;
  videoKind:
    | "music_video"
    | "promo"
    | "teaser"
    | "battle_replay"
    | "battle_clip"
    | "live_recording";
  viewCount: string;
}

const kindLabels: Record<ExploreVideoCardData["videoKind"], string> = {
  battle_clip: "Battle Clip",
  battle_replay: "Battle Replay",
  live_recording: "Live Recording",
  music_video: "Music Video",
  promo: "Promo",
  teaser: "Teaser",
};

export function VideoCard({ video }: { video: ExploreVideoCardData }) {
  const isLive = video.status === "live",
    isPremiumLive = video.playbackPolicy === "premium_only_live",
    sourceLabel = video.verifiedOnPlatform ? "SoundKit" : "YouTube",
    videoLink =
      video.regionSlug && video.slug
        ? {
            params: { regionSlug: video.regionSlug, slug: video.slug },
            to: "/videos/$regionSlug/$slug" as const,
          }
        : { params: { id: video.id }, to: "/videos/$id" as const };

  return (
    <Link
      {...videoLink}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <PublicCard aria-label={`${video.title} video`} data-testid="video-card">
        <PublicCardThumbnail data-testid="video-card-thumbnail">
          <AppImage
            alt={`${video.title} thumbnail`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            height={720}
            layout="constrained"
            loading="lazy"
            src={video.thumbnail}
            width={1280}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
            <Badge variant={isLive ? "destructive" : "secondary"}>
              {isLive ? "Live" : kindLabels[video.videoKind]}
            </Badge>
            {isPremiumLive ? (
              <Badge className="bg-black/75 text-white">
                <Lock aria-hidden="true" />
                Premium
              </Badge>
            ) : null}
          </div>

          <span className="absolute top-1/2 left-1/2 flex size-11 -translate-1/2 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white opacity-90 transition-[transform,background-color] group-hover:scale-105 group-hover:bg-primary motion-reduce:transition-none motion-reduce:group-hover:scale-100">
            <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
          </span>

          {video.duration && video.duration !== "0:00" ? (
            <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 font-medium text-[11px] text-white tabular-nums">
              {video.duration}
            </span>
          ) : null}
        </PublicCardThumbnail>

        <PublicCardMeta className="flex items-start gap-2.5">
          <Avatar className="size-9 shrink-0 rounded-md">
            <AvatarImage
              alt={`${video.creator.name} profile photo`}
              src={video.creator.avatarUrl ?? undefined}
            />
            <AvatarFallback>
              {video.creator.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold text-sm leading-snug transition-colors group-hover:text-primary">
              {video.title}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-muted-foreground text-xs">
              <span className="truncate">{video.creator.name}</span>
              {video.verifiedOnPlatform ? (
                <ShieldCheck
                  aria-label="SoundKit verified"
                  className="size-3 shrink-0 text-primary"
                />
              ) : null}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
              <span className="flex items-center gap-1">
                <Eye aria-hidden="true" className="size-3" />
                {video.viewCount} views
              </span>
              <span aria-hidden="true">•</span>
              <span className="flex items-center gap-1">
                {isLive ? (
                  <Radio
                    aria-hidden="true"
                    className="size-3 text-destructive"
                  />
                ) : null}
                {isLive ? "Streaming now" : sourceLabel}
              </span>
            </p>
          </div>
        </PublicCardMeta>
      </PublicCard>
    </Link>
  );
}
