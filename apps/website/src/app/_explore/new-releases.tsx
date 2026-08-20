import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flame, MapPin } from "lucide-react";

import { TrackCard } from "@/components/explore/track-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTracksQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/new-releases")({
  component: NewReleasesPage,
});

function NewReleasesPage() {
  const router = useRouter(),
    searchParams = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search
    ),
    location = searchParams.get("location") || "All Locations",
    { data: tracks = [] } = useTracksQuery(undefined, {
      limit: 24,
      scope: "public",
      sort: "title-desc",
    });

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-2">
          <Flame className="size-6 md:size-8 text-primary" />
          New Releases
        </h1>
        <p className="text-muted-foreground text-sm md:text-base flex items-center gap-2">
          <MapPin className="size-4" />
          {location}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {tracks.length > 0 ? (
          tracks.map((track, index) => (
            <div key={track.id} className="relative">
              {index < 6 && (
                <Badge
                  className="absolute -top-2 -right-2 z-10 text-xs"
                  variant="default"
                >
                  New
                </Badge>
              )}
              <TrackCard
                id={track.id}
                title={track.title}
                artist={track.artistName}
                artistSlug={track.artistUsername ?? "artist"}
                cover={track.coverArtUrl ?? "/placeholder.svg"}
                plays={track.plays.toLocaleString()}
                duration={track.duration}
                regionSlug={track.regionSlug}
                slug={track.slug}
              />
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            No public releases are live yet.
          </div>
        )}
      </div>
    </div>
  );
}
