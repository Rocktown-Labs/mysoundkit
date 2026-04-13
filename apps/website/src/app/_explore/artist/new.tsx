import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtistCard } from "@/components/explore/artist-card"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute('/_explore/artist/new')({
  component: NewArtistsPage,
})

function NewArtistsPage() {
  const router = useRouter()

  const artists = [
    {
      slug: "fresh-start",
      name: "Fresh Start",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "2.3K",
      joinedDays: 3,
    },
    {
      slug: "rookie-beats",
      name: "Rookie Beats",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "1.8K",
      joinedDays: 5,
    },
    {
      slug: "new-horizon",
      name: "New Horizon",
      avatar: "/diverse-user-avatars.png",
      genre: "R&B",
      followers: "3.1K",
      joinedDays: 2,
    },
    {
      slug: "first-verse",
      name: "First Verse",
      avatar: "/diverse-user-avatars.png",
      genre: "Pop",
      followers: "4.5K",
      joinedDays: 7,
    },
    {
      slug: "debut-sound",
      name: "Debut Sound",
      avatar: "/diverse-user-avatars.png",
      genre: "Afrobeats",
      followers: "2.9K",
      joinedDays: 4,
    },
    {
      slug: "starting-line",
      name: "Starting Line",
      avatar: "/diverse-user-avatars.png",
      genre: "Rock",
      followers: "1.6K",
      joinedDays: 6,
    },
    {
      slug: "new-wave-artist",
      name: "New Wave",
      avatar: "/diverse-user-avatars.png",
      genre: "Indie",
      followers: "3.7K",
      joinedDays: 1,
    },
    {
      slug: "rookie-star",
      name: "Rookie Star",
      avatar: "/diverse-user-avatars.png",
      genre: "Pop",
      followers: "2.1K",
      joinedDays: 8,
    },
  ]

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="mb-4">
        <ArrowLeft className="size-4 mr-2" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="size-6 md:size-8 text-primary" />
          New Artists
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Fresh talent just joined the platform</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
        {artists.map((artist) => (
          <div key={artist.slug} className="relative">
            {artist.joinedDays <= 3 && (
              <Badge className="absolute -top-2 -right-2 z-10 text-xs" variant="default">
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
  )
}
