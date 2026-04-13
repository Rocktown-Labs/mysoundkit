import { ShoppingBag, ArrowLeft } from "lucide-react"
import { columns, type PurchasedTrack } from "./-columns"
import { DataTable } from "./-data-table"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const purchasedTracks: PurchasedTrack[] = [
  {
    id: "1",
    title: "Midnight Vibes",
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:45",
    price: "$2.99",
    purchasedAt: "Jan 15, 2025",
    downloadUrl: "/downloads/midnight-vibes.mp3",
  },
  {
    id: "2",
    title: "Electric Dreams",
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:20",
    price: "$2.99",
    purchasedAt: "Jan 10, 2025",
    downloadUrl: "/downloads/electric-dreams.mp3",
  },
  {
    id: "3",
    title: "Street Poetry",
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:15",
    price: "$1.99",
    purchasedAt: "Jan 5, 2025",
    downloadUrl: "/downloads/street-poetry.mp3",
  },
  {
    id: "4",
    title: "Voltage",
    artist: "Voltage Dreams",
    artistSlug: "voltage-dreams",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:58",
    price: "$2.49",
    purchasedAt: "Dec 28, 2024",
    downloadUrl: "/downloads/voltage.mp3",
  },
]

export const Route = createFileRoute('/_explore/library/purchased/')({
  component: PurchasedPage,
})

function PurchasedPage() {
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
          <ShoppingBag className="size-8 text-primary" />
          Purchased Tracks
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">Your digital music collection</p>
      </div>

      <DataTable columns={columns} data={purchasedTracks} />
    </div>
  )
}
