import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Flame, MapPin } from "lucide-react";

import { TrackCard } from "@/components/explore/track-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/new-releases")({
  component: NewReleasesPage,
});

function NewReleasesPage() {
  const router = useRouter();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const location = searchParams.get("location") || "All Locations";

  const tracks = [
    {
      artist: "Rising Phoenix",
      artistSlug: "rising-phoenix",
      cover: "/hip-hop-album-cover.png",
      duration: "3:32",
      hoursAgo: 2,
      id: "new-1",
      plays: "45K",
      title: "Breakthrough",
    },
    {
      artist: "Dawn Chorus",
      artistSlug: "dawn-chorus",
      cover: "/summer-music-album-cover.png",
      duration: "3:15",
      hoursAgo: 5,
      id: "new-2",
      plays: "67K",
      title: "First Light",
    },
    {
      artist: "Fresh Sound",
      artistSlug: "fresh-sound",
      cover: "/night-music-album-cover.png",
      duration: "4:05",
      hoursAgo: 8,
      id: "new-3",
      plays: "89K",
      title: "New Wave",
    },
    {
      artist: "Rookie Star",
      artistSlug: "rookie-star",
      cover: "/hip-hop-album-cover.png",
      duration: "3:48",
      hoursAgo: 12,
      id: "new-4",
      plays: "34K",
      title: "Debut Single",
    },
    {
      artist: "New Day",
      artistSlug: "new-day",
      cover: "/summer-music-album-cover.png",
      duration: "3:22",
      hoursAgo: 18,
      id: "new-5",
      plays: "52K",
      title: "Fresh Start",
    },
    {
      artist: "Elevate",
      artistSlug: "elevate",
      cover: "/night-music-album-cover.png",
      duration: "3:55",
      hoursAgo: 24,
      id: "new-6",
      plays: "71K",
      title: "Next Level",
    },
    {
      artist: "Ocean Wave",
      artistSlug: "ocean-wave",
      cover: "/hip-hop-album-cover.png",
      duration: "3:28",
      hoursAgo: 36,
      id: "new-7",
      plays: "41K",
      title: "Rising Tide",
    },
    {
      artist: "Sky Walker",
      artistSlug: "sky-walker",
      cover: "/summer-music-album-cover.png",
      duration: "3:41",
      hoursAgo: 48,
      id: "new-8",
      plays: "58K",
      title: "New Horizon",
    },
  ];

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-2">
          <Flame className="size-6 md:size-8 text-primary" />
          New Releases
        </h1>
        <p className="text-muted-foreground text-sm md:text-base flex items-center gap-2">
          <MapPin className="size-4" />
          {location}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {tracks.map((track) => (
          <div key={track.id} className="relative">
            {track.hoursAgo <= 24 && (
              <Badge
                className="absolute -top-2 -right-2 z-10 text-xs"
                variant="default"
              >
                New
              </Badge>
            )}
            <TrackCard
              id={track.id}
              title={track.title}
              artist={track.artist}
              artistSlug={track.artistSlug}
              cover={track.cover}
              plays={track.plays}
              duration={track.duration}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
