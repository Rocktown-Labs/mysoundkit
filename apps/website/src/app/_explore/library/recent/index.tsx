import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ArrowLeft } from "lucide-react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import { Button } from "@/components/ui/button";
import { useLibraryRecentQuery, useMeQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/recent/")({
  component: RecentlyPlayedPage,
});

function RecentlyPlayedPage() {
  const { data = [], isLoading } = useLibraryRecentQuery(),
    { data: me } = useMeQuery(),
    isSignedIn = Boolean(me?.user);

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
        <LibraryEmptyState
          actionHref={isSignedIn ? "/tracks" : "/login"}
          actionLabel={isSignedIn ? "Browse Songs" : "Log In"}
          description={
            isSignedIn
              ? "Play songs from SoundKit and your listening history will start building here."
              : "Log in to keep a listening history across songs, playlists, and artists."
          }
          icon={Clock}
          secondaryHref={isSignedIn ? undefined : "/signup"}
          secondaryLabel={isSignedIn ? undefined : "Create Account"}
          title={
            isSignedIn
              ? "No recent plays yet"
              : "Log in to track recently played songs"
          }
        />
      )}
    </div>
  );
}
