import { Link } from "@tanstack/react-router";
import { Users, Heart, Plus, BarChart2 } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ListeningPartyCardProps {
  id: string;
  title: string;
  hostName: string;
  currentTrack: string;
  listenerCount: number;
  albumCovers: string[];
  isLive?: boolean;
}

export function ListeningPartyCard({
  id,
  title,
  hostName,
  currentTrack,
  listenerCount,
  albumCovers,
  isLive = true,
}: ListeningPartyCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow flex-shrink-0 w-[300px] md:w-[350px] group bg-card border-border">
      <CardContent className="p-0">
        <div className="relative p-4 pb-0">
          {/* Aesthetic Album Stack */}
          <div className="relative h-40 w-full mb-4 flex justify-center">
            {albumCovers.map((cover, index) => (
              <div
                key={index}
                className="absolute transition-all duration-300 group-hover:-translate-y-2"
                style={{
                  opacity: 1 - index * 0.2,
                  transform: `scale(${1 - index * 0.1}) translateY(${index * 12}px)`,
                  zIndex: albumCovers.length - index,
                }}
              >
                <AppImage
                  src={cover}
                  alt={`Album cover ${index + 1}`}
                  width={160}
                  height={160}
                  className="rounded-md shadow-lg object-cover"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-start mb-2">
            <Badge
              variant="outline"
              className="bg-background/50 backdrop-blur text-xs border-primary/20"
            >
              {isLive && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" />
              )}
              {isLive ? "Live Party" : "Ended"}
            </Badge>
            <div className="flex items-center text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-full backdrop-blur">
              <Users className="size-3 mr-1" />
              {listenerCount.toLocaleString()}
            </div>
          </div>

          <h3 className="font-bold text-lg leading-tight mb-1 truncate">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground truncate mb-4">
            Hosted by {hostName}
          </p>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4">
            <BarChart2 className="size-4 text-primary animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Now Playing
              </p>
              <p className="text-sm font-medium truncate">{currentTrack}</p>
            </div>
          </div>
        </div>

        <div className="p-4 pt-0 flex gap-2">
          <Link to={`/live/parties/${id}`} className="flex-1">
            <Button className="w-full bg-primary/10 text-primary hover:bg-primary/20">
              Join Party
            </Button>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 hover:text-primary"
          >
            <Heart className="size-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 hover:text-primary"
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
