/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, react/memo-dependencies, react/preserve-manual-memoization, react/set-state-in-effect, react-hooks/exhaustive-deps, unicorn/consistent-function-scoping, react/no-array-index-key */
import { Link, useSearch } from "@tanstack/react-router";
import { Swords, TrendingUp, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeGenreValue } from "@/lib/live-collection";
import {
  useBattlesQuery,
  useGenresQuery,
  useMeEntitlementsQuery,
} from "@/lib/soundkit-api-hooks";
import type { BattleSummary, GenreSummary } from "@/lib/soundkit-api-hooks";

import { BattleCard } from "./battle-card";
import { BattleFilters } from "./battle-filters";

type BattleType = "live" | "leaderboard" | "must-see" | "upcoming";

interface BattleViewAllProps {
  type: BattleType;
  title: string;
  description: string;
}

interface BattleFiltersState {
  genre: string;
  region: string;
  regionType: "north-america" | "global";
  sort: string;
}

const sortOptionsMap = {
    leaderboard: [
      { label: "Rank: 1 to 100", value: "rank-asc" },
      { label: "Rank: 100 to 1", value: "rank-desc" },
      { label: "Most Wins", value: "wins-desc" },
      { label: "Highest Win Rate", value: "win-rate-desc" },
    ],
    live: [
      { label: "Most Viewers", value: "viewers-desc" },
      { label: "Least Viewers", value: "viewers-asc" },
      { label: "Started First", value: "time-asc" },
      { label: "Started Last", value: "time-desc" },
    ],
    "must-see": [
      { label: "Most Viewed", value: "views-desc" },
      { label: "Least Viewed", value: "views-asc" },
      { label: "Most Recent", value: "date-desc" },
      { label: "Oldest", value: "date-asc" },
    ],
    upcoming: [
      { label: "Soonest First", value: "time-asc" },
      { label: "Latest First", value: "time-desc" },
      { label: "Most Anticipated", value: "hype-desc" },
    ],
  },
  battleGenres = ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"] as const,
  DEFAULT_REGION = "all",
  DEFAULT_REGION_TYPE = "north-america" as const,
  DEFAULT_GENRE = "all",
  readSavedBattleFilters = (): Partial<BattleFiltersState> | null => {
    if (typeof window === "undefined") {
      return null;
    }

    const savedFilters = window.localStorage.getItem("battleFilters");

    if (!savedFilters) {
      return null;
    }

    try {
      return JSON.parse(savedFilters) as Partial<BattleFiltersState>;
    } catch {
      return null;
    }
  },
  generateLeaderboardArtists = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      artist: `Artist ${i + 1}`,
      avatar: `/placeholder.svg?height=80&width=80&query=artist${i + 1}`,
      genre: battleGenres[Math.floor(Math.random() * battleGenres.length)],
      location: "California, US",
      losses: Math.floor(Math.random() * 20),
      rank: i + 1,
      winRate: Math.floor(Math.random() * 40) + 60,
      wins: Math.floor(Math.random() * 50) + 10,
    })),
  generateMustSeeBattles = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      artist1: `Artist ${i * 2 + 1}`,
      artist1Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 1}`,
      artist2: `Artist ${i * 2 + 2}`,
      artist2Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 2}`,
      date: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      genre: battleGenres[Math.floor(Math.random() * battleGenres.length)],
      id: `past-${i}`,
      location: "Texas, US",
      views: Math.floor(Math.random() * 100_000) + 1000,
      winner: Math.random() > 0.5 ? "artist1" : "artist2",
    })),
  matchesSelectedGenre = (battle: BattleSummary, selectedGenre: string) =>
    selectedGenre === DEFAULT_GENRE ||
    normalizeGenreValue(battle.genre) === normalizeGenreValue(selectedGenre),
  sortedLiveBattles = (battles: BattleSummary[], sort: string) => {
    const ordered = [...battles];

    if (sort === "viewers-asc") {
      return ordered.toSorted(
        (first, second) => first.viewerCount - second.viewerCount
      );
    }

    return ordered.toSorted(
      (first, second) => second.viewerCount - first.viewerCount
    );
  },
  groupBattlesByGenre = (battles: BattleSummary[], genres: GenreSummary[]) => {
    const grouped = new Map<string, BattleSummary[]>();

    for (const battle of battles) {
      const groupKey = normalizeGenreValue(battle.genre),
        group = grouped.get(groupKey) ?? [];
      group.push(battle);
      grouped.set(groupKey, group);
    }

    const knownGenreValues = new Set(
        genres.map((genre) => normalizeGenreValue(genre.slug))
      ),
      orderedGenres = genres.map((genre) => ({
        battles: grouped.get(normalizeGenreValue(genre.slug)) ?? [],
        genre: genre.name,
        value: genre.slug,
      })),
      customGenres = [...grouped.keys()]
        .filter((genreValue) => !knownGenreValues.has(genreValue))
        .toSorted((first, second) => first.localeCompare(second))
        .map((genreValue) => ({
          battles: grouped.get(genreValue) ?? [],
          genre: genreValue.replaceAll("-", " "),
          value: genreValue,
        }));

    return [...orderedGenres, ...customGenres];
  };

function BattleMatchupHero({
  artist1,
  artist1Image,
  artist2,
  artist2Image,
  label,
}: {
  artist1: string;
  artist1Image: string;
  artist2: string;
  artist2Image: string;
  label: string;
}) {
  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      <div className="grid size-full grid-cols-2">
        <AppImage
          alt={`${artist1} artwork`}
          className="size-full object-cover"
          height={720}
          layout="constrained"
          loading="lazy"
          src={artist1Image || "/placeholder.svg"}
          width={640}
        />
        <AppImage
          alt={`${artist2} artwork`}
          className="size-full object-cover"
          height={720}
          layout="constrained"
          loading="lazy"
          src={artist2Image || "/placeholder.svg"}
          width={640}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35" />
      <Badge className="absolute top-2 left-2" variant="secondary">
        {label}
      </Badge>
      <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/70 font-black text-sm text-white">
        VS
      </span>
      <p className="absolute right-3 bottom-3 left-3 line-clamp-1 font-semibold text-sm text-white">
        {artist1} vs {artist2}
      </p>
    </div>
  );
}

function LiveBattleSummaryCard({
  battle,
  isPremiumUser,
}: {
  battle: BattleSummary;
  isPremiumUser: boolean;
}) {
  const tracks = battle.tracks ?? [];

  return (
    <div className="w-full min-w-0">
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

function BattleRail({
  battles,
  emptyMessage,
  hideWhenEmpty = false,
  isPremiumUser,
  showViewAll = true,
  title,
  viewAllGenre,
}: {
  battles: BattleSummary[];
  emptyMessage?: string;
  hideWhenEmpty?: boolean;
  isPremiumUser: boolean;
  showViewAll?: boolean;
  title: string;
  viewAllGenre?: string;
}) {
  if (hideWhenEmpty && battles.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {battles.length} {battles.length === 1 ? "battle" : "battles"}
          </span>
          {showViewAll ? (
            <Button asChild size="sm" variant="ghost">
              <Link
                to="/live/battles"
                search={{
                  genre: viewAllGenre ?? DEFAULT_GENRE,
                  region: DEFAULT_REGION,
                  regionType: DEFAULT_REGION_TYPE,
                  sort: sortOptionsMap.live[0].value,
                }}
              >
                View All
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {battles.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {battles.slice(0, 6).map((battle) => (
            <LiveBattleSummaryCard
              battle={battle}
              isPremiumUser={isPremiumUser}
              key={battle.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          {emptyMessage ?? `No live battles in ${title} right now.`}
        </div>
      )}
    </section>
  );
}

export function BattleViewAll({
  type,
  title,
  description,
}: BattleViewAllProps) {
  const routeSearch = useSearch({ strict: false }),
    isInitialMount = useRef(true),
    defaultSort = sortOptionsMap[type][0].value,
    regionTypeFromSearch =
      routeSearch.regionType === "global" ? "global" : null,
    regionFromSearch =
      typeof routeSearch.region === "string" ? routeSearch.region : null,
    genreFromSearch =
      typeof routeSearch.genre === "string" ? routeSearch.genre : null,
    sortFromSearch =
      typeof routeSearch.sort === "string" ? routeSearch.sort : null,
    hasSearchFilters =
      regionTypeFromSearch !== null ||
      regionFromSearch !== null ||
      genreFromSearch !== null ||
      sortFromSearch !== null,
    [regionType, setRegionType] = useState<"north-america" | "global">(() =>
      regionTypeFromSearch === "global" ? "global" : DEFAULT_REGION_TYPE
    ),
    [region, setRegion] = useState(() => regionFromSearch ?? DEFAULT_REGION),
    [genre, setGenre] = useState(() => genreFromSearch ?? DEFAULT_GENRE),
    [sort, setSort] = useState(() => sortFromSearch ?? defaultSort),
    { data: battleSummaries = [], isLoading: isLoadingBattles } =
      useBattlesQuery({ region, regionType }),
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    entitlementsQuery = useMeEntitlementsQuery(),
    isPremiumUser = Boolean(
      entitlementsQuery.data?.isPremium ||
      entitlementsQuery.data?.canViewLiveBattles ||
      entitlementsQuery.data?.canVoteLiveBattles
    );

  useEffect(() => {
    if (hasSearchFilters) {
      return;
    }

    const savedFilters = readSavedBattleFilters();

    if (!savedFilters) {
      return;
    }

    setRegionType(savedFilters.regionType ?? DEFAULT_REGION_TYPE);
    setRegion(savedFilters.region ?? DEFAULT_REGION);
    setGenre(savedFilters.genre ?? DEFAULT_GENRE);
    setSort(savedFilters.sort ?? defaultSort);
  }, [defaultSort, hasSearchFilters]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    window.localStorage.setItem(
      "battleFilters",
      JSON.stringify({ genre, region, regionType, sort })
    );

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("genre", genre);
      params.set("region", region);
      params.set("regionType", regionType);
      params.set("sort", sort);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  }, [regionType, region, genre, sort]);

  const liveBattleSections = useMemo(() => {
      const eligible = battleSummaries.filter((battle) =>
          matchesSelectedGenre(battle, genre)
        ),
        active = eligible.filter(
          (battle) => battle.status === "live" || battle.status === "scheduled"
        ),
        live = sortedLiveBattles(
          active.filter((battle) => battle.status === "live"),
          sort
        ),
        upcoming = active
          .filter((battle) => battle.status === "scheduled")
          .toSorted((first, second) => {
            const firstTime = first.startsAt
              ? new Date(first.startsAt).getTime()
              : Number.MAX_SAFE_INTEGER;
            const secondTime = second.startsAt
              ? new Date(second.startsAt).getTime()
              : Number.MAX_SAFE_INTEGER;
            return sort === "time-desc"
              ? secondTime - firstTime
              : firstTime - secondTime;
          }),
        featured = active
          .filter((battle) => battle.isFeatured)
          .toSorted(
            (first, second) =>
              (first.featuredRank ?? Number.MAX_SAFE_INTEGER) -
              (second.featuredRank ?? Number.MAX_SAFE_INTEGER)
          ),
        completed = eligible.filter(
          (battle) =>
            battle.status === "completed" || battle.status === "archived"
        ),
        byGenre = groupBattlesByGenre(active, genres).filter(
          (section) => section.battles.length > 0
        );

      return {
        byGenre,
        completed,
        featured,
        live,
        total: eligible.length,
        upcoming,
      };
    }, [battleSummaries, genre, genres, sort]),
    data = useMemo(() => {
      if (type === "leaderboard") {
        return generateLeaderboardArtists(100);
      }

      if (type === "must-see") {
        return generateMustSeeBattles(50);
      }

      return [];
    }, [type]),
    liveBattleContent = useMemo(() => {
      if (isLoadingBattles) {
        return (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Loading live battles...
          </div>
        );
      }

      return (
        <>
          <BattleRail
            battles={liveBattleSections.featured}
            isPremiumUser={isPremiumUser}
            title="Featured"
          />
          <BattleRail
            battles={liveBattleSections.upcoming}
            emptyMessage="No upcoming battles are scheduled yet."
            isPremiumUser={isPremiumUser}
            showViewAll={false}
            title="Upcoming"
          />
          <BattleRail
            battles={liveBattleSections.live}
            emptyMessage="No battles are live right now."
            isPremiumUser={isPremiumUser}
            showViewAll={false}
            title="Live Now"
          />
          <BattleRail
            battles={liveBattleSections.completed}
            emptyMessage="No completed battle results yet."
            hideWhenEmpty
            isPremiumUser={isPremiumUser}
            showViewAll={false}
            title="Recent Results"
          />
          {liveBattleSections.byGenre.map((section) => (
            <BattleRail
              hideWhenEmpty
              key={section.genre}
              battles={section.battles}
              isPremiumUser={isPremiumUser}
              title={section.genre}
              viewAllGenre={section.value}
            />
          ))}
        </>
      );
    }, [isLoadingBattles, isPremiumUser, liveBattleSections]),
    getBattleTypeIcon = (battleType: BattleType) => {
      switch (battleType) {
        case "leaderboard": {
          return <Trophy className="size-6 text-primary md:size-8" />;
        }
        case "must-see": {
          return <TrendingUp className="size-6 text-primary md:size-8" />;
        }
        default: {
          return <Swords className="size-6 text-primary md:size-8" />;
        }
      }
    };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 font-bold text-2xl md:text-3xl lg:text-4xl">
          {getBattleTypeIcon(type)}
          {title}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          {description}
        </p>
      </div>

      {/* Filters */}
      <BattleFilters
        regionType={regionType}
        region={region}
        genre={genre}
        sort={sort}
        onRegionTypeChange={setRegionType}
        onRegionChange={setRegion}
        onGenreChange={setGenre}
        onSortChange={setSort}
        sortOptions={sortOptionsMap[type]}
      />

      {/* Content based on type */}
      {type === "live" && <div className="space-y-8">{liveBattleContent}</div>}

      {type === "leaderboard" && (
        <div className="space-y-2">
          {(data as ReturnType<typeof generateLeaderboardArtists>).map(
            (artist) => (
              <Card
                key={artist.rank}
                className="hover:bg-accent transition-colors"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="text-2xl font-bold text-muted-foreground w-12 text-center">
                    {artist.rank}
                  </div>
                  <Avatar className="size-12">
                    <AvatarImage
                      src={artist.avatar || "/placeholder.svg"}
                      alt={artist.artist}
                    />
                    <AvatarFallback>{artist.artist[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{artist.artist}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{artist.genre}</span>
                      <span>•</span>
                      <span>{artist.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold">{artist.wins}</div>
                      <div className="text-muted-foreground text-xs">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{artist.losses}</div>
                      <div className="text-muted-foreground text-xs">
                        Losses
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-primary">
                        {artist.winRate}%
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Win Rate
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {type === "must-see" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data as ReturnType<typeof generateMustSeeBattles>).map((battle) => (
            <Link
              key={battle.id}
              to="/live/battles/$id"
              params={{ id: battle.id }}
            >
              <Card className="group h-full cursor-pointer overflow-hidden transition-colors hover:bg-accent">
                <BattleMatchupHero
                  artist1={battle.artist1}
                  artist1Image={battle.artist1Image}
                  artist2={battle.artist2}
                  artist2Image={battle.artist2Image}
                  label={battle.genre}
                />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary">{battle.genre}</Badge>
                    <div className="text-sm text-muted-foreground">
                      {battle.views.toLocaleString()} views
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="size-12">
                      <AvatarImage
                        src={battle.artist1Image || "/placeholder.svg"}
                        alt={battle.artist1}
                      />
                      <AvatarFallback>{battle.artist1[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">
                        {battle.artist1}
                      </h3>
                      {battle.winner === "artist1" && (
                        <Badge variant="default" className="text-xs mt-1">
                          <Trophy className="size-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground my-2">
                    VS
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-12">
                      <AvatarImage
                        src={battle.artist2Image || "/placeholder.svg"}
                        alt={battle.artist2}
                      />
                      <AvatarFallback>{battle.artist2[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">
                        {battle.artist2}
                      </h3>
                      {battle.winner === "artist2" && (
                        <Badge variant="default" className="text-xs mt-1">
                          <Trophy className="size-3 mr-1" />
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    {new Date(battle.date).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {type === "upcoming" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoadingBattles ? (
            <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Loading upcoming battles...
            </div>
          ) : liveBattleSections.upcoming.length === 0 ? (
            <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No upcoming battles are scheduled yet.
            </div>
          ) : (
            liveBattleSections.upcoming.map((battle) => (
              <LiveBattleSummaryCard
                battle={battle}
                isPremiumUser={isPremiumUser}
                key={battle.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
