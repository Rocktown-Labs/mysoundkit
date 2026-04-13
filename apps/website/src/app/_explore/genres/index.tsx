import { Card, CardContent } from "@/components/ui/card"
import { createFileRoute, Link } from "@tanstack/react-router"

const genres = [
  { id: "hip-hop", name: "Hip-Hop", emoji: "🎤", count: "2.5K" },
  { id: "rb-soul", name: "R&B/Soul", emoji: "🎵", count: "1.8K" },
  { id: "electronic", name: "Electronic", emoji: "🎹", count: "1.2K" },
  { id: "pop", name: "Pop", emoji: "⭐", count: "3.1K" },
  { id: "rock", name: "Rock", emoji: "🎸", count: "1.5K" },
  { id: "jazz", name: "Jazz", emoji: "🎺", count: "892" },
  { id: "afrobeats", name: "Afrobeats", emoji: "🥁", count: "1.4K" },
  { id: "latin", name: "Latin", emoji: "💃", count: "1.1K" },
  { id: "country", name: "Country", emoji: "🤠", count: "956" },
  { id: "reggae", name: "Reggae", emoji: "🌴", count: "743" },
  { id: "indie", name: "Indie", emoji: "🎧", count: "2.2K" },
  { id: "metal", name: "Metal", emoji: "🤘", count: "876" },
]

export const Route = createFileRoute('/_explore/genres/')({
  component: GenresPage,
})

function GenresPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">Browse Genres</h1>
        <p className="text-muted-foreground text-sm md:text-base">Explore music by genre</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {genres.map((genre) => (
          <Link key={genre.id} to={`/genres/${genre.id}`}>
            <Card className="group hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="p-4 md:p-6 flex flex-col items-center justify-center text-center gap-2 md:gap-3 h-full">
                <div className="text-4xl md:text-5xl mb-1">{genre.emoji}</div>
                <div>
                  <h3 className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors">
                    {genre.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{genre.count} tracks</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
