import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { ArtistCard } from "@/components/explore/artist-card";
import { BattleFilters } from "@/components/explore/battle-filters";
import { InfiniteScrollSentinel } from "@/components/ui/infinite-scroll-sentinel";
import { useArtistsInfiniteQuery } from "@/lib/soundkit-api-hooks";

const sortOptions = [
    { label: "Rank (High to Low)", value: "rank-asc" },
    { label: "Rank (Low to High)", value: "rank-desc" },
    { label: "Name (A-Z)", value: "name-asc" },
    { label: "Name (Z-A)", value: "name-desc" },
  ],
  pageSize = 24,
  formatFollowers = (followers: number) => {
    if (followers >= 1000) {
      return `${Math.round(followers / 1000)}K`;
    }

    return followers.toLocaleString();
  };

export function ArtistListPage({
  category,
  description,
  icon: Icon,
  title,
}: {
  category: "new" | "rising" | "top";
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  const [regionType, setRegionType] = useState<"north-america" | "global">(
      "north-america"
    ),
    [region, setRegion] = useState("us-arkansas"),
    [genre, setGenre] = useState("all"),
    [sort, setSort] = useState("rank-asc"),
    { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
      useArtistsInfiniteQuery({
        category,
        genre,
        limit: pageSize,
        region,
        regionType,
        sort,
      }),
    artists = data?.pages.flat() ?? [];

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 font-bold text-2xl md:text-3xl lg:text-4xl">
          <Icon className="size-6 text-primary md:size-8" />
          {title}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          {description}
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

      {isLoading || artists.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {artists.map((artist) => (
              <ArtistCard
                key={artist.username}
                slug={artist.username}
                name={artist.name}
                avatar={artist.avatarUrl ?? "/placeholder-user.jpg"}
                genre={artist.genre}
                followers={formatFollowers(artist.followers)}
                verified={artist.verified}
              />
            ))}
          </div>
          <InfiniteScrollSentinel
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No artists found for this filter yet. Arkansas is selected by default
          while regional data fills in.
        </div>
      )}
    </div>
  );
}
