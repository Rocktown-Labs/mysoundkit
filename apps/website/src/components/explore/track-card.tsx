import { Link } from "@tanstack/react-router";
import { Play, Clock, Heart } from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useDbSavedTrackActions, useDbSavedTrackIds } from "@/lib/data-db";

interface TrackCardProps {
  id: string;
  title: string;
  artist: string;
  artistSlug: string;
  cover: string;
  plays: string;
  duration: string;
  regionSlug?: string | null;
  slug?: string | null;
}

export function TrackCard({
  id,
  title,
  artist,
  artistSlug,
  cover,
  plays,
  duration,
  regionSlug,
  slug,
}: TrackCardProps) {
  const { toast } = useToast(),
    { data: savedTrackIds = [] } = useDbSavedTrackIds(),
    { toggle } = useDbSavedTrackActions(),
    isSaved = savedTrackIds.some((track) => track.id === id),
    [isPending, setIsPending] = useState(false),

   handleToggleSave = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPending) {
        return;
      }

      setIsPending(true);
      try {
        await toggle(id).isPersisted.promise;
        toast({
          description: isSaved
            ? `Removed "${title}" from your Saved Tracks.`
            : `Saved "${title}" to your Saved Tracks.`,
          title: isSaved ? "Removed from Library" : "Saved to Library",
        });
      } catch {
        toast({
          description: "Please sign in to save tracks.",
          title: "Sign in required",
          variant: "destructive",
        });
      } finally {
        setIsPending(false);
      }
    },
    trackLink =
      regionSlug && slug
        ? {
            params: { regionSlug, slug },
            to: "/tracks/$regionSlug/$slug" as const,
          }
        : { params: { id }, to: "/tracks/$id" as const };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] xl:w-[220px] flex-shrink-0 p-0">
      <CardContent className="p-0 space-y-0">
        <div className="relative aspect-square overflow-hidden">
          <Link {...trackLink} className="block w-full h-full">
            <AppImage
              src={cover || "/placeholder.svg"}
              alt={title}
              width={440}
              height={440}
              layout="constrained"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="size-10 md:size-12 rounded-full bg-primary flex items-center justify-center">
                <Play className="size-5 md:size-6 fill-primary-foreground text-primary-foreground ml-0.5" />
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleToggleSave}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            title={isSaved ? "Remove from Saved" : "Save Track"}
          >
            <Heart
              className={`size-3.5 ${
                isSaved ? "fill-rose-500 text-rose-500" : ""
              }`}
            />
          </button>
        </div>
        <div className="p-2 md:p-3">
          <Link {...trackLink}>
            <h3 className="font-medium text-xs md:text-sm truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
          </Link>
          <Link
            to="/artist/$username"
            params={{ username: artistSlug }}
            className="text-[10px] md:text-xs text-muted-foreground hover:text-primary truncate block"
          >
            {artist}
          </Link>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] md:text-xs text-muted-foreground">
            <Clock className="size-2.5 md:size-3" />
            <span>{duration}</span>
            <span className="mx-1">•</span>
            <span>{plays} plays</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
