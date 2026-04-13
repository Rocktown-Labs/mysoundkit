import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ArtistCard } from "@/components/explore/artist-card"

export const Route = createFileRoute('/_explore/artist/rising-stars')({
  component: RisingStarsPage,
})

function RisingStarsPage() {
  const router = useRouter()

  const artists = [
    {
      slug: "luna-eclipse",
      name: "Luna Eclipse",
      avatar: "/diverse-user-avatars.png",
      genre: "R&B/Soul",
      followers: "124K",
      verified: true,
    },
    {
      slug: "neon-pulse",
      name: "Neon Pulse",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "89K",
    },
    {
      slug: "street-poet",
      name: "Street Poet",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "256K",
      verified: true,
    },
    {
      slug: "voltage-dreams",
      name: "Voltage Dreams",
      avatar: "/diverse-user-avatars.png",
      genre: "Synthwave",
      followers: "67K",
    },
    {
      slug: "metro-flow",
      name: "Metro Flow",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "198K",
      verified: true,
    },
    { slug: "ocean-drive", name: "Ocean Drive", avatar: "/diverse-user-avatars.png", genre: "Pop", followers: "145K" },
    {
      slug: "cosmic-wave",
      name: "Cosmic Wave",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "103K",
    },
    { slug: "rhythm-soul", name: "Rhythm Soul", avatar: "/diverse-user-avatars.png", genre: "R&B", followers: "78K" },
    {
      slug: "beat-master",
      name: "Beat Master",
      avatar: "/diverse-user-avatars.png",
      genre: "Hip-Hop",
      followers: "156K",
      verified: true,
    },
    {
      slug: "sound-wave",
      name: "Sound Wave",
      avatar: "/diverse-user-avatars.png",
      genre: "Electronic",
      followers: "92K",
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
          <TrendingUp className="size-6 md:size-8 text-primary" />
          Rising Stars
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Artists on the rise with growing momentum</p>
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
