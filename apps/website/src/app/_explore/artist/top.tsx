import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtistCard } from "@/components/explore/artist-card"

export const Route = createFileRoute('/_explore/artist/top')({
  component: TopArtistsPage,
})

function TopArtistsPage() {
  const router = useRouter()

  const artists = [
    {
      slug: "cosmic-sound",
      name: "Cosmic Sound",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "312K",
      verified: true,
    },
    {
      slug: "soul-sister",
      name: "Soul Sister",
      avatar: "/diverse-user-avatars.png",
      genre: "R&B",
      followers: "278K",
      verified: true,
    },
    {
      slug: "beat-maker",
      name: "Beat Maker",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "445K",
      verified: true,
    },
    {
      slug: "melody-queen",
      name: "Melody Queen",
      avatar: "/diverse-user-avatars.png",
      genre: "Pop",
      followers: "523K",
      verified: true,
    },
    {
      slug: "rhythm-king",
      name: "Rhythm King",
      avatar: "/diverse-user-avatars.png",
      genre: "Afrobeats",
      followers: "189K",
    },
    {
      slug: "sound-wave",
      name: "Sound Wave",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "234K",
      verified: true,
    },
    {
      slug: "street-legend",
      name: "Street Legend",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "398K",
      verified: true,
    },
    {
      slug: "vocal-master",
      name: "Vocal Master",
      avatar: "/diverse-user-avatars.png",
      genre: "R&B",
      followers: "267K",
      verified: true,
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
          <Trophy className="size-6 md:size-8 text-primary" />
          Top Artists This Month
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Most popular artists right now</p>
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
  )
}
