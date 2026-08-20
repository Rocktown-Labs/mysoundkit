import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";
import { useGenresQuery } from "@/lib/soundkit-api-hooks";

interface GenreSummary {
  id: string;
  name: string;
  slug: string;
  totalCount?: number;
  trackCount?: number;
}

const genreEmoji: Record<string, string> = {
    afrobeats: "🥁",
    country: "🤠",
    electronic: "🎹",
    "hip-hop": "🎤",
    indie: "🎧",
    jazz: "🎺",
    latin: "💃",
    metal: "🤘",
    pop: "⭐",
    "rb-soul": "🎵",
    reggae: "🌴",
    rock: "🎸",
    "spoken-word": "🎙️",
  },
  formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}K`;
    }

    return count.toLocaleString();
  },
  genreActivityLabel = (genre: GenreSummary) => {
    const total = genre.totalCount ?? genre.trackCount ?? 0,
      noun = total === 1 ? "live item" : "live items";

    return `${formatCount(total)} ${noun}`;
  };

export const Route = createFileRoute("/_explore/genres/")({
  component: GenresPage,
});

function GenresPage() {
  const genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [];

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
          <Link
            key={genre.id}
            params={{ id: genre.slug }}
            search={{
              region: undefined,
              regionType: "north-america",
              sort: undefined,
            }}
            to="/genres/$id"
          >
            <Card className="group hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center gap-2 md:gap-3 h-full">
                <div className="text-4xl md:text-5xl mb-1">
                  {genreEmoji[genre.slug] ?? "🎵"}
                </div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors">
                    {genre.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {genreActivityLabel(genre)}
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
