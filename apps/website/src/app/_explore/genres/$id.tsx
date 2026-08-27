import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { BattleCard } from "@/components/explore/battle-card";
import { BattleFilters } from "@/components/explore/battle-filters";
import { SectionHeader } from "@/components/explore/section-header";
import { TrackCard } from "@/components/explore/track-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { musicGenres } from "@/lib/music-genres";
import {
  useArtistsQuery,
  useBattlesQuery,
  useMeEntitlementsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import type { BattleSummary } from "@/lib/soundkit-api-hooks";

const sortOptions = [
    { label: "Most Played", value: "plays-desc" },
    { label: "Least Played", value: "plays-asc" },
    { label: "Newest", value: "date-desc" },
    { label: "Oldest", value: "date-asc" },
    { label: "Title (A-Z)", value: "title-asc" },
    { label: "Title (Z-A)", value: "title-desc" },
  ],
  genreData: Record<
    string,
    { name: string; emoji: string; description: string; queryGenre: string }
  > = {
    afrobeats: {
      description: "African rhythms and melodies",
      emoji: "🥁",
      name: "Afrobeats",
      queryGenre: "afrobeats",
    },
    electronic: {
      description: "Digital sounds and beats",
      emoji: "🎹",
      name: "Electronic",
      queryGenre: "electronic",
    },
    "hip-hop": {
      description: "Beats, rhymes, and culture",
      emoji: "🎤",
      name: "Hip-Hop",
      queryGenre: "hip-hop-rap",
    },
    jazz: {
      description: "Improvisation and swing",
      emoji: "🎺",
      name: "Jazz",
      queryGenre: "jazz",
    },
    latin: {
      description: "Latin rhythms and passion",
      emoji: "💃",
      name: "Latin",
      queryGenre: "latin",
    },
    pop: {
      description: "Chart-topping hits",
      emoji: "⭐",
      name: "Pop",
      queryGenre: "pop",
    },
    "rb-soul": {
      description: "Smooth vibes and soulful vocals",
      emoji: "🎵",
      name: "R&B/Soul",
      queryGenre: "rb-soul",
    },
    rock: {
      description: "Guitar-driven anthems",
      emoji: "🎸",
      name: "Rock",
      queryGenre: "rock",
    },
  };

export const Route = createFileRoute("/_explore/genres/$id")({
  component: GenreDetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    region: typeof search.region === "string" ? search.region : undefined,
    regionType:
      search.regionType === "global"
        ? ("global" as const)
        : ("north-america" as const),
    sort: typeof search.sort === "string" ? search.sort : undefined,
  }),
});

const genreRouteIdFromValue = (value: string) =>
    value === "hip-hop-rap" ? "hip-hop" : value,
  formatFollowers = (followers: number) => {
    if (followers >= 1000) {
      return `${Math.round(followers / 1000)}K`;
    }

    return followers.toLocaleString();
  },
  matchesGenre = (battle: BattleSummary, genreValue: string) => {
    const normalized = battle.genre
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, "");

    return normalized === genreValue;
  };

function GenreBattleCard({
  battle,
  isPremiumUser,
}: {
  battle: BattleSummary;
  isPremiumUser: boolean;
}) {
  const tracks = battle.tracks ?? [];

  return (
    <div className="w-[280px] shrink-0 md:w-[300px]">
      <BattleCard
        currentRound={battle.round?.current ?? 1}
        format={battle.format}
        genre={battle.genre}
        id={battle.id}
        isLive={battle.status === "live"}
        isPremiumUser={isPremiumUser}
        isVoting={battle.round?.isVoting ?? false}
        joinMode={battle.joinMode}
        participants={battle.participants}
        phaseEndsAt={battle.phaseEndsAt}
        queueSize={battle.queueSize}
        startsAt={battle.startsAt}
        status={battle.status}
        title={battle.title}
        totalRounds={battle.round?.total}
        track1={
          tracks[0]
            ? {
                artist: tracks[0].artist,
                cover: tracks[0].cover ?? "",
                title: tracks[0].title,
                votes: tracks[0].votes,
              }
            : undefined
        }
        track2={
          tracks[1]
            ? {
                artist: tracks[1].artist,
                cover: tracks[1].cover ?? "",
                title: tracks[1].title,
                votes: tracks[1].votes,
              }
            : undefined
        }
      />
    </div>
  );
}

function GenreBattleRail({
  battles,
  isPremiumUser,
}: {
  battles: BattleSummary[];
  isPremiumUser: boolean;
}) {
  if (battles.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
      <div className="flex gap-3 md:gap-4 min-w-max">
        {battles.map((battle) => (
          <GenreBattleCard
            battle={battle}
            isPremiumUser={isPremiumUser}
            key={battle.id}
          />
        ))}
      </div>
    </div>
  );
}

function useGenreBattles(genreValue: string) {
  const { data: battles = [] } = useBattlesQuery(),
    entitlementsQuery = useMeEntitlementsQuery(),
    isPremiumUser = Boolean(
      entitlementsQuery.data?.isPremium ||
      entitlementsQuery.data?.canViewLiveBattles ||
      entitlementsQuery.data?.canVoteLiveBattles
    ),
    genreBattles = battles.filter((battle) => matchesGenre(battle, genreValue)),
    sections = {
      live: genreBattles.filter((battle) => battle.status === "live"),
      mustSee: genreBattles.filter((battle) => battle.status === "completed"),
      upcoming: genreBattles.filter((battle) => battle.status === "scheduled"),
    };

  return { isPremiumUser, sections };
}

function GenreDetailPage() {
  const { id } = Route.useParams(),
    search = Route.useSearch(),
    navigate = Route.useNavigate(),
    router = useRouter(),
    genreOption = musicGenres.find(
      (option) => genreRouteIdFromValue(option.value) === id
    ),
    genre = genreData[id] || {
      description: "",
      emoji: "🎵",
      name: genreOption?.label ?? "Genre",
      queryGenre: genreOption?.value ?? id,
    },
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
    regionType: "north-america" | "global" =
      search.regionType ?? savedRegionType ?? "north-america",
    region = search.region ?? savedRegion ?? "us-arkansas",
    sort = search.sort ?? "plays-desc",
    updateFilters = (next: {
      region?: string;
      regionType?: "north-america" | "global";
      sort?: string;
    }) => {
      const nextRegionType = next.regionType ?? regionType,
        nextRegion = next.region ?? region;

      if (typeof window !== "undefined") {
        localStorage.setItem("exploreRegionType", nextRegionType);
        localStorage.setItem("exploreRegion", nextRegion);
      }

      navigate({
        replace: true,
        search: {
          region: nextRegion,
          regionType: nextRegionType,
          sort: next.sort ?? sort,
        },
      });
    },
    { data: topTracks = [] } = useTracksQuery(undefined, {
      genre: genre.queryGenre,
      limit: 12,
      region,
      regionType,
      scope: "public",
      sort,
    }),
    { data: newTracks = [] } = useTracksQuery(undefined, {
      genre: genre.queryGenre,
      limit: 12,
      region,
      regionType,
      scope: "public",
      sort: "date-desc",
    }),
    { data: topArtists = [] } = useArtistsQuery({
      category: "top",
      genre: genre.queryGenre,
      limit: 12,
      region,
      regionType,
      sort: "rank-asc",
    }),
    { isPremiumUser, sections } = useGenreBattles(genre.queryGenre);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-8 md:space-y-10">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      {/* Genre Header */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <div className="text-5xl md:text-6xl">{genre.emoji}</div>
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
              {genre.name}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {genre.description}
            </p>
          </div>
        </div>
      </div>

      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre.queryGenre}
        sort={sort}
        onRegionTypeChange={(nextRegionType) =>
          updateFilters({ regionType: nextRegionType })
        }
        onRegionChange={(nextRegion) => updateFilters({ region: nextRegion })}
        onGenreChange={(nextGenre) => {
          if (nextGenre === "all") {
            router.navigate({ to: "/genres" });
            return;
          }

          router.navigate({
            params: { id: genreRouteIdFromValue(nextGenre) },
            search: {
              region,
              regionType,
              sort,
            },
            to: "/genres/$id",
          });
        }}
        onSortChange={(nextSort) => updateFilters({ sort: nextSort })}
        sortOptions={sortOptions}
      />

      {/* Top Tracks */}
      <section>
        <SectionHeader
          title={`Top ${genre.name} Tracks`}
          description="Most popular this week"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            {topTracks.length > 0 ? (
              topTracks.map((track) => (
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
              ))
            ) : (
              <GenreTrackEmptyState genreName={genre.name} />
            )}
          </div>
        </div>
      </section>

      {/* New Tracks */}
      <section>
        <SectionHeader
          title={`New ${genre.name} Tracks`}
          description="Fresh releases this week"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            {newTracks.length > 0 ? (
              newTracks.map((track) => (
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
              ))
            ) : (
              <GenreTrackEmptyState genreName={genre.name} />
            )}
          </div>
        </div>
      </section>

      {/* Top Artists */}
      <section>
        <SectionHeader
          title={`Top ${genre.name} Artists`}
          description="Leading artists in this genre"
        />
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          <div className="flex gap-3 md:gap-4 min-w-max">
            {topArtists.length > 0 ? (
              topArtists.map((artist) => (
                <ArtistCard
                  key={artist.username}
                  slug={artist.username}
                  name={artist.name}
                  avatar={artist.avatarUrl ?? "/soundkit-default-avatar.svg"}
                  genre={artist.genre}
                  followers={formatFollowers(artist.followers)}
                  verified={artist.verified}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
                No {genre.name} artists found yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Live Battles */}
      <section>
        <SectionHeader title="Live Battles" description="Watch and vote now" />
        <GenreBattleRail
          battles={sections.live}
          isPremiumUser={isPremiumUser}
        />
      </section>

      {/* Upcoming Battles */}
      <section>
        <SectionHeader
          title="Upcoming Battles"
          description="Get ready to vote"
        />
        <GenreBattleRail
          battles={sections.upcoming}
          isPremiumUser={isPremiumUser}
        />
      </section>

      {/* Must See Battles */}
      <section>
        <SectionHeader
          title="Must See Battles"
          description="Most watched battles"
        />
        <GenreBattleRail
          battles={sections.mustSee}
          isPremiumUser={isPremiumUser}
        />
      </section>
    </div>
  );
}

function GenreTrackEmptyState({ genreName }: { genreName: string }) {
  return (
    <div className="w-80 rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
      No {genreName} tracks are live yet.
    </div>
  );
}
