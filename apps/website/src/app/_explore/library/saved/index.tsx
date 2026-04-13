import { Heart, ArrowLeft } from "lucide-react"
import { columns, type SavedTrack } from "./-columns"
import { DataTable } from "./-data-table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const savedTracks: SavedTrack[] = [
  {
    id: "1",
    title: "Midnight Vibes",
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:45",
    genre: "Electronic",
    savedAt: "Jan 15, 2025",
  },
  {
    id: "2",
    title: "Electric Dreams",
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:20",
    genre: "Electronic",
    savedAt: "Jan 8, 2025",
  },
  {
    id: "3",
    title: "Street Poetry",
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:15",
    genre: "Hip-Hop",
    savedAt: "Jan 1, 2025",
  },
  {
    id: "4",
    title: "Voltage",
    artist: "Voltage Dreams",
    artistSlug: "voltage-dreams",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:58",
    genre: "Electronic",
    savedAt: "Dec 28, 2024",
  },
  {
    id: "5",
    title: "Metro Life",
    artist: "Metro Flow",
    artistSlug: "metro-flow",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:12",
    genre: "Hip-Hop",
    savedAt: "Dec 20, 2024",
  },
]

export const Route = createFileRoute('/_explore/library/saved/')({
  component: SavedTracksPage,
})

function SavedTracksPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Heart className="size-8 text-primary fill-primary" />
          Saved Tracks
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Tracks you've bookmarked</p>
      </div>

      <DataTable columns={columns} data={savedTracks} />
    </div>
  )
}
