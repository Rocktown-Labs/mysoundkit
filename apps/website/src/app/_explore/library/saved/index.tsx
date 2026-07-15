import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLibrarySavedQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/saved/")({
  component: SavedTracksPage,
});

function SavedTracksPage() {
  const { data = [], isLoading } = useLibrarySavedQuery();

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
          Tracks you've bookmarked
        </p>
      </div>

      {isLoading || data.length > 0 ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Save tracks to build your library.
        </div>
      )}
    </div>
  );
}
