import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Music } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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

const discoveryGenres = [
  { label: "Hip-Hop", value: "hip-hop" },
  { label: "R&B/Soul", value: "rb-soul" },
  { label: "Pop", value: "pop" },
  { label: "Electronic", value: "electronic" },
  { label: "Spoken Word", value: "spoken-word" },
] as const;

interface TracksSearch {
  genre?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
}

const replaceExploreSearch = (params: URLSearchParams) => {
  if (typeof window === "undefined") {
    return;
  }

  window.history.replaceState(null, "", `?${params.toString()}`);
};

export const Route = createFileRoute("/_explore/tracks/")({
  component: TracksPage,
  validateSearch: (search: Record<string, unknown>): TracksSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
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

      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-xl">Featured Songs</h2>
            <p className="text-muted-foreground text-sm">
              Ranked by the current filters, defaulting to Arkansas when no
              local signal exists yet.
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/tracks"
              search={
                { genre, region, regionType, sort } satisfies TracksSearch
              }
            >
              View All
            </Link>
          </Button>
        </div>
        {isLoading || tracks.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {tracks.slice(0, 12).map((track) => (
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
          <TrackEmptyState>
            No songs found for this filter yet. Showing Arkansas by default
            keeps discovery grounded until more local artists register.
          </TrackEmptyState>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {discoveryGenres.map((sectionGenre) => (
          <TrackGenreRail
            key={sectionGenre.value}
            genre={sectionGenre}
            region={region}
            regionType={regionType}
            sort={sort}
          />
        ))}
      </div>
    </div>
  );
}

function TrackGenreRail({
  genre,
  region,
  regionType,
  sort,
}: {
  genre: (typeof discoveryGenres)[number];
  region: string;
  regionType: "north-america" | "global";
  sort: string;
}) {
  const { data: tracks = [], isLoading } = useTracksQuery(undefined, {
    genre: genre.value,
    limit: "12",
    region,
    regionType,
    scope: "public",
    sort,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{genre.label}</h2>
          <p className="text-muted-foreground text-sm">
            Top songs from this genre.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/tracks"
            search={
              {
                genre: genre.value,
                region,
                regionType,
                sort,
              } satisfies TracksSearch
            }
          >
            View All
          </Link>
        </Button>
      </div>
      {isLoading || tracks.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
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
        <TrackEmptyState>No {genre.label} songs are live yet.</TrackEmptyState>
      )}
    </section>
  );
}

function TrackEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
      {children}
    </div>
  );
}
