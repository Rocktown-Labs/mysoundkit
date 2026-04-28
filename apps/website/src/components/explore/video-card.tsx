import { Link } from "@tanstack/react-router";
import { Eye, Lock, Radio, ShieldCheck, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MockVideo } from "@/lib/mock-videos";

const kindLabels: Record<MockVideo["videoKind"], string> = {
  battle_replay: "Battle Replay",
  live_recording: "Live Recording",
  music_video: "Music Video",
  promo: "Promo",
  teaser: "Teaser",
};

export function VideoCard({
  video,
  compact = false,
}: {
  compact?: boolean;
  video: MockVideo;
}) {
  const isPremiumLive = video.playbackPolicy === "premium_only_live";

  return (
    <Link to="/videos/$id" params={{ id: video.id }}>
      <Card className="overflow-hidden border-border/50 bg-card/60 transition-colors hover:border-primary/60">
        <div
          className={`relative ${compact ? "aspect-[16/10]" : "aspect-video"}`}
        >
          <img
            src={video.thumbnail}
            alt={`${video.title} thumbnail`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge
              variant={video.status === "live" ? "destructive" : "secondary"}
            >
              {video.status === "live" ? "Live" : kindLabels[video.videoKind]}
            </Badge>
            <Badge className="bg-black/70 text-white">
              {video.verifiedOnPlatform ? (
                <>
                  <ShieldCheck className="mr-1 size-3 text-emerald-400" />
                  SoundKit Verified
                </>
              ) : (
                "External Source"
              )}
            </Badge>
            {isPremiumLive ? (
              <Badge className="bg-black/70 text-white">
                <Lock className="mr-1 size-3" />
                Premium Live
              </Badge>
            ) : null}
          </div>
          <div className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {video.duration}
          </div>
        </div>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <h3 className="line-clamp-1 font-semibold">{video.title}</h3>
            <p className="text-sm text-muted-foreground">
              {video.creator.name}
            </p>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="size-3.5" />
              {video.viewCount} views
            </span>
            <span className="flex items-center gap-1">
              {video.status === "live" ? (
                <Radio className="size-3.5 text-red-500" />
              ) : (
                <Video className="size-3.5" />
              )}
              {video.status === "live"
                ? "Streaming now"
                : (video.verifiedOnPlatform
                  ? "Hosted on SoundKit"
                  : "Linked from source")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
