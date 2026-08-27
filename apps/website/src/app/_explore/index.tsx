/* eslint-disable one-var, sort-vars, complexity, require-unicode-regexp, no-empty, no-nested-ternary, unicorn/no-nested-ternary, react-hooks/exhaustive-deps, react/exhaustive-effect-dependencies, react/todo */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Compass,
  Disc,
  Flame,
  Headphones,
  LocateFixed,
  MapPin,
  Music,
  Play,
  Radio,
  RotateCcw,
  ShoppingBag,
  Swords,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PremiumActivationCard } from "@/components/billing/premium-activation-card";
import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import type { LeaderboardArtist } from "@/components/explore/artist-leaderboard-card";
import { BattleCard } from "@/components/explore/battle-card";
import { SectionHeader } from "@/components/explore/section-header";
import { TrackCard } from "@/components/explore/track-card";
import { VideoCard } from "@/components/explore/video-card";
import {
  mapScopes,
  WorldAndUSAMap,
} from "@/components/explore/world-and-usa-map";
import type { MapScope } from "@/components/explore/world-and-usa-map";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  exploreLocationPhrase,
  exploreRegionSlug,
  mapScopeForDetectedLocation,
  mapScopeFromValue,
  regionTypeForMapScope,
} from "@/lib/explore-region";
import {
  useArtistsQuery,
  useBattlesQuery,
  useListeningPartiesQuery,
  usePublicLiveExperiencesQuery,
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

interface ExploreSearch {
  mapScope?: MapScope;
  upgraded?: boolean;
  region?: string;
  regionType?: "global" | "north-america";
}

export const Route = createFileRoute("/_explore/")({
  component: ExplorePage,
  validateSearch: (search: Record<string, unknown>): ExploreSearch => ({
    mapScope: mapScopeFromValue(search.mapScope),
    region: typeof search.region === "string" ? search.region : undefined,
    regionType:
      search.regionType === "global" || search.regionType === "north-america"
        ? search.regionType
        : undefined,
    upgraded: search.upgraded === "1" || search.upgraded === true,
  }),
});

function ExplorePage() {
  const { upgraded } = Route.useSearch();

  return (
    <>
      {upgraded ? <PremiumActivationCard accountType="fan" /> : null}
      <LocalExplorePage />
    </>
  );
}

function LocalExplorePage() {
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    savedRegion =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("exploreRegion"),
    savedRegionType =
      typeof window === "undefined"
        ? null
        : (localStorage.getItem("exploreRegionType") as
            | "global"
            | "north-america"
            | null),
    savedMapScope =
      typeof window === "undefined"
        ? null
        : mapScopeFromValue(localStorage.getItem("exploreMapScope")),
    savedUserLocation =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("soundkit_user_location"),
    initialRegion =
      search.region ??
      (savedRegion && mapScopeFromValue(savedRegion) ? null : savedRegion) ??
      savedUserLocation ??
      null,
    initialRegionType: "global" | "north-america" =
      search.regionType ??
      savedRegionType ??
      (initialRegion && initialRegion !== "all" ? "north-america" : "global"),
    initialMapScope: MapScope =
      search.mapScope ??
      savedMapScope ??
      (initialRegionType === "global"
        ? (mapScopeFromValue(initialRegion) ?? "global")
        : "usa"),
    [selectedRegion, setSelectedRegion] = useState<string | null>(
      initialRegion === "all" || initialRegion === initialMapScope
        ? null
        : initialRegion
    ),
    [mapScope, setMapScope] = useState<MapScope>(initialMapScope),
    [userLocation, setUserLocation] = useState<string | null>(
      savedUserLocation ??
        (initialRegionType === "global" || initialRegion === "all"
          ? null
          : initialRegion)
    ),
    [isLoadingLocation, setIsLoadingLocation] = useState(false),
    pageRef = useRef<HTMLDivElement>(null),
    [locationPromptState, setLocationPromptState] = useState<
      "denied" | "granted" | "idle" | "prompting" | "unsupported"
    >(savedUserLocation || savedRegion ? "granted" : "idle"),
    activeRegion =
      selectedRegion ??
      (mapScope === "global"
        ? "SoundKit"
        : (mapScopes.find((s) => s.id === mapScope)?.label ?? "SoundKit")),
    isGlobalView = selectedRegion === null && mapScope === "global",
    regionSlug = selectedRegion
      ? exploreRegionSlug(selectedRegion)
      : isGlobalView
        ? "all"
        : mapScope,
    exploreRegionType = regionTypeForMapScope(mapScope),
    locationPhrase = exploreLocationPhrase({
      mapScope,
      region: selectedRegion,
    }),
    regionSearch = isGlobalView
      ? "regionType=global&region=all"
      : `regionType=${exploreRegionType}&region=${regionSlug}`,
    battlesHref = `/live/battles?${regionSearch}`,
    tracksHref = `/tracks?${regionSearch}`,
    releasesHref = `/tracks?${regionSearch}&sort=date-desc`,
    artistsHref = `/artist?${regionSearch}`,
    videosHref = `/videos?${regionSearch}`,
    projectsHref = `/projects?${regionSearch}`,
    streamsHref = `/live/streams?${regionSearch}`,
    partiesHref = `/live/parties?${regionSearch}`,
    publicExploreQuery = {
      limit: 12,
      region: regionSlug,
      regionType: exploreRegionType,
      scope: "public",
    } as const,
    { data: topTracks = [], isLoading: isLoadingTopTracks } = useTracksQuery(
      undefined,
      {
        ...publicExploreQuery,
        sort: "plays-desc",
      }
    ),
    { data: newTracks = [], isLoading: isLoadingNewTracks } = useTracksQuery(
      undefined,
      {
        ...publicExploreQuery,
        sort: "date-desc",
      }
    ),
    { data: videos = [], isLoading: isLoadingVideos } =
      useVideosQuery(publicExploreQuery),
    { data: projects = [], isLoading: isLoadingProjects } =
      usePublicProjectsQuery({
        limit: 12,
        region: regionSlug,
        regionType: exploreRegionType,
        sort: "date-desc",
      }),
    { data: artists = [], isLoading: isLoadingArtists } = useArtistsQuery({
      category: "top",
      limit: 10,
      region: regionSlug,
      regionType: exploreRegionType,
      sort: "rank-asc",
    }),
    regionalLiveQuery = {
      region: regionSlug,
      regionType: exploreRegionType,
    } as const,
    { data: battles = [], isLoading: isLoadingBattles } =
      useBattlesQuery(regionalLiveQuery),
    { data: publicStreams = [], isLoading: isLoadingStreams } =
      usePublicLiveExperiencesQuery("stream", regionalLiveQuery),
    { data: listeningParties = [], isLoading: isLoadingParties } =
      useListeningPartiesQuery(regionalLiveQuery),
    syncLocation = ({
      newMapScope,
      newRegion,
      newRegionType,
    }: {
      newMapScope: MapScope;
      newRegion: string | null;
      newRegionType: "global" | "north-america";
    }) => {
      setSelectedRegion(newRegion);
      setMapScope(newMapScope);
      const slug = newRegion
        ? exploreRegionSlug(newRegion)
        : newMapScope === "global"
          ? "all"
          : newMapScope;
      if (typeof window !== "undefined") {
        localStorage.setItem("exploreMapScope", newMapScope);
        localStorage.setItem("exploreRegion", slug);
        localStorage.setItem("exploreRegionType", newRegionType);
      }
      navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          mapScope: newMapScope,
          region: slug,
          regionType: newRegionType,
        }),
      });
    },
    requestLocation = () => {
      setIsLoadingLocation(true);

      try {
        if (!("geolocation" in navigator)) {
          setLocationPromptState("unsupported");
          syncLocation({
            newMapScope: "global",
            newRegion: null,
            newRegionType: "global",
          });
          setUserLocation(null);
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
                ),
                data = await response.json(),
                detectedMapScope = mapScopeForDetectedLocation({
                  countryCode: data.countryCode,
                }),
                detectedRegion =
                  data.countryCode?.toUpperCase() === "US"
                    ? data.principalSubdivision || data.countryName
                    : data.countryName;
              if (!detectedRegion) {
                throw new Error("Location response did not include a region.");
              }
              setUserLocation(detectedRegion);
              localStorage.setItem("soundkit_user_location", detectedRegion);
              syncLocation({
                newMapScope: detectedMapScope,
                newRegion: detectedRegion,
                newRegionType: regionTypeForMapScope(detectedMapScope),
              });
              setLocationPromptState("granted");
            } catch {
              setLocationPromptState("denied");
            }
            setIsLoadingLocation(false);
          },
          () => {
            setLocationPromptState("denied");
            setUserLocation(null);
            syncLocation({
              newMapScope: "global",
              newRegion: null,
              newRegionType: "global",
            });
            setIsLoadingLocation(false);
          }
        );
      } catch {
        setLocationPromptState("denied");
        setUserLocation(null);
        syncLocation({
          newMapScope: "global",
          newRegion: null,
          newRegionType: "global",
        });
        setIsLoadingLocation(false);
      }
    };

  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.dataset.hydrated = "true";
    }
  }, []);

  useEffect(() => {
    if (search.region || search.regionType) {
      return;
    }
    // Check saved user location in localStorage on mount
    try {
      const savedLocation = localStorage.getItem("soundkit_user_location");
      if (savedLocation) {
        setUserLocation(savedLocation);
        setSelectedRegion(savedLocation);
        setMapScope(savedMapScope ?? "global");
        setLocationPromptState("granted");
        return;
      }
    } catch {}

    // On initial visit without saved location, automatically request location
    try {
      const alreadyPrompted = sessionStorage.getItem(
        "soundkit_location_prompted"
      );
      if (!alreadyPrompted && "geolocation" in navigator) {
        sessionStorage.setItem("soundkit_location_prompted", "true");
        requestLocation();
      }
    } catch {}
  }, [search.region, search.regionType]);

  const handleResetGlobal = () => {
    syncLocation({
      newMapScope: "global",
      newRegion: null,
      newRegionType: "global",
    });
  };

  return (
    <div
      className="min-h-screen bg-background px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8"
      data-hydrated="false"
      data-testid="explore-page"
      ref={pageRef}
    >
      <div className="lg:flex">
        <main className="min-w-0 flex-1">
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
                  onRegionSelect={(region) => {
                    syncLocation({
                      newMapScope: mapScope,
                      newRegion: region,
                      newRegionType: regionTypeForMapScope(mapScope),
                    });
                  }}
                  onScopeChange={(scope) => {
                    syncLocation({
                      newMapScope: scope,
                      newRegion: null,
                      newRegionType: regionTypeForMapScope(scope),
                    });
                  }}
                />
              </CardContent>
            </Card>
          </section>

          <div className="space-y-6 md:space-y-8 lg:space-y-10 pb-8 md:pb-10 lg:pb-12">
            {/* 1. Top Songs in {location} */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Most played tracks across the app this week"
                    : `Most played tracks in ${activeRegion} this week`
                }
                icon={<Music className="size-5 md:size-6 text-primary" />}
                title={`Top Songs ${locationPhrase}`}
                viewAllHref={tracksHref}
              />
              <HomeRail
                empty="No songs are live for this view yet."
                isLoading={isLoadingTopTracks}
                items={topTracks}
                keyForItem={(track) => track.id}
                renderItem={(track) => (
                  <TrackCard
                    artist={track.artistName}
                    artistSlug={track.artistUsername ?? "artist"}
                    cover={track.coverArtUrl ?? "/placeholder.svg"}
                    duration={track.duration}
                    id={track.id}
                    key={track.id}
                    plays={track.plays.toLocaleString()}
                    regionSlug={track.regionSlug}
                    slug={track.slug}
                    title={track.title}
                  />
                )}
              />
            </section>

            {/* 2. New Releases in {location} */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Fresh drops from every active scene"
                    : `Fresh tracks from artists in ${activeRegion}`
                }
                icon={<Flame className="size-5 md:size-6 text-primary" />}
                title={`New Releases ${locationPhrase}`}
                viewAllHref={releasesHref}
              />
              <HomeRail
                empty="No new releases are live for this view yet."
                isLoading={isLoadingNewTracks}
                items={newTracks}
                keyForItem={(track) => track.id}
                renderItem={(track) => (
                  <TrackCard
                    artist={track.artistName}
                    artistSlug={track.artistUsername ?? "artist"}
                    cover={track.coverArtUrl ?? "/placeholder.svg"}
                    duration={track.duration}
                    id={track.id}
                    key={track.id}
                    plays={track.plays.toLocaleString()}
                    regionSlug={track.regionSlug}
                    slug={track.slug}
                    title={track.title}
                  />
                )}
              />
            </section>

            {/* 3. Live Battles */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Top beat battles happening across the app right now"
                    : `Vote in head-to-head producer matchups in ${activeRegion}`
                }
                icon={<Swords className="size-5 md:size-6 text-primary" />}
                title={`Live Battles ${locationPhrase}`}
                viewAllHref={battlesHref}
              />
              <HomeRail
                empty="No battles are live for this view yet."
                isLoading={isLoadingBattles}
                items={battles}
                keyForItem={(battle) => battle.id}
                renderItem={(battle) => (
                  <BattleSummaryCard battle={battle} key={battle.id} />
                )}
              />
            </section>

            {/* 4. Top Artists in {location} */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Rising stars and established artists across the app"
                    : `Rising stars and top performers in ${activeRegion}`
                }
                icon={<Users className="size-5 md:size-6 text-primary" />}
                title={`Top Artists ${locationPhrase}`}
                viewAllHref={artistsHref}
              />
              <HomeRail
                empty="No artists are live for this view yet."
                isLoading={isLoadingArtists}
                items={chunkArtists(artists, activeRegion)}
                keyForItem={(artistGroup) =>
                  artistGroup.map((artist) => artist.slug).join("-")
                }
                renderItem={(artistGroup) => (
                  <div
                    className="w-[320px] shrink-0 md:w-[360px]"
                    key={artistGroup.map((artist) => artist.slug).join("-")}
                  >
                    <ArtistLeaderboardCard
                      artists={artistGroup}
                      showBorder={false}
                      type="rising"
                    />
                  </div>
                )}
              />
            </section>

            {/* 5. Featured Videos */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Official music videos, studio sessions, and live drops from SoundKit artists"
                    : `Watch official drops and visual releases from ${activeRegion}`
                }
                icon={<Video className="size-5 md:size-6 text-primary" />}
                title={`Featured Videos ${locationPhrase}`}
                viewAllHref={videosHref}
              />
              <HomeRail
                empty="No videos are live for this view yet."
                isLoading={isLoadingVideos}
                items={videos}
                keyForItem={(video) => video.id}
                renderItem={(video) => (
                  <div
                    className="w-[300px] shrink-0 md:w-[360px]"
                    key={video.id}
                  >
                    <VideoCard video={toExploreVideo(video)} />
                  </div>
                )}
              />
            </section>

            {/* 6. Live Streams in {location} / Featured Streams */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Real-time broadcasts, studio sessions, and DJ sets live right now"
                    : `Active live streams broadcasting in ${activeRegion}`
                }
                icon={<Radio className="size-5 md:size-6 text-primary" />}
                title={`Live Streams ${locationPhrase}`}
                viewAllHref={streamsHref}
              />
              <HomeRail
                empty="No live streams currently broadcasting. Start one from your artist dashboard!"
                isLoading={isLoadingStreams}
                items={publicStreams}
                keyForItem={(stream) => stream.id}
                renderItem={(stream) => (
                  <LiveStreamSummaryCard key={stream.id} stream={stream} />
                )}
              />
            </section>

            {/* 7. Featured Projects / Mixtapes */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Albums, EPs, beat kits, and mixtapes from across SoundKit"
                    : `Albums, EPs, and mixtapes in ${activeRegion}`
                }
                icon={<Disc className="size-5 md:size-6 text-primary" />}
                title={`Featured Projects ${locationPhrase}`}
                viewAllHref={projectsHref}
              />
              <HomeRail
                empty="No featured projects are live for this view yet."
                isLoading={isLoadingProjects}
                items={projects}
                keyForItem={(project) => project.id}
                renderItem={(project) => (
                  <HomeProjectCard key={project.id} project={project} />
                )}
              />
            </section>

            {/* 8. Upcoming Listening Parties */}
            <section>
              <SectionHeader
                description={
                  isGlobalView
                    ? "Join community listening parties and track premieres with the creator"
                    : `Upcoming album listening parties in ${activeRegion}`
                }
                icon={<Headphones className="size-5 md:size-6 text-primary" />}
                title={`Listening Parties ${locationPhrase}`}
                viewAllHref={partiesHref}
              />
              <HomeRail
                empty="No upcoming listening parties scheduled right now."
                isLoading={isLoadingParties}
                items={listeningParties}
                keyForItem={(party) => party.id}
                renderItem={(party) => (
                  <ListeningPartySummaryCard key={party.id} party={party} />
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
  keyForItem,
  renderItem,
}: {
  empty: string;
  isLoading: boolean;
  items: T[];
  keyForItem: (item: T) => string;
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
    <div
      className="max-w-full overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-testid="home-rail"
    >
      <div className="flex w-max gap-3 md:gap-4">
        {items.map((item) => (
          <div className="snap-start" key={keyForItem(item)}>
            {renderItem(item)}
          </div>
        ))}
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
  },
  toLeaderboardArtist = (
    artist: ArtistSummary,
    index: number,
    activeRegion: string
  ): LeaderboardArtist => ({
    avatar: artist.avatarUrl ?? "/soundkit-default-avatar.svg",
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
  }),
  chunkArtists = (artists: ArtistSummary[], activeRegion: string) => {
    const leaderboardArtists = artists.map((artist, index) =>
      toLeaderboardArtist(artist, index, activeRegion)
    );

    return [
      leaderboardArtists.slice(0, 5),
      leaderboardArtists.slice(5, 10),
    ].filter((group) => group.length > 0);
  },
  toExploreVideo = (video: VideoSummary) => ({
    creator: {
      avatarUrl: video.creatorAvatarUrl ?? null,
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
  const tracks = battle.tracks ?? [];

  return (
    <div className="w-[320px] shrink-0 md:w-[360px]">
      <BattleCard
        currentRound={battle.round?.current ?? 1}
        genre={battle.genre}
        id={battle.id}
        isLive={battle.status === "live"}
        isPremiumUser={battle.visibility !== "premium_only"}
        isVoting={battle.round?.isVoting ?? false}
        joinMode={battle.joinMode}
        participants={battle.participants}
        phaseEndsAt={battle.phaseEndsAt}
        queueSize={battle.queueSize}
        startsAt={battle.startsAt}
        status={battle.status}
        title={battle.title}
        totalRounds={battle.round?.total ?? 1}
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
        views={`${battle.viewerCount.toLocaleString()} viewers`}
      />
    </div>
  );
}

function LiveStreamSummaryCard({
  stream,
}: {
  stream: {
    creatorAvatar?: string | null;
    creatorName?: string | null;
    genre?: string | null;
    id: string;
    kind: string;
    status: string;
    title: string;
    viewerCount: number;
  };
}) {
  const isLive = stream.status === "live";

  return (
    <Link
      className="block w-[320px] shrink-0 md:w-[360px]"
      params={{ id: stream.id }}
      to="/live/streams/$id"
    >
      <Card className="h-full border-border/40 bg-card/60 transition-colors hover:border-primary/50 overflow-hidden">
        <div className="relative aspect-video w-full bg-black/60">
          <AppImage
            alt={stream.title}
            className="size-full object-cover opacity-80"
            src="/night-music-album-cover.webp"
          />
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <Badge
              className="font-bold text-[10px]"
              variant={isLive ? "destructive" : "secondary"}
            >
              {isLive ? "LIVE" : "SCHEDULED"}
            </Badge>
            {stream.genre && (
              <Badge
                className="bg-black/60 backdrop-blur-md text-[10px]"
                variant="outline"
              >
                {stream.genre}
              </Badge>
            )}
          </div>
          <div className="absolute right-2.5 bottom-2.5">
            <Badge
              className="bg-black/70 backdrop-blur-md text-[10px] gap-1"
              variant="outline"
            >
              <Radio className="size-2.5 text-destructive animate-pulse" />
              {stream.viewerCount.toLocaleString()}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-1.5 p-3.5">
          <h4 className="line-clamp-1 font-semibold text-sm text-foreground">
            {stream.title}
          </h4>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {stream.creatorName ?? "SoundKit Creator"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListeningPartySummaryCard({
  party,
}: {
  party: {
    description?: string | null;
    genre?: string | null;
    id: string;
    scheduledStartAt: string;
    status: string;
    title: string;
  };
}) {
  const isLive = party.status === "live";

  return (
    <Link
      className="block w-[260px] shrink-0 md:w-[300px]"
      params={{ id: party.id }}
      to="/live/parties/$id"
    >
      <Card className="h-full border-border/40 bg-card/60 transition-colors hover:border-primary/50 overflow-hidden">
        <div className="relative aspect-video w-full bg-black/60">
          <AppImage
            alt={party.title}
            className="size-full object-cover opacity-80"
            src="/summer-music-album-cover.webp"
          />
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <Badge
              className="font-bold text-[10px]"
              variant={isLive ? "destructive" : "secondary"}
            >
              {isLive ? "PARTY LIVE" : "UPCOMING PARTY"}
            </Badge>
          </div>
        </div>
        <CardContent className="space-y-1.5 p-3.5">
          <h4 className="line-clamp-1 font-semibold text-sm text-foreground">
            {party.title}
          </h4>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {party.description || "Community Album Premiere & Listening Room"}
          </p>
          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
            <span>{party.genre ?? "Album Premiere"}</span>
            <span className="font-mono text-primary">
              {new Date(party.scheduledStartAt).toLocaleDateString([], {
                day: "numeric",
                month: "short",
              })}
            </span>
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
