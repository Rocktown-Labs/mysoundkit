import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ArtistCardProps {
  avatar: string;
  followers: string;
  genre: string;
  name: string;
  slug: string;
  verified?: boolean;
}

export function ArtistCard({
  avatar,
  followers,
  genre,
  name,
  slug,
  verified,
}: ArtistCardProps) {
  return (
    <Link
      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto"
      params={{ username: slug }}
      to="/artist/$username"
    >
      <PublicCard className="min-w-[140px] shrink-0 sm:min-w-[160px] md:w-[180px] lg:w-[200px] xl:w-[220px]">
        <PublicCardThumbnail aspect="square">
          <Avatar className="size-full rounded-lg ring-0 transition-[box-shadow] group-hover:ring-2 group-hover:ring-primary">
            <AvatarImage
              alt={`${name} profile photo`}
              className="object-cover"
              src={avatar || "/placeholder.svg"}
            />
            <AvatarFallback className="rounded-lg text-2xl">
              {name ? name.slice(0, 2).toUpperCase() : "??"}
            </AvatarFallback>
          </Avatar>
        </PublicCardThumbnail>
        <PublicCardMeta className="flex flex-col items-center text-center">
          <div className="mb-1 flex items-center gap-1">
            <h3 className="max-w-[120px] truncate font-semibold text-sm transition-colors group-hover:text-primary">
              {name}
            </h3>
            {verified ? (
              <CheckCircle2
                aria-label="Verified artist"
                className="size-3 shrink-0 text-primary"
              />
            ) : null}
          </div>
          <Badge className="mb-2 text-xs" variant="secondary">
            {genre}
          </Badge>
          <p className="text-muted-foreground text-xs">{followers} followers</p>
        </PublicCardMeta>
      </PublicCard>
    </Link>
  );
}
