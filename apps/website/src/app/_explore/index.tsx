import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Compass,
  Disc,
  Flame,
  LocateFixed,
  MapPin,
  Music,
  Play,
  RotateCcw,
  ShoppingBag,
  Users,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import type { LeaderboardArtist } from "@/components/explore/artist-leaderboard-card";
import { SectionHeader } from "@/components/explore/section-header";
import { TrackCard } from "@/components/explore/track-card";
import { VideoCard } from "@/components/explore/video-card";
import {
  mapScopes,
  WorldAndUSAMap,
} from "@/components/explore/world-and-usa-map";
import type { MapScope } from "@/components/explore/world-and-usa-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppImage } from "@/components/ui/app-image";
import {
  useArtistsQuery,
  useBattlesQuery,
  useDiscoverHomeQuery,
  usePublicProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";
import type {
  ArtistSummary,
  BattleSummary,
  PublicProjectSummary,
  VideoSummary,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/")({
  component: ExplorePage,
});

function ExplorePage() {
  const { data: home } = useDiscoverHomeQuery();

  return (
    <LocalExplorePage
      startsWithAppWideTotals={home?.settings.useGlobalExploreHome ?? true}
    />
  );
}

function LocalExplorePage({
  startsWithAppWideTotals,
}: Readonly<{ startsWithAppWideTotals: boolean }>) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mapScope, setMapScope] = useState<MapScope>("global");
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationPromptState, setLocationPromptState] = useState<
    "idle" | "prompting" | "granted" | "denied" | "unsupported"
  >("idle");

  const activeRegion =
    selectedRegion ??
    (mapScope === "global"
      ? "Global"
      : (mapScopes.find((s) => s.id === mapScope)?.label ?? "SoundKit"));
  const isGlobalView = selectedRegion === null && mapScope === "global";

  const regionSlug = selectedRegion
    ? selectedRegion.toLowerCase().replaceAll(/\s+/g, "-")
    : mapScope;
  const exploreRegionType = mapScope === "global" ? "global" : "north-america";
  const regionSearch = `regionType=${exploreRegionType}&region=${regionSlug}`;
  const battlesHref = `/live?${regionSearch}`;
  const tracksHref = `/tracks?${regionSearch}`;
  const releasesHref = `/tracks?${regionSearch}&sort=date-desc`;
  const artistsHref = `/artist?${regionSearch}`;
  const videosHref = `/videos?${regionSearch}`;
  const projectsHref = `/projects?${regionSearch}`;
  const publicExploreQuery = {
    limit: 12,
    region: regionSlug,
    regionType: exploreRegionType,
    scope: "public",
  } as const;
  const { data: topTracks = [], isLoading: isLoadingTopTracks } =
    useTracksQuery(undefined, {
      ...publicExploreQuery,
      sort: "plays-desc",
    });
  const { data: newTracks = [], isLoading: isLoadingNewTracks } =
    useTracksQuery(undefined, {
      ...publicExploreQuery,
      sort: "date-desc",
    });
  const { data: videos = [], isLoading: isLoadingVideos } =
    useVideosQuery(publicExploreQuery);
  const { data: projects = [], isLoading: isLoadingProjects } =
    usePublicProjectsQuery({
      limit: 12,
      region: regionSlug,
      regionType: exploreRegionType,
      sort: "date-desc",
    });
  const { data: artists = [], isLoading: isLoadingArtists } = useArtistsQuery({
    category: "top",
    limit: 10,
    region: regionSlug,
    regionType: exploreRegionType,
    sort: "rank-asc",
  });
  const { data: battles = [], isLoading: isLoadingBattles } = useBattlesQuery();

  const requestLocation = () => {
    setIsLoadingLocation(true);

    try {
      if (!("geolocation" in navigator)) {
        setLocationPromptState("unsupported");
        setUserLocation(null);
        setSelectedRegion(null);
        setIsLoadingLocation(false);
        return;
      }

      setLocationPromptState("prompting");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const detectedState =
              data.principalSubdivision || data.countryName || "California";
            setUserLocation(detectedState);
            setSelectedRegion(detectedState);
            setMapScope("north-america");
            try {
              localStorage.setItem("soundkit_user_location", detectedState);
            } catch {}
          } catch {
            const fallback = "California";
            setUserLocation(fallback);
            setSelectedRegion(fallback);
            setMapScope("north-america");
          }

          setLocationPromptState("granted");
          setIsLoadingLocation(false);
        },
        () => {
          setLocationPromptState("denied");
          setUserLocation(null);
          setSelectedRegion(null);
          setMapScope("global");
          setIsLoadingLocation(false);
        }
      );
    } catch {
      setLocationPromptState("denied");
      setUserLocation(null);
      setSelectedRegion(null);
      setMapScope("global");
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    // Check saved user location in localStorage on mount
    try {
      const savedLocation = localStorage.getItem("soundkit_user_location");
      if (savedLocation) {
        setUserLocation(savedLocation);
        setSelectedRegion(savedLocation);
        setMapScope("north-america");
        setLocationPromptState("granted");
        return;
      }
    } catch {}

    // Default to global view with app-wide totals unless location is explicitly requested
    setSelectedRegion(null);
    setMapScope("global");
  }, [startsWithAppWideTotals]);

  const handleResetGlobal = () => {
    setSelectedRegion(null);
    setMapScope("global");
  };

  return (
    <div className="min-h-screen bg-background px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="lg:flex">
        <main className="flex-1">
          <section className="mb-6 md:mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 md:mb-2 flex items-center gap-3">
                  <Compass className="size-8 text-primary" />
                  Discover Music
                </h1>
                <p className="text-muted-foreground text-xs md:text-sm lg:text-base">
                  {isLoadingLocation
                    ? "Locating your region to personalize your feed..."
                    : selectedRegion
                      ? `Viewing music stats focused on ${selectedRegion}. Click another region or switch map scope.`
                      : isGlobalView
                        ? "Showing app-wide totals across all scenes. Select a continent or region on the map to filter."
                        : `Showing top music in ${activeRegion}. Click any country or state on the map.`}
                </p>
              </div>

              {/* Reset to Global View Button */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                {!isGlobalView && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={handleResetGlobal}
                  >
                    <RotateCcw className="size-3.5" />
                    Reset to Global View
                  </Button>
                )}
                {userLocation && (
                  <Badge variant="outline" className="gap-1 text-xs py-1">
                    <MapPin className="size-3 text-primary" />
                    {userLocation}
                  </Badge>
                )}
              </div>
            </div>

            {locationPromptState !== "granted" && (
              <Card className="mb-4 md:mb-6 border-primary/20 bg-card/60">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {locationPromptState === "prompting"
                        ? "Requesting location permission..."
                        : locationPromptState === "denied"
                          ? "Location access declined — showing Global View"
                          : locationPromptState === "unsupported"
                            ? "Location access is unavailable in this browser."
                            : "Personalize your local scene"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {locationPromptState === "denied"
                        ? "You are currently browsing global app-wide totals across Africa, Europe, Asia, and the Americas."
                        : "Enable location to automatically highlight artists, battles, and drops from your state or country."}
                    </p>
                  </div>
                  {locationPromptState !== "unsupported" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 self-start md:self-center shrink-0"
                      onClick={requestLocation}
                      disabled={isLoadingLocation}
                    >
                      <LocateFixed className="size-4" />
                      {locationPromptState === "denied"
                        ? "Enable Location"
                        : "Use my location"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-2 md:p-4 lg:p-6">
                <WorldAndUSAMap
                  mapScope={mapScope}
                  selectedRegion={selectedRegion}
                  onRegionSelect={(reg) => setSelectedRegion(reg)}
                  onScopeChange={(scope) => {
                    setMapScope(scope);
                    if (scope === "global") {
                      setSelectedRegion(null);
                    }
                  }}
                />
              </CardContent>
            </Card>
          </section>

          <div className="space-y-6 md:space-y-8 lg:space-y-10 pb-8 md:pb-10 lg:pb-12">
            <section>
              <SectionHeader
                title={
                  isGlobalView
                    ? "Featured Videos Across SoundKit"
                    : `Featured Videos in ${activeRegion}`
                }
                description={
                  isGlobalView
                    ? "Official music videos, battle replays, and live recordings from the full app"
                    : `Watch official drops and replays from ${activeRegion}`
                }
                icon={<Video className="size-5 md:size-6 text-primary" />}
                viewAllHref={videosHref}
              />
              <HomeRail
                empty="No videos are live for this view yet."
                isLoading={isLoadingVideos}
                items={videos}
                renderItem={(video) => (
                  <div className="w-[300px] shrink-0 md:w-[360px]">
                    <VideoCard key={video.id} video={toExploreVideo(video)} />
                  </div>
                )}
              />
            </section>

            <section>
              <SectionHeader
                title={
                  isGlobalView
                    ? "Live Battles Across SoundKit"
                    : `Live Battles in ${activeRegion}`
                }
                description={
                  isGlobalView
                    ? "Top battles happening across the app right now"
                    : `Vote for your favorite tracks in ${activeRegion}`
                }
                viewAllHref={battlesHref}
              />
              <HomeRail
                empty="No battles are live for this view yet."
                isLoading={isLoadingBattles}
                items={battles}
                renderItem={(battle) => (
                  <BattleSummaryCard key={battle.id} battle={battle} />
                )}
              />
            </section>

            <section>
              <SectionHeader
                title={
                  isGlobalView
                    ? "Top Songs Across SoundKit"
                    : `Top Songs in ${activeRegion}`
                }
                description={
                  isGlobalView
                    ? "Most played tracks across the app this week"
                    : `Most played tracks in ${activeRegion} this week`
                }
                icon={<Music className="size-5 md:size-6 text-primary" />}
                viewAllHref={tracksHref}
              />
              <HomeRail
                empty="No songs are live for this view yet."
                isLoading={isLoadingTopTracks}
                items={topTracks}
                renderItem={(track) => (
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
                )}
              />
            </section>

            <section>
              <SectionHeader
                title={
                  isGlobalView
                    ? "New Releases Across SoundKit"
                    : `New Releases in ${activeRegion}`
                }
                description={
                  isGlobalView
                    ? "Fresh drops from every active scene"
                    : `Fresh tracks from artists in ${activeRegion}`
                }
                icon={<Flame className="size-5 md:size-6 text-primary" />}
                viewAllHref={releasesHref}
              />
              <HomeRail
                empty="No new releases are live for this view yet."
                isLoading={isLoadingNewTracks}
                items={newTracks}
                renderItem={(track) => (
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
                )}
              />
            </section>

            <section>
              <SectionHeader
                title={
                  isGlobalView
                    ? "Top Artists Across SoundKit"
                    : `Top Artists in ${activeRegion}`
                }
                description={
                  isGlobalView
                    ? "Rising stars and established artists across the app"
                    : `Rising stars and top performers in ${activeRegion}`
                }
                icon={<Users className="size-5 md:size-6 text-primary" />}
                viewAllHref={artistsHref}
              />
              <HomeRail
                empty="No artists are live for this view yet."
                isLoading={isLoadingArtists}
                items={chunkArtists(artists, activeRegion)}
                renderItem={(artistGroup) => (
                  <div
                    key={artistGroup.map((artist) => artist.slug).join("-")}
                    className="w-[320px] shrink-0 md:w-[360px]"
                  >
                    <ArtistLeaderboardCard
                      artists={artistGroup}
                      type="rising"
                      showBorder={false}
                    />
                  </div>
                )}
              />
            </section>

            <section>
              <SectionHeader
                title="Featured Projects"
                description={
                  isGlobalView
                    ? "Albums, EPs, and mixtapes from across SoundKit"
                    : `Albums, EPs, and mixtapes in ${activeRegion}`
                }
                icon={<Disc className="size-5 md:size-6 text-primary" />}
                viewAllHref={projectsHref}
              />
              <HomeRail
                empty="No featured projects are live for this view yet."
                isLoading={isLoadingProjects}
                items={projects}
                renderItem={(project) => (
                  <HomeProjectCard key={project.id} project={project} />
                )}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function HomeRail<T>({
  empty,
  isLoading,
  items,
  renderItem,
}: {
  empty: string;
  isLoading: boolean;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  if (!(isLoading || items.length > 0)) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
        {empty}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-3 md:gap-4">
        {items.map((item) => renderItem(item))}
      </div>
    </div>
  );
}

const formatCompactCount = (value?: number | null) => {
  if (!value) {
    return "0";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }

  return value.toLocaleString();
};

const toLeaderboardArtist = (
  artist: ArtistSummary,
  index: number,
  activeRegion: string
): LeaderboardArtist => ({
  avatar: artist.avatarUrl ?? "/diverse-user-avatars.png",
  genre: artist.genre,
  location: artist.location || artist.state || activeRegion,
  name: artist.name,
  rank:
    typeof artist.rank === "number" && artist.rank > 0
      ? artist.rank
      : index + 1,
  slug: artist.username,
  stats: {
    followers: formatCompactCount(artist.followers),
    plays: formatCompactCount(artist.weeklyPlays),
  },
  verified: artist.verified,
});

const chunkArtists = (artists: ArtistSummary[], activeRegion: string) => {
  const leaderboardArtists = artists.map((artist, index) =>
    toLeaderboardArtist(artist, index, activeRegion)
  );

  return [
    leaderboardArtists.slice(0, 5),
    leaderboardArtists.slice(5, 10),
  ].filter((group) => group.length > 0);
};

const toExploreVideo = (video: VideoSummary) => ({
  creator: {
    name: video.creatorName ?? "SoundKit creator",
    slug: video.creatorUsername ?? "artist",
  },
  duration: video.duration ?? "0:00",
  id: video.id,
  playbackPolicy: video.playbackPolicy,
  regionSlug: video.regionSlug,
  slug: video.slug,
  status: video.status,
  thumbnail: video.thumbnailUrl ?? "/placeholder.svg",
  title: video.title,
  verifiedOnPlatform: video.verifiedOnPlatform,
  videoKind: video.videoKind,
  viewCount: video.viewCount ?? "0",
});

function BattleSummaryCard({ battle }: { battle: BattleSummary }) {
  return (
    <Link
      className="block w-[260px] shrink-0 md:w-[300px]"
      params={{ id: battle.id }}
      to="/live/battles/$id"
    >
      <Card className="h-full border-border/40 bg-card/60 transition-colors hover:border-primary/50">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">{battle.genre}</Badge>
            <Badge variant={battle.status === "live" ? "destructive" : "outline"}>
              {battle.status}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-semibold text-base">
              {battle.title}
            </h3>
            <p className="mt-1 text-muted-foreground text-xs">
              {battle.format.replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>{battle.viewerCount.toLocaleString()} viewers</span>
            {battle.visibility === "premium_only" ? (
              <span className="font-medium text-primary">Premium</span>
            ) : (
              <span>Public</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HomeProjectCard({ project }: { project: PublicProjectSummary }) {
  return (
    <Card className="group w-[220px] shrink-0 overflow-hidden border-border/40 bg-card/60 transition-colors hover:border-primary/50">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {project.coverArtUrl ? (
          <AppImage
            alt={project.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={project.coverArtUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-accent/40 text-muted-foreground">
            <Disc className="size-14 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
          <Button asChild className="rounded-full shadow-lg" size="icon">
            <Link params={{ id: project.id }} to="/projects/$id">
              <Play className="ml-0.5 size-5 fill-current" />
            </Link>
          </Button>
        </div>
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge
            className="text-[10px] uppercase tracking-wide"
            variant="secondary"
          >
            {project.projectType}
          </Badge>
          {project.isForSale && (
            <Badge className="bg-black/70 text-[10px] text-white">
              <ShoppingBag className="mr-1 size-3" />
              For Sale
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <Link
          className="line-clamp-1 font-semibold transition-colors group-hover:text-primary"
          params={{ id: project.id }}
          to="/projects/$id"
        >
          {project.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-muted-foreground text-sm">
          {project.genre ?? "Mixed genre"}
        </p>
        <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
          <span>{project.trackCount} tracks</span>
          <span>{project.duration ?? "0:00"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
