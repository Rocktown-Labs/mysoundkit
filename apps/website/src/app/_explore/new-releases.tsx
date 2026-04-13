import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Flame, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TrackCard } from "@/components/explore/track-card"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute('/_explore/new-releases')({
  component: NewReleasesPage,
})

function NewReleasesPage() {
  const router = useRouter()
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "")
  const location = searchParams.get("location") || "All Locations"

  const tracks = [
    {
      id: "new-1",
      title: "Breakthrough",
      artist: "Rising Phoenix",
      artistSlug: "rising-phoenix",
      cover: "/hip-hop-album-cover.png",
      plays: "45K",
      duration: "3:32",
      hoursAgo: 2,
    },
    {
      id: "new-2",
      title: "First Light",
      artist: "Dawn Chorus",
      artistSlug: "dawn-chorus",
      cover: "/summer-music-album-cover.png",
      plays: "67K",
      duration: "3:15",
      hoursAgo: 5,
    },
    {
      id: "new-3",
      title: "New Wave",
      artist: "Fresh Sound",
      artistSlug: "fresh-sound",
      cover: "/night-music-album-cover.png",
      plays: "89K",
      duration: "4:05",
      hoursAgo: 8,
    },
    {
      id: "new-4",
      title: "Debut Single",
      artist: "Rookie Star",
      artistSlug: "rookie-star",
      cover: "/hip-hop-album-cover.png",
      plays: "34K",
      duration: "3:48",
      hoursAgo: 12,
    },
    {
      id: "new-5",
      title: "Fresh Start",
      artist: "New Day",
      artistSlug: "new-day",
      cover: "/summer-music-album-cover.png",
      plays: "52K",
      duration: "3:22",
      hoursAgo: 18,
    },
    {
      id: "new-6",
      title: "Next Level",
      artist: "Elevate",
      artistSlug: "elevate",
      cover: "/night-music-album-cover.png",
      plays: "71K",
      duration: "3:55",
      hoursAgo: 24,
    },
    {
      id: "new-7",
      title: "Rising Tide",
      artist: "Ocean Wave",
      artistSlug: "ocean-wave",
      cover: "/hip-hop-album-cover.png",
      plays: "41K",
      duration: "3:28",
      hoursAgo: 36,
    },
    {
      id: "new-8",
      title: "New Horizon",
      artist: "Sky Walker",
      artistSlug: "sky-walker",
      cover: "/summer-music-album-cover.png",
      plays: "58K",
      duration: "3:41",
      hoursAgo: 48,
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
              <Badge className="absolute -top-2 -right-2 z-10 text-xs" variant="default">
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
  )
}
