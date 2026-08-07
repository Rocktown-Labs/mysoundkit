import { createFileRoute } from "@tanstack/react-router";
import {
  Compass,
  Flame,
  Globe,
  LocateFixed,
  MapPin,
  Music,
  RotateCcw,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import { BattleCard } from "@/components/explore/battle-card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockVideos } from "@/lib/mock-videos";
import { useDiscoverHomeQuery } from "@/lib/soundkit-api-hooks";

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
  const regionSearch = `regionType=${mapScope}&region=${regionSlug}`;
  const battlesHref = `/live?${regionSearch}`;
  const tracksHref = `/tracks?${regionSearch}`;
  const releasesHref = `/new-releases?location=${encodeURIComponent(activeRegion)}`;
  const artistsHref = `/artist?${regionSearch}`;
  const videosHref = `/videos?${regionSearch}`;

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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {mockVideos.slice(0, 3).map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
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
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
                <div className="flex gap-3 md:gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-w-max md:min-w-0">
                  <BattleCard
                    id="battle-1"
                    title="West Coast Showdown"
                    track1={{
                      artist: "DJ Nova",
                      cover: "/summer-music-album-cover.png",
                      title: "Midnight Drive",
                      votes: 1247,
                    }}
                    track2={{
                      artist: "MC Rhythm",
                      cover: "/night-music-album-cover.png",
                      title: "City Lights",
                      votes: 1089,
                    }}
                    endsIn="2h 34m"
                    genre="Hip-Hop"
                  />
                  <BattleCard
                    id="battle-2"
                    title="Bay Area Beats"
                    track1={{
                      artist: "Sunset Collective",
                      cover: "/hip-hop-album-cover.png",
                      title: "Golden Hour",
                      votes: 892,
                    }}
                    track2={{
                      artist: "Urban Echo",
                      cover: "/summer-music-album-cover.png",
                      title: "Neon Nights",
                      votes: 756,
                    }}
                    endsIn="5h 12m"
                    genre="R&B"
                  />
                  <BattleCard
                    id="battle-3"
                    title="LA Underground"
                    track1={{
                      artist: "Sub Frequency",
                      cover: "/night-music-album-cover.png",
                      title: "Bassline Theory",
                      votes: 2156,
                    }}
                    track2={{
                      artist: "Beat Architect",
                      cover: "/hip-hop-album-cover.png",
                      title: "Rhythm Code",
                      votes: 1998,
                    }}
                    endsIn="1h 05m"
                    genre="Electronic"
                  />
                  <BattleCard
                    id="battle-4"
                    title="San Diego Sessions"
                    track1={{
                      artist: "Wave Rider",
                      cover: "/summer-music-album-cover.png",
                      title: "Coastal Vibes",
                      votes: 634,
                    }}
                    track2={{
                      artist: "Pacific Sound",
                      cover: "/night-music-album-cover.png",
                      title: "Sunset Strip",
                      votes: 578,
                    }}
                    endsIn="3h 45m"
                    genre="Pop"
                  />
                </div>
              </div>
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
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
                <div className="flex gap-3 md:gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 min-w-max md:min-w-0">
                  <TrackCard
                    id="track-1"
                    title="Summer Nights"
                    artist="Luna Eclipse"
                    artistSlug="luna-eclipse"
                    cover="/summer-music-album-cover.png"
                    plays="2.4M"
                    duration="3:24"
                  />
                  <TrackCard
                    id="track-2"
                    title="Midnight Dreams"
                    artist="Neon Pulse"
                    artistSlug="neon-pulse"
                    cover="/night-music-album-cover.png"
                    plays="1.8M"
                    duration="4:12"
                  />
                  <TrackCard
                    id="track-3"
                    title="Urban Legends"
                    artist="Street Poet"
                    artistSlug="street-poet"
                    cover="/hip-hop-album-cover.png"
                    plays="3.1M"
                    duration="3:45"
                  />
                  <TrackCard
                    id="track-4"
                    title="Electric Soul"
                    artist="Voltage Dreams"
                    artistSlug="voltage-dreams"
                    cover="/summer-music-album-cover.png"
                    plays="1.2M"
                    duration="3:56"
                  />
                  <TrackCard
                    id="track-5"
                    title="City Lights"
                    artist="Metro Flow"
                    artistSlug="metro-flow"
                    cover="/night-music-album-cover.png"
                    plays="2.7M"
                    duration="3:18"
                  />
                  <TrackCard
                    id="track-6"
                    title="Wave Rider"
                    artist="Ocean Drive"
                    artistSlug="ocean-drive"
                    cover="/hip-hop-album-cover.png"
                    plays="1.5M"
                    duration="4:02"
                  />
                </div>
              </div>
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
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
                <div className="flex gap-3 md:gap-4 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 min-w-max md:min-w-0">
                  <TrackCard
                    id="new-1"
                    title="Breakthrough"
                    artist="Rising Phoenix"
                    artistSlug="rising-phoenix"
                    cover="/hip-hop-album-cover.png"
                    plays="45K"
                    duration="3:32"
                  />
                  <TrackCard
                    id="new-2"
                    title="First Light"
                    artist="Dawn Chorus"
                    artistSlug="dawn-chorus"
                    cover="/summer-music-album-cover.png"
                    plays="67K"
                    duration="3:15"
                  />
                  <TrackCard
                    id="new-3"
                    title="New Wave"
                    artist="Fresh Sound"
                    artistSlug="fresh-sound"
                    cover="/night-music-album-cover.png"
                    plays="89K"
                    duration="4:05"
                  />
                  <TrackCard
                    id="new-4"
                    title="Debut Single"
                    artist="Rookie Star"
                    artistSlug="rookie-star"
                    cover="/hip-hop-album-cover.png"
                    plays="34K"
                    duration="3:48"
                  />
                  <TrackCard
                    id="new-5"
                    title="Fresh Start"
                    artist="New Day"
                    artistSlug="new-day"
                    cover="/summer-music-album-cover.png"
                    plays="52K"
                    duration="3:22"
                  />
                  <TrackCard
                    id="new-6"
                    title="Next Level"
                    artist="Elevate"
                    artistSlug="elevate"
                    cover="/night-music-album-cover.png"
                    plays="71K"
                    duration="3:55"
                  />
                </div>
              </div>
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
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-4">
                <div className="flex gap-3 md:gap-4 min-w-max">
                  {[
                    [
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "R&B/Soul",
                        location: activeRegion,
                        name: "Luna Eclipse",
                        rank: 1,
                        slug: "luna-eclipse",
                        stats: { followers: "124K", plays: "2.4M" },
                        verified: true,
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Electronic",
                        location: activeRegion,
                        name: "Neon Pulse",
                        rank: 2,
                        slug: "neon-pulse",
                        stats: { followers: "89K", plays: "1.8M" },
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Hip-Hop",
                        location: activeRegion,
                        name: "Street Poet",
                        rank: 3,
                        slug: "street-poet",
                        stats: { followers: "256K", plays: "3.1M" },
                        verified: true,
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Synthwave",
                        location: activeRegion,
                        name: "Voltage Dreams",
                        rank: 4,
                        slug: "voltage-dreams",
                        stats: { followers: "67K", plays: "1.2M" },
                      },
                    ],
                    [
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Hip-Hop",
                        location: activeRegion,
                        name: "Metro Flow",
                        rank: 5,
                        slug: "metro-flow",
                        stats: { followers: "198K", plays: "2.7M" },
                        verified: true,
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Pop",
                        location: activeRegion,
                        name: "Ocean Drive",
                        rank: 6,
                        slug: "ocean-drive",
                        stats: { followers: "145K", plays: "1.5M" },
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Indie",
                        location: activeRegion,
                        name: "Sunset Vibes",
                        rank: 7,
                        slug: "sunset-vibes",
                        stats: { followers: "78K", plays: "980K" },
                      },
                      {
                        avatar: "/diverse-user-avatars.png",
                        genre: "Electronic",
                        location: activeRegion,
                        name: "Bass Drop",
                        rank: 8,
                        slug: "bass-drop",
                        stats: { followers: "112K", plays: "1.6M" },
                      },
                    ],
                  ].map((artists, index) => (
                    <div
                      key={index}
                      className="w-[320px] md:w-[360px] flex-shrink-0"
                    >
                      <ArtistLeaderboardCard
                        artists={artists}
                        type="rising"
                        showBorder={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
