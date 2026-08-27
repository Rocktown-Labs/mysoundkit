import { Link } from "@tanstack/react-router";
import { BarChart2, Heart, Plus, Users } from "lucide-react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ListeningPartyCardProps {
  albumCovers: string[];
  currentTrack: string;
  hostName: string;
  id: string;
  isLive?: boolean;
  listenerCount: number;
  title: string;
}

export function ListeningPartyCard({
  albumCovers,
  currentTrack,
  hostName,
  id,
  isLive = true,
  listenerCount,
  title,
}: ListeningPartyCardProps) {
  return (
    <PublicCard className="w-[300px] shrink-0 md:w-[350px]" framed>
      <PublicCardThumbnail>
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 via-card to-secondary/30">
          {albumCovers.slice(0, 3).map((cover, index) => (
            <div
              className="absolute transition-transform duration-300 group-hover:-translate-y-2"
              key={`${cover}-${index}`}
              style={{
                opacity: 1 - index * 0.18,
                transform: `scale(${1 - index * 0.1}) translateY(${index * 12}px)`,
                zIndex: albumCovers.length - index,
              }}
            >
              <AppImage
                alt={`Album cover ${index + 1}`}
                className="size-32 rounded-md object-cover shadow-lg sm:size-40"
                height={160}
                layout="fixed"
                loading="lazy"
                src={cover}
                width={160}
              />
            </div>
          ))}
        </div>
        <Badge
          className="absolute top-2 left-2"
          variant={isLive ? "destructive" : "secondary"}
        >
          {isLive ? "Live Party" : "Ended"}
        </Badge>
        <Badge
          className="absolute right-2 bottom-2 gap-1 bg-black/70 text-white"
          variant="outline"
        >
          <Users aria-hidden="true" className="size-3" />
          {listenerCount.toLocaleString()}
        </Badge>
      </PublicCardThumbnail>

      <PublicCardMeta className="space-y-3 p-4">
        <div>
          <h3 className="truncate font-bold text-lg leading-tight">{title}</h3>
          <p className="truncate text-muted-foreground text-sm">
            Hosted by {hostName}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <BarChart2
            aria-hidden="true"
            className="size-4 animate-pulse text-primary"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
              Now Playing
            </p>
            <p className="truncate font-medium text-sm">{currentTrack}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex-1" size="sm">
            <Link params={{ id }} to="/live/parties/$id">
              Join Party
            </Link>
          </Button>
          <Button aria-label={`Like ${title}`} size="icon" variant="ghost">
            <Heart aria-hidden="true" className="size-4" />
          </Button>
          <Button aria-label={`Add ${title}`} size="icon" variant="ghost">
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </PublicCardMeta>
    </PublicCard>
  );
}
