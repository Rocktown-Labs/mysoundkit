import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

import { ArtistCard } from "@/components/explore/artist-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/artist/new")({
  component: NewArtistsPage,
});

function NewArtistsPage() {
  const router = useRouter();

  const artists = [
    {
      avatar: "/diverse-user-avatars.png",
      followers: "2.3K",
      genre: "Hip-Hop",
      joinedDays: 3,
      name: "Fresh Start",
      slug: "fresh-start",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "1.8K",
      genre: "Electronic",
      joinedDays: 5,
      name: "Rookie Beats",
      slug: "rookie-beats",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "3.1K",
      genre: "R&B",
      joinedDays: 2,
      name: "New Horizon",
      slug: "new-horizon",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "4.5K",
      genre: "Pop",
      joinedDays: 7,
      name: "First Verse",
      slug: "first-verse",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "2.9K",
      genre: "Afrobeats",
      joinedDays: 4,
      name: "Debut Sound",
      slug: "debut-sound",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "1.6K",
      genre: "Rock",
      joinedDays: 6,
      name: "Starting Line",
      slug: "starting-line",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "3.7K",
      genre: "Indie",
      joinedDays: 1,
      name: "New Wave",
      slug: "new-wave-artist",
    },
    {
      avatar: "/diverse-user-avatars.png",
      followers: "2.1K",
      genre: "Pop",
      joinedDays: 8,
      name: "Rookie Star",
      slug: "rookie-star",
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
          <Sparkles className="size-6 md:size-8 text-primary" />
          New Artists
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Fresh talent just joined the platform
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {artists.map((artist) => (
          <div key={artist.slug} className="relative">
            {artist.joinedDays <= 3 && (
              <Badge
                className="absolute -top-2 -right-2 z-10 text-xs"
                variant="default"
              >
                New
              </Badge>
            )}
            <ArtistCard
              slug={artist.slug}
              name={artist.name}
              avatar={artist.avatar}
              genre={artist.genre}
              followers={artist.followers}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
