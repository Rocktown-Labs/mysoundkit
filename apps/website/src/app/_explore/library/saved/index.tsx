import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  useLibrarySavedQuery,
  useRemoveSavedTrackMutation,
} from "@/lib/soundkit-api-hooks";

import { createSavedTrackColumns } from "./-columns";
import type { SavedTrack } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/saved/")({
  component: SavedTracksPage,
});

function SavedTracksPage() {
  const { data = [], isLoading } = useLibrarySavedQuery(),
   { toast } = useToast(),
   removeSavedTrackMutation = useRemoveSavedTrackMutation(),
   [removingTrackId, setRemovingTrackId] = useState<string>(),

   handleRemoveTrack = useCallback(
    async (track: SavedTrack) => {
      setRemovingTrackId(track.id);
      try {
        await removeSavedTrackMutation.mutateAsync(track.id);
        toast({
          description: `Removed "${track.title}" from your Saved Tracks.`,
          title: "Track removed",
        });
      } catch {
        toast({
          description: "Could not remove this track. Please try again.",
          title: "Remove failed",
          variant: "destructive",
        });
      } finally {
        setRemovingTrackId(undefined);
      }
    },
    [removeSavedTrackMutation, toast]
  ),

   columns = useMemo(
    () =>
      createSavedTrackColumns({
        onRemove: handleRemoveTrack,
        removingTrackId,
      }),
    [handleRemoveTrack, removingTrackId]
  );

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Heart className="size-8 text-primary fill-primary" />
          Saved Tracks
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Tracks you have bookmarked
        </p>
      </div>

      {isLoading || data.length > 0 ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <LibraryEmptyState
          actionHref="/tracks"
          actionLabel="Find Tracks"
          description="Save tracks from discovery to build a listening queue you can revisit later."
          icon={Heart}
          secondaryHref="/shop"
          secondaryLabel="Browse Shop"
          title="No saved tracks yet"
        />
      )}
    </div>
  );
}
