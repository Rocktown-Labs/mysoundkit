import { createFileRoute, Link } from "@tanstack/react-router";
import { Video, ArrowLeft } from "lucide-react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import { Button } from "@/components/ui/button";
import { useLibraryWatchedQuery, useMeQuery } from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/watched/")({
  component: RecentlyWatchedPage,
});

function RecentlyWatchedPage() {
  const { data = [], isLoading } = useLibraryWatchedQuery(),
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
          <Video className="size-8 text-primary" />
          Recently Watched
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Battles, videos, and streams you've watched
        </p>
      </div>

      {isLoading || data.length > 0 ? (
        <DataTable columns={columns} data={data} />
      ) : (
        <LibraryEmptyState
          actionHref={isSignedIn ? "/live" : "/login"}
          actionLabel={isSignedIn ? "Explore Live" : "Log In"}
          description={
            isSignedIn
              ? "Watch battles, videos, parties, and streams to build your watch history."
              : "Log in to save your watch history for battles, videos, parties, and streams."
          }
          icon={Video}
          secondaryHref={isSignedIn ? "/videos" : "/signup"}
          secondaryLabel={isSignedIn ? "Browse Videos" : "Create Account"}
          title={
            isSignedIn
              ? "No watched items yet"
              : "Log in to track recently watched"
          }
        />
      )}
    </div>
  );
}
