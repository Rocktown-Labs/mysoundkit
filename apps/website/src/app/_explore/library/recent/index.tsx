import { Clock, ArrowLeft } from "lucide-react"
import { columns, type RecentTrack } from "./-columns"
import { DataTable } from "./-data-table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const recentTracks: RecentTrack[] = [
  {
    id: "1",
    title: "Midnight Vibes",
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:45",
    timesPlayed: 24,
    lastPlayed: "2 hours ago",
  },
  {
    id: "2",
    title: "Electric Dreams",
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:20",
    timesPlayed: 18,
    lastPlayed: "5 hours ago",
  },
  {
    id: "3",
    title: "Street Poetry",
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:15",
    timesPlayed: 32,
    lastPlayed: "Yesterday",
  },
  {
    id: "4",
    title: "Voltage",
    artist: "Voltage Dreams",
    artistSlug: "voltage-dreams",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:58",
    timesPlayed: 15,
    lastPlayed: "Yesterday",
  },
  {
    id: "5",
    title: "Metro Life",
    artist: "Metro Flow",
    artistSlug: "metro-flow",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:12",
    timesPlayed: 41,
    lastPlayed: "2 days ago",
  },
]

export const Route = createFileRoute('/_explore/library/recent/')({
  component: RecentlyPlayedPage,
})

function RecentlyPlayedPage() {
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
          <Clock className="size-8 text-primary" />
          Recently Played
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Your listening history</p>
      </div>

      <DataTable columns={columns} data={recentTracks} />
    </div>
  )
}
