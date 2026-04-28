import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

const genres = [
  { count: "2.5K", emoji: "🎤", id: "hip-hop", name: "Hip-Hop" },
  { count: "1.8K", emoji: "🎵", id: "rb-soul", name: "R&B/Soul" },
  { count: "1.2K", emoji: "🎹", id: "electronic", name: "Electronic" },
  { count: "3.1K", emoji: "⭐", id: "pop", name: "Pop" },
  { count: "1.5K", emoji: "🎸", id: "rock", name: "Rock" },
  { count: "892", emoji: "🎺", id: "jazz", name: "Jazz" },
  { count: "1.4K", emoji: "🥁", id: "afrobeats", name: "Afrobeats" },
  { count: "1.1K", emoji: "💃", id: "latin", name: "Latin" },
  { count: "956", emoji: "🤠", id: "country", name: "Country" },
  { count: "743", emoji: "🌴", id: "reggae", name: "Reggae" },
  { count: "2.2K", emoji: "🎧", id: "indie", name: "Indie" },
  { count: "876", emoji: "🤘", id: "metal", name: "Metal" },
];

export const Route = createFileRoute("/_explore/genres/")({
  component: GenresPage,
});

function GenresPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
          Browse Genres
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Explore music by genre
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {genres.map((genre) => (
          <Link key={genre.id} to="/genres/$id" params={{ id: genre.id }}>
            <Card className="group hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center gap-2 md:gap-3 h-full">
                <div className="text-4xl md:text-5xl mb-1">{genre.emoji}</div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors">
                    {genre.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {genre.count} tracks
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
