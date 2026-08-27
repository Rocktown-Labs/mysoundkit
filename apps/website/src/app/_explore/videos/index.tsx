/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Video } from "lucide-react";
import type { ReactNode } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { ExploreCollectionGrid } from "@/components/explore/explore-collection";
import { VideoCard } from "@/components/explore/video-card";
import { Button } from "@/components/ui/button";
import { InfiniteScrollSentinel } from "@/components/ui/infinite-scroll-sentinel";
import {
  useGenresQuery,
  useVideosInfiniteQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";
import type { GenreSummary, VideoSummary } from "@/lib/soundkit-api-hooks";

const sortOptions = [
  { label: "Most Viewed", value: "views-desc" },
  { label: "Newest", value: "date-desc" },
  { label: "Title (A-Z)", value: "title-asc" },
];

interface VideosSearch {
  genre?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
  view?: "all" | "sections";
}

export const Route = createFileRoute("/_explore/videos/")({
  component: VideosPage,
  validateSearch: (search: Record<string, unknown>): VideosSearch => ({
    genre:
      search.genre === "hip-hop"
        ? "hip-hop-rap"
        : typeof search.genre === "string"
          ? search.genre
          : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
    view: search.view === "all" ? "all" : "sections",
  }),
});

function VideosPage() {
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
    sort = search.sort ?? "views-desc",
    view = search.view ?? "sections",
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    updateFilters = (next: Partial<VideosSearch>) => {
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
          region: nextRegion,
          regionType: nextRegionType,
          sort: next.sort ?? sort,
          view: next.view ?? view,
        }),
      });
    },
    {
      data: infiniteData,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoading: isLoadingInfinite,
    } = useVideosInfiniteQuery({
      genre,
      limit: 24,
      region,
      regionType,
      scope: "public",
      sort,
    }),
    allVideos = infiniteData?.pages.flat() ?? [],
    { data: sectionVideos = [], isLoading: isLoadingSection } = useVideosQuery({
      genre,
      limit: 48,
      region,
      regionType,
      scope: "public",
      sort,
    });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 font-bold text-2xl md:text-3xl lg:text-4xl">
          <Video className="size-6 text-primary md:size-8" />
          Music Videos
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Watch official music videos, battle replays, teasers, and premium live
          recordings once they wrap.
        </p>
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

      {view === "all" ? (
        <ExploreCollectionGrid
          empty="No videos found for the selected filters."
          footer={
            <InfiniteScrollSentinel
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />
          }
          isLoading={isLoadingInfinite}
          items={allVideos}
          layout="landscape"
          title={genre === "all" ? "All Videos" : "Matching Videos"}
        >
          {(video) => <ExploreVideoCard video={video} />}
        </ExploreCollectionGrid>
      ) : (
        <div className="mb-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-xl">Featured Videos</h2>
              <p className="text-muted-foreground text-sm">
                Music videos and replays ranked by the current filters.
              </p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link
                to="/videos"
                search={
                  {
                    genre,
                    region,
                    regionType,
                    sort,
                    view: "all",
                  } satisfies VideosSearch
                }
              >
                View All
              </Link>
            </Button>
          </div>
          {isLoadingSection || sectionVideos.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sectionVideos.slice(0, 12).map((video) => (
                <div className="min-w-[320px] max-w-[420px]" key={video.id}>
                  <ExploreVideoCard video={video} />
                </div>
              ))}
            </div>
          ) : (
            <VideoEmptyState>
              No videos found for this filter yet. Arkansas is selected by
              default until this region has more uploads.
            </VideoEmptyState>
          )}
        </div>
      )}

      {view === "all" ? null : (
        <div className="flex flex-col gap-10">
          {genres.map((sectionGenre) => (
            <VideoGenreRail
              key={sectionGenre.slug}
              genre={sectionGenre}
              region={region}
              regionType={regionType}
              sort={sort}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExploreVideoCard({ video }: { video: VideoSummary }) {
  return (
    <VideoCard
      video={{
        creator: {
          avatarUrl: video.creatorAvatarUrl ?? null,
          name: video.creatorName ?? "SoundKit Artist",
          slug: video.creatorUsername ?? "artist",
        },
        duration: video.duration ?? "0:00",
        id: video.id,
        playbackPolicy: video.playbackPolicy,
        regionSlug: video.regionSlug ?? null,
        slug: video.slug ?? null,
        status: video.status,
        thumbnail: video.thumbnailUrl ?? "/placeholder.svg",
        title: video.title,
        verifiedOnPlatform: video.verifiedOnPlatform,
        videoKind: video.videoKind,
        viewCount: video.viewCount ?? "0",
      }}
    />
  );
}

function VideoGenreRail({
  genre,
  region,
  regionType,
  sort,
}: {
  genre: GenreSummary;
  region: string;
  regionType: "north-america" | "global";
  sort: string;
}) {
  const { data: videos = [], isLoading } = useVideosQuery({
    genre: genre.slug,
    limit: 12,
    region,
    regionType,
    scope: "public",
    sort,
  });

  if (!isLoading && videos.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">{genre.name}</h2>
          <p className="text-muted-foreground text-sm">
            Videos from this genre.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/videos"
            search={
              {
                genre: genre.slug,
                region,
                regionType,
                sort,
                view: "all",
              } satisfies VideosSearch
            }
          >
            View All
          </Link>
        </Button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {videos.map((video) => (
          <div className="min-w-[320px] max-w-[420px]" key={video.id}>
            <ExploreVideoCard video={video} />
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
      {children}
    </div>
  );
}
