import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface StreamCardProps {
  category?: string;
  creatorAvatar?: null | string;
  creatorName?: null | string;
  genre?: null | string;
  id: string;
  isLive?: boolean;
  source?: string;
  startsAt?: null | string;
  status?: string;
  tags?: string[];
  thumbnailUrl?: null | string;
  title: string;
  viewerCount?: number;
}

function formatViewerCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return count.toLocaleString();
}

export function StreamCard({
  category,
  creatorAvatar,
  creatorName = "SoundKit Creator",
  genre,
  id,
  isLive,
  startsAt,
  status,
  tags,
  thumbnailUrl,
  title,
  viewerCount = 0,
}: StreamCardProps) {
  const isCurrentlyLive = isLive ?? status === "live",
    isScheduled =
      !isCurrentlyLive && (status === "scheduled" || Boolean(startsAt)),
    resolvedCategory = genre || category || "Music",
    displayName = creatorName || "SoundKit Creator",
    posterImage =
      thumbnailUrl ||
      (isCurrentlyLive
        ? "/music-battle-video-thumbnail.jpg"
        : "/night-music-album-cover.png"),
    // Derive relevant tag pills (e.g. genre, language/style)
    resolvedTags =
      tags && tags.length > 0
        ? tags
        : [
            resolvedCategory.toLowerCase(),
            isCurrentlyLive ? "live" : "upcoming",
          ].filter(Boolean);

  return (
    <Link
      className="group block w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      params={{ id }}
      to="/live/streams/$id"
    >
      <div className="flex flex-col gap-2.5">
        {/* 16:9 Thumbnail Poster with authentic Twitch overlays */}
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted transition-transform duration-300 group-hover:scale-[1.02]">
          <AppImage
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            height={720}
            src={posterImage}
            width={1280}
          />

          {/* Top-Left Live / Scheduled Badge */}
          <div className="absolute left-2 top-2">
            {isCurrentlyLive ? (
              <div className="rounded-[4px] bg-red-600 px-1.5 py-0.5 font-bold text-[11px] uppercase tracking-wider text-white shadow-sm">
                LIVE
              </div>
            ) : (isScheduled ? (
              <div className="flex items-center gap-1 rounded-[4px] bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                <CalendarClock className="size-3 text-primary" />
                Scheduled
              </div>
            ) : (
              <div className="rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
                Ended
              </div>
            ))}
          </div>

          {/* Bottom-Left Viewer Count / Scheduled Time */}
          <div className="absolute bottom-2 left-2">
            {isCurrentlyLive ? (
              <div className="rounded-[4px] bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
                {formatViewerCount(viewerCount)} viewers
              </div>
            ) : (startsAt ? (
              <div className="flex items-center gap-1 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                <CalendarClock className="size-3 text-primary" />
                {new Date(startsAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            ) : null)}
          </div>
        </div>

        {/* Stream Details under thumbnail */}
        <div className="flex items-start gap-2.5 px-0.5">
          <Avatar className="size-9 shrink-0">
            <AvatarImage
              alt={displayName}
              src={creatorAvatar ?? "/diverse-user-avatars.png"}
            />
            <AvatarFallback>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-0.5">
            {/* Title */}
            <h3 className="line-clamp-1 font-bold text-sm leading-tight text-foreground transition-colors group-hover:text-primary">
              {title}
            </h3>

            {/* Streamer Name */}
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground">
              <span>{displayName}</span>
              <CheckCircle2 className="size-3 fill-primary/20 text-primary shrink-0" />
            </p>

            {/* Category / Genre */}
            <p className="truncate text-xs text-muted-foreground">
              {resolvedCategory}
            </p>

            {/* Tag Pills */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {resolvedTags.map((tag) => (
                <span
                  className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground transition-colors hover:bg-secondary"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
