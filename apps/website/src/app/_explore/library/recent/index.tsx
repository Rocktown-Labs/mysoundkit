import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLibraryRecentQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/recent/")({
  component: RecentlyPlayedPage,
});

function RecentlyPlayedPage() {
  const { data = [], isLoading } = useLibraryRecentQuery();

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
          <Clock className="size-8 text-primary" />
          Recently Played
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Your listening history
        </p>
      </div>

      {isLoading || data.length > 0 ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Play a track and it will appear here.
        </div>
      )}
    </div>
  );
}
