
import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "@/components/ui/card"
import { AppImage } from "@/components/ui/app-image"
import { Play, Clock } from "lucide-react"

interface TrackCardProps {
  id: string
  title: string
  artist: string
  artistSlug: string
  cover: string
  plays: string
  duration: string
}

export function TrackCard({ id, title, artist, artistSlug, cover, plays, duration }: TrackCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all group w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] xl:w-[220px] flex-shrink-0 p-0">
      <CardContent className="p-0 space-y-0">
        <Link to={`/tracks/${id}`} className="block">
          <div className="relative aspect-square overflow-hidden">
            <AppImage
              src={cover || "/placeholder.svg"}
              alt={title}
              width={440}
              height={440}
              layout="constrained"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="size-10 md:size-12 rounded-full bg-primary flex items-center justify-center">
                <Play className="size-5 md:size-6 fill-primary-foreground text-primary-foreground ml-0.5" />
              </div>
            </div>
          </div>
        </Link>
        <div className="p-2 md:p-3">
          <Link to={`/tracks/${id}`}>
            <h3 className="font-medium text-xs md:text-sm truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
          </Link>
          <Link
            href={`/artist/${artistSlug}`}
            className="text-[10px] md:text-xs text-muted-foreground hover:text-primary truncate block"
          >
            {artist}
          </Link>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] md:text-xs text-muted-foreground">
            <Clock className="size-2.5 md:size-3" />
            <span>{duration}</span>
            <span className="mx-1">•</span>
            <span>{plays} plays</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
