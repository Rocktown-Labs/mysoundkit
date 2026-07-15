import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Music } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { TrackCard } from "@/components/explore/track-card";
import { Button } from "@/components/ui/button";
import { useTracksQuery } from "@/lib/soundkit-api-hooks";

const sortOptions = [
  { label: "Most Played", value: "plays-desc" },
  { label: "Least Played", value: "plays-asc" },
  { label: "Title (A-Z)", value: "title-asc" },
  { label: "Title (Z-A)", value: "title-desc" },
];

const replaceExploreSearch = (params: URLSearchParams) => {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(null, "", `?${params.toString()}`);
};

export const Route = createFileRoute("/_explore/tracks/")({
  component: TracksPage,
});

function TracksPage() {
  const router = useRouter();
  const searchQuery =
    typeof window === "undefined" ? "" : window.location.search;
  const searchParams = new URLSearchParams(searchQuery);
  const isInitialMount = useRef(true);

  const [regionType, setRegionType] = useState<"north-america" | "global">(
    "north-america"
  );
  const [region, setRegion] = useState("us-arkansas");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("plays-desc");

  // Initialize from URL params or localStorage
  useEffect(() => {
    const urlRegionType = searchParams.get("regionType") as
      | "north-america"
      | "global"
      | null;
    const urlRegion = searchParams.get("region");
    const urlGenre = searchParams.get("genre");
    const urlSort = searchParams.get("sort");

    if (urlRegionType || urlRegion || urlGenre || urlSort) {
      if (urlRegionType) {
        setRegionType(urlRegionType);
      }
      if (urlRegion) {
        setRegion(urlRegion);
      }
      if (urlGenre) {
        setGenre(urlGenre);
      }
      if (urlSort) {
        setSort(urlSort);
      }
    } else {
      const savedRegionType = localStorage.getItem("exploreRegionType") as
        | "north-america"
        | "global"
        | null;
      const savedRegion = localStorage.getItem("exploreRegion");
      if (savedRegionType) {
        setRegionType(savedRegionType);
      }
      if (savedRegion) {
        setRegion(savedRegion);
      }
    }
  }, [searchQuery]);

  // Update URL and localStorage on filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set("regionType", regionType);
    params.set("region", region);
    params.set("genre", genre);
    params.set("sort", sort);

    localStorage.setItem("exploreRegionType", regionType);
    localStorage.setItem("exploreRegion", region);
    replaceExploreSearch(params);
  }, [regionType, region, genre, sort]);

  const { data: tracks = [], isLoading } = useTracksQuery(undefined, {
    genre,
    limit: "48",
    region,
    regionType,
    scope: "public",
    sort,
  });

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-2">
          <Music className="size-6 md:size-8 text-primary" />
          Top Songs
        </h1>
      </div>

      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre}
        sort={sort}
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptions}
      />

      {isLoading || tracks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              id={track.id}
              title={track.title}
              artist={track.artistName}
              artistSlug={track.artistUsername ?? "artist"}
              cover={track.coverArtUrl ?? "/placeholder.svg"}
              plays={track.plays.toLocaleString()}
              duration={track.duration}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No songs found for this filter yet. Showing Arkansas by default keeps
          discovery grounded until more local artists register.
        </div>
      )}
    </div>
  );
}
