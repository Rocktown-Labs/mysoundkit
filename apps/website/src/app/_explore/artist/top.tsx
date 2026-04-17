import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Trophy } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/artist/top")({
  component: TopArtistsPage,
});

function TopArtistsPage() {
  const router = useRouter();

  const artists = [
    {
      avatar: "/diverse-user-avatars.png",
      followers: "312K",
      genre: "Electronic",
      name: "Cosmic Sound",
      slug: "cosmic-sound",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "278K",
      genre: "R&B",
      name: "Soul Sister",
      slug: "soul-sister",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "445K",
      genre: "Hip-Hop",
      name: "Beat Maker",
      slug: "beat-maker",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "523K",
      genre: "Pop",
      name: "Melody Queen",
      slug: "melody-queen",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "189K",
      genre: "Afrobeats",
      name: "Rhythm King",
      slug: "rhythm-king",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "234K",
      genre: "Electronic",
      name: "Sound Wave",
      slug: "sound-wave",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "398K",
      genre: "Hip-Hop",
      name: "Street Legend",
      slug: "street-legend",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "267K",
      genre: "R&B",
      name: "Vocal Master",
      slug: "vocal-master",
      verified: true,
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
          <Trophy className="size-6 md:size-8 text-primary" />
          Top Artists This Month
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Most popular artists right now
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {artists.map((artist) => (
          <ArtistCard
            key={artist.slug}
            slug={artist.slug}
            name={artist.name}
            avatar={artist.avatar}
            genre={artist.genre}
            followers={artist.followers}
            verified={artist.verified}
          />
        ))}
      </div>
    </div>
  );
}
