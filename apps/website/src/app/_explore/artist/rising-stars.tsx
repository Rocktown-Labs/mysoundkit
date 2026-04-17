import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, TrendingUp } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/artist/rising-stars")({
  component: RisingStarsPage,
});

function RisingStarsPage() {
  const router = useRouter();

  const artists = [
    {
      avatar: "/diverse-user-avatars.png",
      followers: "124K",
      genre: "R&B/Soul",
      name: "Luna Eclipse",
      slug: "luna-eclipse",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "89K",
      genre: "Electronic",
      name: "Neon Pulse",
      slug: "neon-pulse",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "256K",
      genre: "Hip-Hop",
      name: "Street Poet",
      slug: "street-poet",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "67K",
      genre: "Synthwave",
      name: "Voltage Dreams",
      slug: "voltage-dreams",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "198K",
      genre: "Hip-Hop",
      name: "Metro Flow",
      slug: "metro-flow",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "145K",
      genre: "Pop",
      name: "Ocean Drive",
      slug: "ocean-drive",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "103K",
      genre: "Electronic",
      name: "Cosmic Wave",
      slug: "cosmic-wave",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "78K",
      genre: "R&B",
      name: "Rhythm Soul",
      slug: "rhythm-soul",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "156K",
      genre: "Hip-Hop",
      name: "Beat Master",
      slug: "beat-master",
      verified: true,
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "92K",
      genre: "Electronic",
      name: "Sound Wave",
      slug: "sound-wave",
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
          <TrendingUp className="size-6 md:size-8 text-primary" />
          Rising Stars
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Artists on the rise with growing momentum
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
