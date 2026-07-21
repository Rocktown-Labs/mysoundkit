import { Link } from "@tanstack/react-router";
import { TrendingUp, Users, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface LeaderboardArtist {
  rank: number;
  slug: string;
  name: string;
  avatar: string;
  genre: string;
  location: string;
  stats: {
    plays?: string;
    followers?: string;
    battleWins?: number;
  };
  verified?: boolean;
}

interface ArtistLeaderboardCardProps {
  artists: LeaderboardArtist[];
  type: "rising" | "new" | "top";
  showBorder?: boolean;
}

export function ArtistLeaderboardCard({
  artists,
  type,
  showBorder = true,
}: ArtistLeaderboardCardProps) {
  const getStatIcon = () => {
    switch (type) {
      case "rising": {
        return <TrendingUp className="size-3 text-primary" />;
      }
      case "new": {
        return <Users className="size-3 text-green-500" />;
      }
      case "top": {
        return <Trophy className="size-3 text-amber-500" />;
      }
    }
  };

  const getStatLabel = (artist: LeaderboardArtist) => {
    switch (type) {
      case "rising": {
        return `${artist.stats.plays} plays this week`;
      }
      case "new": {
        return `Joined recently • ${artist.stats.followers} followers`;
      }
      case "top": {
        return `${artist.stats.followers} followers • ${artist.stats.battleWins} wins`;
      }
    }
  };

  return (
    <div
      className={showBorder ? "bg-card rounded-lg p-4 space-y-3" : "space-y-3"}
    >
      {artists.map((artist) => (
        <Link
          key={artist.slug}
          to="/artist/$username"
          params={{ username: artist.slug }}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors group"
        >
          {/* Rank Badge */}
          <div
            className={cn(
              "flex items-center justify-center size-8 rounded-full font-bold text-sm flex-shrink-0",
              artist.rank === 1 && "bg-amber-500/20 text-amber-500",
              artist.rank === 2 && "bg-zinc-400/20 text-zinc-400",
              artist.rank === 3 && "bg-orange-600/20 text-orange-600",
              artist.rank > 3 && "bg-muted text-muted-foreground"
            )}
          >
            {artist.rank}
          </div>

          {/* Avatar */}
          <Avatar className="size-12 flex-shrink-0 rounded-lg">
            <AvatarImage
              src={artist.avatar || "/placeholder.svg"}
              alt={artist.name}
            />
            <AvatarFallback>
              {artist.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors capitalize">
                {artist.name}
              </h4>
              {artist.verified && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 h-4"
                >
                  ✓
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate capitalize">
              {artist.genre}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {artist.location}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {getStatIcon()}
              <span className="text-[10px] text-muted-foreground">
                {getStatLabel(artist)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
