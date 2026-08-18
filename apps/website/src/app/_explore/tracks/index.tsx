/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Music } from "lucide-react";
import type { ReactNode } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { ExploreCollectionGrid } from "@/components/explore/explore-collection";
import { TrackCard } from "@/components/explore/track-card";
import { Button } from "@/components/ui/button";
import { musicGenres } from "@/lib/music-genres";
import { useTracksQuery } from "@/lib/soundkit-api-hooks";

const sortOptions = [
  { label: "Most Played", value: "plays-desc" },
  { label: "Least Played", value: "plays-asc" },
  { label: "Title (A-Z)", value: "title-asc" },
  { label: "Title (Z-A)", value: "title-desc" },
];

interface TracksSearch {
  genre?: string;
  q?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
  view?: "all" | "sections";
}

export const Route = createFileRoute("/_explore/tracks/")({
  component: TracksPage,
  validateSearch: (search: Record<string, unknown>): TracksSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
    view: search.view === "all" ? "all" : "sections",
  }),
});

function TracksPage() {
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    savedRegionType =
      typeof window === "undefined"
        ? null
        : (localStorage.getItem("exploreRegionType") as
            | "north-america"
            | "global"
            | null),
    savedRegion =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("exploreRegion"),
    regionType = search.regionType ?? savedRegionType ?? "north-america",
    region =
      search.region ??
      (search.regionType === "global"
        ? "all"
        : (savedRegion ?? (regionType === "global" ? "all" : "us-arkansas"))),
    genre = search.genre ?? "all",
    q = search.q ?? "",
    sort = search.sort ?? "plays-desc",
    view = search.view ?? "sections",
    updateFilters = (next: Partial<TracksSearch>) => {
      const nextRegionType = next.regionType ?? regionType,
        nextRegion =
          next.region ??
          (next.regionType === "global" && regionType !== "global"
            ? "all"
            : next.regionType === "north-america" &&
                regionType !== "north-america"
              ? "us-arkansas"
              : region);
      if (typeof window !== "undefined") {
        localStorage.setItem("exploreRegionType", nextRegionType);
        localStorage.setItem("exploreRegion", nextRegion);
      }
      navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          genre: next.genre ?? genre,
          q: next.q ?? q,
          region: nextRegion,
          regionType: nextRegionType,
          sort: next.sort ?? sort,
          view: next.view ?? view,
        }),
      });
    },
    { data: tracks = [], isLoading } = useTracksQuery(undefined, {
      genre,
      limit: 48,
      q: q || undefined,
      region,
      regionType,
      scope: "public",
      sort,
    });

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
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
        onRegionTypeChange={(nextRegionType) =>
          updateFilters({ regionType: nextRegionType })
        }
        onRegionChange={(nextRegion) => updateFilters({ region: nextRegion })}
        onGenreChange={(nextGenre) => updateFilters({ genre: nextGenre })}
        onSortChange={(nextSort) => updateFilters({ sort: nextSort })}
        sortOptions={sortOptions}
      />

      {view === "all" || genre !== "all" ? (
        <ExploreCollectionGrid
          empty="No songs found for the selected filters."
          isLoading={isLoading}
          items={tracks}
          title={genre === "all" ? "All Songs" : "Matching Songs"}
        >
          {(track) => (
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
          )}
        </ExploreCollectionGrid>
      ) : (
        <>
          <div className="mb-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold text-xl">Featured Songs</h2>
              <Button
                onClick={() => {
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      genre,
                      q,
                      region,
                      regionType,
                      sort,
                      view: "all",
                    }),
                  });
                }}
                size="sm"
                variant="ghost"
              >
                View All
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
                    regionSlug={track.regionSlug}
                    slug={track.slug}
                  />
                ))}
              </div>
            ) : (
              <TrackEmptyState>
                No songs found for these filters.
              </TrackEmptyState>
            )}
          </div>
          <div className="flex flex-col gap-10">
            {musicGenres.map((sectionGenre) => (
              <TrackGenreRail
                key={sectionGenre.value}
                genre={sectionGenre}
                region={region}
                regionType={regionType}
                sort={sort}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrackGenreRail({
  genre,
  region,
  regionType,
  sort,
}: {
  genre: (typeof musicGenres)[number];
  region: string;
  regionType: "north-america" | "global";
  sort: string;
}) {
  const { data: tracks = [], isLoading } = useTracksQuery(undefined, {
    genre: genre.value,
    limit: 12,
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
            search={{
              genre: genre.value,
              region,
              regionType,
              sort,
              view: "all",
            }}
            to="/tracks"
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
              regionSlug={track.regionSlug}
              slug={track.slug}
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
