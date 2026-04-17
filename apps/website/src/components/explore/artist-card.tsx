import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ArtistCardProps {
  slug: string;
  name: string;
  avatar: string;
  genre: string;
  followers: string;
  verified?: boolean;
}

export function ArtistCard({
  slug,
  name,
  avatar,
  genre,
  followers,
  verified,
}: ArtistCardProps) {
  return (
    <Link to={`/artist/${slug}`} className="block w-full md:w-auto">
      <Card className="overflow-hidden hover:shadow-lg transition-all group min-w-[140px] sm:min-w-[160px] md:min-w-0 md:w-[180px] lg:w-[200px] xl:w-[220px] flex-shrink-0 p-0">
        <CardContent className="p-0 space-y-0">
          <div className="relative aspect-square w-full bg-muted">
            <Avatar className="size-full rounded-none ring-0 group-hover:ring-2 group-hover:ring-primary transition-all">
              <AvatarImage
                src={avatar || "/placeholder.svg"}
                alt={name}
                className="object-cover"
              />
              <AvatarFallback className="rounded-none text-2xl">
                {name ? name.slice(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="p-3 flex flex-col items-center text-center">
            <div className="flex items-center gap-1 mb-1">
              <h3 className="font-semibold text-sm truncate max-w-[120px] group-hover:text-primary transition-colors">
                {name}
              </h3>
              {verified && (
                <CheckCircle2 className="size-3 text-primary shrink-0" />
              )}
            </div>
            <Badge variant="secondary" className="text-xs mb-2">
              {genre}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {followers} followers
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
