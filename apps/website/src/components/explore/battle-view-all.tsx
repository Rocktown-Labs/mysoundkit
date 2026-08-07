import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Trophy, TrendingUp, Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { musicGenres } from "@/lib/music-genres";
import { useBattlesQuery } from "@/lib/soundkit-api-hooks";
import type { BattleSummary } from "@/lib/soundkit-api-hooks";

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
};

const battleGenres = ["Hip-Hop", "R&B/Soul", "Electronic", "Pop"] as const;
const DEFAULT_REGION = "all";
const DEFAULT_REGION_TYPE = "north-america" as const;
const DEFAULT_GENRE = "all";
const readSavedBattleFilters = (): Partial<BattleFiltersState> | null => {
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
};

const generateLeaderboardArtists = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    artist: `Artist ${i + 1}`,
    avatar: `/placeholder.svg?height=80&width=80&query=artist${i + 1}`,
    genre: battleGenres[Math.floor(Math.random() * battleGenres.length)],
    location: "California, US",
    losses: Math.floor(Math.random() * 20),
    rank: i + 1,
    winRate: Math.floor(Math.random() * 40) + 60,
    wins: Math.floor(Math.random() * 50) + 10,
  }));

const generateMustSeeBattles = (count: number) =>
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
  }));

const generateUpcomingBattles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    anticipation: Math.floor(Math.random() * 5000) + 100,
    artist1: `Artist ${i * 2 + 1}`,
    artist1Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 1}`,
    artist1Stats: {
      losses: Math.floor(Math.random() * 15),
      topSongs: ["Track A", "Track B", "Track C"],
      winRate: Math.floor(Math.random() * 40) + 50,
      wins: Math.floor(Math.random() * 30) + 5,
    },
    artist2: `Artist ${i * 2 + 2}`,
    artist2Image: `/placeholder.svg?height=100&width=100&query=artist${i * 2 + 2}`,
    artist2Stats: {
      losses: Math.floor(Math.random() * 15),
      topSongs: ["Track X", "Track Y", "Track Z"],
      winRate: Math.floor(Math.random() * 40) + 50,
      wins: Math.floor(Math.random() * 30) + 5,
    },
    genre: battleGenres[Math.floor(Math.random() * battleGenres.length)],
    id: `upcoming-${i}`,
    location: "Florida, US",
    scheduledTime: new Date(
      Date.now() + Math.random() * 24 * 60 * 60 * 1000
    ).toISOString(),
  }));

const normalizedGenreValue = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

  return normalized === "r-b-soul" ? "rb-soul" : normalized;
};

const matchesSelectedGenre = (battle: BattleSummary, selectedGenre: string) =>
  selectedGenre === DEFAULT_GENRE ||
  normalizedGenreValue(battle.genre) === selectedGenre;

const sortedLiveBattles = (battles: BattleSummary[], sort: string) => {
  const ordered = [...battles];

  if (sort === "viewers-asc") {
    return ordered.toSorted(
      (first, second) => first.viewerCount - second.viewerCount
    );
  }

  return ordered.toSorted(
    (first, second) => second.viewerCount - first.viewerCount
  );
};

const groupBattlesByGenre = (battles: BattleSummary[]) => {
  const grouped = new Map<string, BattleSummary[]>();

  for (const battle of battles) {
    const groupKey = normalizedGenreValue(battle.genre);
    const group = grouped.get(groupKey) ?? [];
    group.push(battle);
    grouped.set(groupKey, group);
  }

  const knownGenreValues = new Set(musicGenres.map((genre) => genre.value));
  const orderedGenres = musicGenres.map((genre) => ({
    battles: grouped.get(genre.value) ?? [],
    genre: genre.label,
    value: genre.value,
  }));

  const customGenres = [...grouped.keys()]
    .filter((genreValue) => !knownGenreValues.has(genreValue))
    .toSorted((first, second) => first.localeCompare(second))
    .map((genreValue) => ({
      battles: grouped.get(genreValue) ?? [],
      genre: genreValue.replaceAll("-", " "),
      value: genreValue,
    }));

  return [...orderedGenres, ...customGenres];
};

function LiveBattleSummaryCard({ battle }: { battle: BattleSummary }) {
  return (
    <Link
      to="/live/battles/$id"
      params={{ id: battle.id }}
      className="block min-w-[280px] max-w-[320px]"
    >
      <Card className="h-full transition-colors hover:bg-accent">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary">{battle.genre}</Badge>
            <Badge variant={battle.status === "live" ? "default" : "outline"}>
              {battle.status === "live" ? "Live" : battle.status}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-semibold">{battle.title}</h3>
            <p className="mt-1 text-muted-foreground text-sm">
              {battle.format.replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span className="flex items-center gap-1">
              <Eye className="size-4" />
              {battle.viewerCount.toLocaleString()}
            </span>
            {battle.isFeatured && battle.featuredRank ? (
              <span>Featured #{battle.featuredRank}</span>
            ) : (
              <span>
                {battle.visibility === "premium_only" ? "Premium" : "Public"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BattleRail({
  battles,
  title,
  viewAllGenre,
}: {
  battles: BattleSummary[];
  title: string;
  viewAllGenre?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{title}</h2>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">
            {battles.length} {battles.length === 1 ? "battle" : "battles"}
          </span>
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
        </div>
      </div>
      {battles.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {battles.map((battle) => (
            <LiveBattleSummaryCard key={battle.id} battle={battle} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No live battles in {title} right now.
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
  const locationSearch = useRouterState({ select: (s) => s.location.search });
  const searchParams = new URLSearchParams(
    typeof locationSearch === "string" ? locationSearch : ""
  );
  const [selectedMatchup, setSelectedMatchup] = useState<
    ReturnType<typeof generateUpcomingBattles>[number] | null
  >(null);
  const isInitialMount = useRef(true);
  const defaultSort = sortOptionsMap[type][0].value;
  const regionTypeFromSearch = searchParams.get("regionType");
  const regionFromSearch = searchParams.get("region");
  const genreFromSearch = searchParams.get("genre");
  const sortFromSearch = searchParams.get("sort");
  const hasSearchFilters =
    regionTypeFromSearch !== null ||
    regionFromSearch !== null ||
    genreFromSearch !== null ||
    sortFromSearch !== null;

  const [regionType, setRegionType] = useState<"north-america" | "global">(
    () => (regionTypeFromSearch === "global" ? "global" : DEFAULT_REGION_TYPE)
  );

  const [region, setRegion] = useState(
    () => regionFromSearch ?? DEFAULT_REGION
  );

  const [genre, setGenre] = useState(() => genreFromSearch ?? DEFAULT_GENRE);

  const [sort, setSort] = useState(() => sortFromSearch ?? defaultSort);
  const { data: battleSummaries = [], isLoading: isLoadingBattles } =
    useBattlesQuery();

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
    const filtered = sortedLiveBattles(
      battleSummaries.filter(
        (battle) =>
          battle.status === "live" && matchesSelectedGenre(battle, genre)
      ),
      sort
    );
    const featured = filtered
      .filter((battle) => battle.isFeatured)
      .toSorted(
        (first, second) =>
          (first.featuredRank ?? Number.MAX_SAFE_INTEGER) -
          (second.featuredRank ?? Number.MAX_SAFE_INTEGER)
      );
    const byGenre = groupBattlesByGenre(filtered);

    return { byGenre, featured, total: filtered.length };
  }, [battleSummaries, genre, sort]);

  const data = useMemo(() => {
    if (type === "leaderboard") {
      return generateLeaderboardArtists(100);
    }

    if (type === "must-see") {
      return generateMustSeeBattles(50);
    }

    return generateUpcomingBattles(30);
  }, [type]);

  const liveBattleContent = useMemo(() => {
    if (isLoadingBattles) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Loading live battles...
        </div>
      );
    }

    return (
      <>
        <BattleRail battles={liveBattleSections.featured} title="Featured" />
        {liveBattleSections.byGenre.map((section) => (
          <BattleRail
            key={section.genre}
            battles={section.battles}
            title={section.genre}
            viewAllGenre={section.value}
          />
        ))}
      </>
    );
  }, [isLoadingBattles, liveBattleSections]);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to="/live">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base mt-1">
            {description}
          </p>
        </div>
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
              <Card className="group hover:bg-accent transition-colors cursor-pointer h-full">
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data as ReturnType<typeof generateUpcomingBattles>).map(
              (battle) => (
                <Card
                  key={battle.id}
                  className="group hover:bg-accent transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">{battle.genre}</Badge>
                      <div className="text-sm text-muted-foreground">
                        {new Date(battle.scheduledTime).toLocaleString()}
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
                      </div>
                    </div>
                    <div className="text-center text-xs text-muted-foreground my-2">
                      VS
                    </div>
                    <div className="flex items-center gap-3 mb-3">
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
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                      >
                        Join Queue
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedMatchup(battle)}
                      >
                        View Matchup
                      </Button>
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      {battle.anticipation.toLocaleString()} interested
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>

          {/* Head to Head Matchup Dialog */}
          <Dialog
            open={!!selectedMatchup}
            onOpenChange={() => setSelectedMatchup(null)}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Head to Head Matchup</DialogTitle>
                <DialogDescription>
                  Compare artist stats and performance
                </DialogDescription>
              </DialogHeader>
              {selectedMatchup && (
                <div className="space-y-6">
                  {/* Artist Headers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="size-20 mb-2">
                        <AvatarImage
                          src={
                            selectedMatchup.artist1Image || "/placeholder.svg"
                          }
                          alt={selectedMatchup.artist1}
                        />
                        <AvatarFallback>
                          {selectedMatchup.artist1[0]}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-bold text-lg">
                        {selectedMatchup.artist1}
                      </h3>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="size-20 mb-2">
                        <AvatarImage
                          src={
                            selectedMatchup.artist2Image || "/placeholder.svg"
                          }
                          alt={selectedMatchup.artist2}
                        />
                        <AvatarFallback>
                          {selectedMatchup.artist2[0]}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="font-bold text-lg">
                        {selectedMatchup.artist2}
                      </h3>
                    </div>
                  </div>

                  {/* Stats Comparison */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold">
                        {selectedMatchup.artist1Stats.wins}
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        Total Wins
                      </div>
                      <div className="text-left font-semibold">
                        {selectedMatchup.artist2Stats.wins}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold">
                        {selectedMatchup.artist1Stats.losses}
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        Total Losses
                      </div>
                      <div className="text-left font-semibold">
                        {selectedMatchup.artist2Stats.losses}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="text-right font-semibold text-primary">
                        {selectedMatchup.artist1Stats.winRate}%
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        Win Rate
                      </div>
                      <div className="text-left font-semibold text-primary">
                        {selectedMatchup.artist2Stats.winRate}%
                      </div>
                    </div>
                  </div>

                  {/* Top Songs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Music2 className="size-4" />
                        Top Songs
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {selectedMatchup.artist1Stats.topSongs.map(
                          (song: string, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {i + 1}.
                              </span>
                              {song}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Music2 className="size-4" />
                        Top Songs
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {selectedMatchup.artist2Stats.topSongs.map(
                          (song: string, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {i + 1}.
                              </span>
                              {song}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
