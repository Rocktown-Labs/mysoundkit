import { Link } from "@tanstack/react-router";
import { Play, Users, Eye, Lock } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface StreamCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatar: string;
  thumbnailUrl: string;
  viewerCount: number;
  category: string;
  isLive?: boolean;
  isPremiumUser?: boolean;
}

export function StreamCard({
  id,
  title,
  creatorName,
  creatorAvatar,
  thumbnailUrl,
  viewerCount,
  category,
  isLive = true,
  isPremiumUser = false,
}: StreamCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group flex-shrink-0 w-[280px] md:w-[320px] bg-card border-border">
      <CardContent className="p-0">
        <Link
          to={isPremiumUser ? "/live/streams/$id" : "/pricing"}
          params={isPremiumUser ? { id } : undefined}
        >
          <div className="relative aspect-video overflow-hidden">
            <AppImage
              src={thumbnailUrl}
              alt={title}
              width={320}
              height={180}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

            <div className="absolute top-2 left-2 flex gap-2">
              {isLive && (
                <Badge
                  variant="destructive"
                  className="bg-red-600 font-bold text-[10px] uppercase tracking-wider"
                >
                  Live
                </Badge>
              )}
              <Badge
                variant="secondary"
                className="bg-black/60 backdrop-blur text-white text-[10px] border-none"
              >
                <Eye className="size-3 mr-1" />
                {viewerCount.toLocaleString()}
              </Badge>
            </div>

            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-semibold text-white">
              {category}
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isPremiumUser ? (
                <div className="size-12 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all">
                  <Play className="size-6 text-primary-foreground fill-primary-foreground ml-1" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="size-12 rounded-full bg-background/90 flex items-center justify-center backdrop-blur shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all">
                    <Lock className="size-5 text-foreground" />
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-background/90 font-bold transform translate-y-4 group-hover:translate-y-0 transition-all delay-75"
                  >
                    Upgrade to Watch
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </Link>

        <div className="p-4 flex gap-3">
          <Avatar className="size-10 border border-border shrink-0">
            <AvatarImage src={creatorAvatar} alt={creatorName} />
            <AvatarFallback>{creatorName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm leading-tight mb-1 truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {creatorName}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
