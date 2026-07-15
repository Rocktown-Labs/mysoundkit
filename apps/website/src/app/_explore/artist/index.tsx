import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";

import { ArtistCard } from "@/components/explore/artist-card";
import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import type { LeaderboardArtist } from "@/components/explore/artist-leaderboard-card";
import { BattleFilters } from "@/components/explore/battle-filters";
import { Button } from "@/components/ui/button";
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

const featuredGenres = ["Hip-Hop", "R&B/Soul", "Pop", "Electronic"] as const;

export const Route = createFileRoute("/_explore/artist/")({
  component: ArtistPage,
});

const formatFollowers = (followers: number) => {
  if (followers >= 1000) {
    return `${Math.round(followers / 1000)}K`;
  }

  return followers.toLocaleString();
};

const toLeaderboardArtist = (artist: ArtistSummary): LeaderboardArtist => ({
  avatar: artist.avatarUrl ?? "/diverse-user-avatars.png",
  genre: artist.genre,
  location: artist.location || "Arkansas, US",
  name: artist.name,
  rank: artist.rank ?? 1,
  slug: artist.username,
  stats: {
    battleWins: 0,
    followers: formatFollowers(artist.followers),
    plays: (artist.weeklyPlays ?? 0).toLocaleString(),
  },
  verified: artist.verified,
});

const compactTopTen = (artists: ArtistSummary[]) => {
  const ranked = artists.slice(0, 10);
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
          {columns.map((column, index) => (
            <ArtistLeaderboardCard
              key={`${title}-${index}`}
              artists={column.map(toLeaderboardArtist)}
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

function ArtistPage() {
  const [regionType, setRegionType] = useState<"north-america" | "global">(
    "north-america"
  );
  const [region, setRegion] = useState("us-arkansas");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("rank-asc");
  const commonQuery = {
    genre,
    limit: "10",
    region,
    regionType,
    sort,
  };
  const rising = useArtistsQuery({ ...commonQuery, category: "rising" });
  const newest = useArtistsQuery({ ...commonQuery, category: "new" });
  const top = useArtistsQuery({ ...commonQuery, category: "top" });
  const hipHopArtists = useArtistsQuery({
    category: "top",
    genre: "Hip-Hop",
    limit: "6",
    region,
    regionType,
    sort: "rank-asc",
  });
  const rbArtists = useArtistsQuery({
    category: "top",
    genre: "R&B/Soul",
    limit: "6",
    region,
    regionType,
    sort: "rank-asc",
  });
  const popArtists = useArtistsQuery({
    category: "top",
    genre: "Pop",
    limit: "6",
    region,
    regionType,
    sort: "rank-asc",
  });
  const electronicArtists = useArtistsQuery({
    category: "top",
    genre: "Electronic",
    limit: "6",
    region,
    regionType,
    sort: "rank-asc",
  });
  const topByGenre = [
    { genre: featuredGenres[0], query: hipHopArtists },
    { genre: featuredGenres[1], query: rbArtists },
    { genre: featuredGenres[2], query: popArtists },
    { genre: featuredGenres[3], query: electronicArtists },
  ];

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
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
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
          {topByGenre.map(({ genre: genreName, query }) => (
            <div key={genreName} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{genreName}</h3>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/artist/top"
                    search={{
                      genre: genreName,
                      region,
                      regionType,
                      sort: "rank-asc",
                    }}
                  >
                    View All
                  </Link>
                </Button>
              </div>
              {(query.data ?? []).length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {(query.data ?? []).map((artist) => (
                    <ArtistCard
                      key={artist.username}
                      slug={artist.username}
                      name={artist.name}
                      avatar={artist.avatarUrl ?? "/diverse-user-avatars.png"}
                      genre={artist.genre}
                      followers={formatFollowers(artist.followers)}
                      verified={artist.verified}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
                  No {genreName} artists found yet.
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
