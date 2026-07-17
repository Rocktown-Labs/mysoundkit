import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Video } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { BattleFilters } from "@/components/explore/battle-filters";
import { VideoCard } from "@/components/explore/video-card";
import { Button } from "@/components/ui/button";
import { useVideosQuery } from "@/lib/soundkit-api-hooks";
import type { VideoSummary } from "@/lib/soundkit-api-hooks";

const sortOptions = [
  { label: "Most Viewed", value: "views-desc" },
  { label: "Newest", value: "date-desc" },
  { label: "Title (A-Z)", value: "title-asc" },
];

const discoveryGenres = [
  { label: "Hip-Hop", value: "hip-hop" },
  { label: "R&B/Soul", value: "rb-soul" },
  { label: "Pop", value: "pop" },
  { label: "Electronic", value: "electronic" },
  { label: "Spoken Word", value: "spoken-word" },
] as const;

interface VideosSearch {
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

export const Route = createFileRoute("/_explore/videos/")({
  component: VideosPage,
  validateSearch: (search: Record<string, unknown>): VideosSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
});

function VideosPage() {
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
  const [sort, setSort] = useState("views-desc");

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
      return;
    }

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
  }, [searchQuery]);

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

  const { data: videos = [], isLoading } = useVideosQuery({
    genre,
    limit: "48",
    region,
    regionType,
    scope: "public",
    sort,
  });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>

      <div className="mb-8 space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl lg:text-4xl">
          <Video className="size-6 text-primary md:size-8" />
          Videos
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
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptions}
      />

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
                { genre, region, regionType, sort } satisfies VideosSearch
              }
            >
              View All
            </Link>
          </Button>
        </div>
        {isLoading || videos.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {videos.slice(0, 12).map((video) => (
              <div className="min-w-[320px] max-w-[420px]" key={video.id}>
                <ExploreVideoCard video={video} />
              </div>
            ))}
          </div>
        ) : (
          <VideoEmptyState>
            No videos found for this filter yet. Arkansas is selected by default
            until this region has more uploads.
          </VideoEmptyState>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {discoveryGenres.map((sectionGenre) => (
          <VideoGenreRail
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

function ExploreVideoCard({ video }: { video: VideoSummary }) {
  return (
    <VideoCard
      video={{
        creator: {
          name: video.creatorName ?? "SoundKit Artist",
          slug: video.creatorUsername ?? "artist",
        },
        duration: video.duration ?? "0:00",
        id: video.id,
        playbackPolicy: video.playbackPolicy,
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
  genre: (typeof discoveryGenres)[number];
  region: string;
  regionType: "north-america" | "global";
  sort: string;
}) {
  const { data: videos = [], isLoading } = useVideosQuery({
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
            Videos from this genre.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/videos"
            search={
              {
                genre: genre.value,
                region,
                regionType,
                sort,
              } satisfies VideosSearch
            }
          >
            View All
          </Link>
        </Button>
      </div>
      {isLoading || videos.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {videos.map((video) => (
            <div className="min-w-[320px] max-w-[420px]" key={video.id}>
              <ExploreVideoCard video={video} />
            </div>
          ))}
        </div>
      ) : (
        <VideoEmptyState>No {genre.label} videos are live yet.</VideoEmptyState>
      )}
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
