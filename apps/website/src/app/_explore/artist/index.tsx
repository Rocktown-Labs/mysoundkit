import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import type { LeaderboardArtist } from "@/components/explore/artist-leaderboard-card";
import { BattleFilters } from "@/components/explore/battle-filters";
import { Button } from "@/components/ui/button";
import { musicGenres } from "@/lib/music-genres";
import { useArtistsQuery } from "@/lib/soundkit-api-hooks";
import type { ArtistSummary } from "@/lib/soundkit-api-hooks";

const sortOptions = [
  { label: "Rank (High to Low)", value: "rank-asc" },
  { label: "Rank (Low to High)", value: "rank-desc" },
  { label: "Name (A-Z)", value: "name-asc" },
  { label: "Name (Z-A)", value: "name-desc" },
];

const leaderboardSections = [
  {
    category: "rising",
    description: "Artists on the rise with growing momentum",
    href: "/artist/rising-stars",
    icon: TrendingUp,
    title: "Rising Stars",
  },
  {
    category: "new",
    description: "Fresh talent joining the scene",
    href: "/artist/new",
    icon: Sparkles,
    title: "New Artists",
  },
  {
    category: "top",
    description: "The most popular artists right now",
    href: "/artist/top",
    icon: Trophy,
    title: "Top Artists This Month",
  },
] as const;

interface ArtistSearch {
  genre?: string;
  q?: string;
  region?: string;
  regionType?: "north-america" | "global";
  sort?: string;
}

export const Route = createFileRoute("/_explore/artist/")({
  component: ArtistPage,
  validateSearch: (search: Record<string, unknown>): ArtistSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    regionType: search.regionType === "global" ? "global" : "north-america",
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
});

const formatFollowers = (followers: number) => {
  if (followers >= 1000) {
    return `${Math.round(followers / 1000)}K`;
  }

  return followers.toLocaleString();
};

const toLeaderboardArtist = (
  artist: ArtistSummary,
  displayRank: number
): LeaderboardArtist => ({
  avatar: artist.avatarUrl ?? "/diverse-user-avatars.png",
  genre: artist.genre,
  location: artist.location || "Arkansas, US",
  name: artist.name,
  rank: displayRank,
  slug: artist.username,
  stats: {
    battleWins: 0,
    followers: formatFollowers(artist.followers),
    plays: (artist.weeklyPlays ?? 0).toLocaleString(),
  },
  verified: artist.verified,
});

const compactTopTen = (artists: ArtistSummary[]) => {
  const ranked = artists
    .slice(0, 10)
    .map((artist, index) => toLeaderboardArtist(artist, index + 1));
  return [ranked.slice(0, 5), ranked.slice(5, 10)];
};

function LeaderboardSection({
  artists,
  description,
  href,
  icon: Icon,
  title,
  type,
}: {
  artists: ArtistSummary[];
  description: string;
  href: "/artist/new" | "/artist/rising-stars" | "/artist/top";
  icon: typeof TrendingUp;
  title: string;
  type: "new" | "rising" | "top";
}) {
  const columns = compactTopTen(artists);
  const columnKey = (column: LeaderboardArtist[]) =>
    `${title}-${column[0]?.slug ?? "empty"}-${column.at(-1)?.slug ?? "empty"}`;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-xl md:text-2xl">
            <Icon className="size-6 text-primary" />
            {title}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        </div>
        <Button asChild variant="ghost">
          <Link to={href}>View All</Link>
        </Button>
      </div>
      {artists.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-2">
          {columns.map((column) => (
            <ArtistLeaderboardCard
              key={columnKey(column)}
              artists={column}
              type={type}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          No artists found yet. Arkansas is selected by default while local
          communities fill in.
        </div>
      )}
    </section>
  );
}

function ArtistGenreRail({
  genre,
  region,
  regionType,
}: {
  genre: (typeof musicGenres)[number];
  region: string;
  regionType: "north-america" | "global";
}) {
  const query = useArtistsQuery({
    category: "top",
    genre: genre.value,
    limit: 6,
    region,
    regionType,
    sort: "rank-asc",
  });
  const artists = query.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{genre.label}</h3>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/artist/top"
            search={{
              genre: genre.value,
              region,
              regionType,
              sort: "rank-asc",
            }}
          >
            View All
          </Link>
        </Button>
      </div>
      {artists.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.username}
              avatar={artist.avatarUrl ?? "/diverse-user-avatars.png"}
              followers={formatFollowers(artist.followers)}
              genre={artist.genre}
              name={artist.name}
              slug={artist.username}
              verified={artist.verified}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          No {genre.label} artists found yet.
        </div>
      )}
    </div>
  );
}

function ArtistPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const savedRegionType =
    typeof window === "undefined"
      ? null
      : (localStorage.getItem("exploreRegionType") as
          | "north-america"
          | "global"
          | null);
  const savedRegion =
    typeof window === "undefined"
      ? null
      : localStorage.getItem("exploreRegion");

  const regionType = search.regionType ?? savedRegionType ?? "north-america";
  const region = search.region ?? savedRegion ?? "us-arkansas";
  const genre = search.genre ?? "all";
  const q = search.q ?? "";
  const sort = search.sort ?? "rank-asc";

  const updateFilters = (next: Partial<ArtistSearch>) => {
    const nextRegionType = next.regionType ?? regionType;
    const nextRegion = next.region ?? region;
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
      }),
    });
  };
  const commonQuery = {
    genre,
    limit: 10,
    q: q || undefined,
    region,
    regionType,
    sort,
  };
  const rising = useArtistsQuery({ ...commonQuery, category: "rising" });
  const newest = useArtistsQuery({ ...commonQuery, category: "new" });
  const top = useArtistsQuery({ ...commonQuery, category: "top" });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <section className="mb-8">
        <h1 className="mb-4 text-balance font-bold text-3xl md:text-4xl lg:text-5xl">
          Discover Artists
        </h1>
        <p className="max-w-3xl text-base text-muted-foreground text-pretty md:text-lg">
          Find new talent and established stars by region, genre, and momentum.
        </p>
      </section>

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

      <div className="space-y-12">
        <LeaderboardSection
          artists={rising.data ?? []}
          description={leaderboardSections[0].description}
          href={leaderboardSections[0].href}
          icon={leaderboardSections[0].icon}
          title={leaderboardSections[0].title}
          type="rising"
        />
        <LeaderboardSection
          artists={newest.data ?? []}
          description={leaderboardSections[1].description}
          href={leaderboardSections[1].href}
          icon={leaderboardSections[1].icon}
          title={leaderboardSections[1].title}
          type="new"
        />
        <LeaderboardSection
          artists={top.data ?? []}
          description={leaderboardSections[2].description}
          href={leaderboardSections[2].href}
          icon={leaderboardSections[2].icon}
          title={leaderboardSections[2].title}
          type="top"
        />

        <section className="space-y-6">
          <div>
            <h2 className="font-bold text-xl md:text-2xl">
              Top Artists By Genre
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Compact genre lists with profile cards.
            </p>
          </div>
          {musicGenres.map((genreOption) => (
            <ArtistGenreRail
              genre={genreOption}
              key={genreOption.value}
              region={region}
              regionType={regionType}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
