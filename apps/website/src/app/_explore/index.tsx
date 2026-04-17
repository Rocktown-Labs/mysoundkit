import { createFileRoute } from "@tanstack/react-router";
import { Flame, LocateFixed, Music, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { ArtistLeaderboardCard } from "@/components/explore/artist-leaderboard-card";
import { BattleCard } from "@/components/explore/battle-card";
import { SectionHeader } from "@/components/explore/section-header";
import { TrackCard } from "@/components/explore/track-card";
import { USAMap } from "@/components/explore/usa-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_explore/")({
  component: ExplorePage,
});

function ExplorePage() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationPromptState, setLocationPromptState] = useState<
    "idle" | "prompting" | "granted" | "denied" | "unsupported"
  >("idle");

  const activeRegion = selectedState ?? "USA";
  const isNationalView = selectedState === null;
  const battlesHref = selectedState
    ? `/live?location=${selectedState}`
    : "/battles";
  const tracksHref = selectedState
    ? `/tracks?location=${selectedState}`
    : "/tracks";
  const releasesHref = selectedState
    ? `/new-releases?location=${selectedState}`
    : "/new-releases";
  const artistsHref = selectedState
    ? `/artist?location=${selectedState}`
    : "/artist";

  const requestLocation = () => {
    setIsLoadingLocation(true);

    try {
      if (!("geolocation" in navigator)) {
        setLocationPromptState("unsupported");
        setUserLocation(null);
        setSelectedState(null);
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
            const detectedState = data.principalSubdivision || "California";
            setUserLocation(detectedState);
            setSelectedState(detectedState);
          } catch {
            setUserLocation("California");
            setSelectedState("California");
          }

          setLocationPromptState("granted");
          setIsLoadingLocation(false);
        },
        () => {
          setLocationPromptState("denied");
          setUserLocation(null);
          setSelectedState(null);
          setIsLoadingLocation(false);
        }
      );
    } catch {
      setLocationPromptState("denied");
      setUserLocation(null);
      setSelectedState(null);
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="lg:flex">
        <main className="flex-1">
          <section className="mb-6 md:mb-8">
            <div className="mb-4 md:mb-6">
              <h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 md:mb-2">
                Discover Music Near You
              </h1>
              <p className="text-muted-foreground text-xs md:text-sm lg:text-base">
                {isLoadingLocation
                  ? "Requesting your location so we can localize the feed."
                  : selectedState
                    ? `Currently focused on ${selectedState}. Click another state to refine the feed.`
                    : userLocation
                      ? `Showing top picks across the USA. We detected ${userLocation} if you want to zoom in.`
                      : "Showing top picks across the USA. Share your location or click a state on the map to zoom in."}
              </p>
            </div>

            {locationPromptState !== "granted" && (
              <Card className="mb-4 md:mb-6 border-primary/20 bg-card/60">
                <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {locationPromptState === "prompting"
                        ? "Location access is being requested."
                        : locationPromptState === "denied"
                          ? "Location access is off for SoundKit."
                          : locationPromptState === "unsupported"
                            ? "This browser does not support location access."
                            : "Use your location to personalize the home feed."}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {locationPromptState === "denied"
                        ? "You can still browse the USA-wide feed, or enable location and try again."
                        : "We will ask for your location on this page so we can jump straight to your state."}
                    </p>
                  </div>
                  {locationPromptState !== "unsupported" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 self-start md:self-center"
                      onClick={requestLocation}
                      disabled={isLoadingLocation}
                    >
                      <LocateFixed className="size-4" />
                      {locationPromptState === "denied"
                        ? "Try location again"
                        : "Use my location"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardContent className="p-2 md:p-4 lg:p-6">
                <div className="w-full h-[250px] sm:h-[350px] md:h-[450px] lg:h-[500px]">
                  <USAMap
                    selectedState={selectedState}
                    onStateSelect={setSelectedState}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="space-y-6 md:space-y-8 lg:space-y-10 pb-8 md:pb-10 lg:pb-12">
            <section>
              <SectionHeader
                title={
                  isNationalView
                    ? "Live Battles Across the USA"
                    : `Live Battles in ${activeRegion}`
                }
                description={
                  isNationalView
                    ? "Top national battles happening right now"
                    : "Vote for your favorite tracks"
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
                  isNationalView
                    ? "Top Songs in the USA"
                    : `Top Songs in ${activeRegion}`
                }
                description={
                  isNationalView
                    ? "Most played tracks nationwide this week"
                    : "Most played tracks this week"
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
                  isNationalView
                    ? "New Releases Across the USA"
                    : `New Releases in ${activeRegion}`
                }
                description={
                  isNationalView
                    ? "Fresh drops from artists around the country"
                    : "Fresh tracks from local artists"
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
                  isNationalView
                    ? "Top Artists in the USA"
                    : `Top Artists in ${activeRegion}`
                }
                description={
                  isNationalView
                    ? "Rising stars and established artists nationwide"
                    : "Rising stars from your region"
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
