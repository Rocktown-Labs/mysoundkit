import { Link } from "@tanstack/react-router";
/* eslint-disable sort-vars, react/todo */
import { Clock, Heart, Play } from "lucide-react";
import { useState } from "react";
import type { MouseEvent } from "react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { AppImage } from "@/components/ui/app-image";
import { useToast } from "@/components/ui/use-toast";
import { useDbSavedTrackActions, useDbSavedTrackIds } from "@/lib/data-db";
import { cn } from "@/lib/utils";

interface TrackCardProps {
  artist: string;
  className?: string;
  artistSlug: string;
  cover: string;
  duration: string;
  id: string;
  plays: string;
  regionSlug?: null | string;
  slug?: null | string;
  title: string;
}

export function TrackCard({
  artist,
  artistSlug,
  className,
  cover,
  duration,
  id,
  plays,
  regionSlug,
  slug,
  title,
}: TrackCardProps) {
  const { toast } = useToast(),
    { data: savedTrackIds = [] } = useDbSavedTrackIds(),
    { toggle } = useDbSavedTrackActions(),
    isSaved = savedTrackIds.some((track) => track.id === id),
    [isPending, setIsPending] = useState(false),
    trackLink =
      regionSlug && slug
        ? {
            params: { regionSlug, slug },
            to: "/tracks/$regionSlug/$slug" as const,
          }
        : { params: { id }, to: "/tracks/$id" as const },
    handleToggleSave = async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
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
    };

  return (
    <PublicCard
      className={cn(
        "w-[140px] shrink-0 sm:w-[160px] md:w-[180px] lg:w-[200px] xl:w-[220px]",
        className
      )}
    >
      <PublicCardThumbnail aspect="square">
        <Link {...trackLink} className="block size-full">
          <AppImage
            alt={`${title} cover artwork`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            height={440}
            layout="constrained"
            loading="lazy"
            src={cover || "/placeholder.svg"}
            width={440}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play aria-hidden="true" className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
        </Link>
        <button
          aria-label={isSaved ? `Unsave ${title}` : `Save ${title}`}
          className="absolute top-2 right-2 z-10 rounded-full bg-black/45 p-1.5 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={handleToggleSave}
          title={isSaved ? "Remove from Saved" : "Save Track"}
          type="button"
        >
          <Heart
            aria-hidden="true"
            className={
              isSaved ? "size-3.5 fill-rose-500 text-rose-500" : "size-3.5"
            }
          />
        </button>
      </PublicCardThumbnail>

      <PublicCardMeta className="space-y-0.5">
        <Link {...trackLink}>
          <h3 className="truncate font-semibold text-sm transition-colors group-hover:text-primary">
            {title}
          </h3>
        </Link>
        <Link
          className="block truncate text-muted-foreground text-xs transition-colors hover:text-primary"
          params={{ username: artistSlug }}
          to="/artist/$username"
        >
          {artist}
        </Link>
        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
          <Clock aria-hidden="true" className="size-3" />
          <span>{duration}</span>
          <span aria-hidden="true">•</span>
          <span>{plays} plays</span>
        </div>
      </PublicCardMeta>
    </PublicCard>
  );
}
