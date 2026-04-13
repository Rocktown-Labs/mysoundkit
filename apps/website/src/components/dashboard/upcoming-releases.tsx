import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppImage } from "@/components/ui/app-image"
import { Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const upcomingReleases = [
  {
    id: 1,
    title: "Midnight Dreams",
    type: "Album",
    releaseDate: "2025-01-15",
    daysUntil: 3,
    coverArt: "/summer-music-album-cover.png",
  },
  {
    id: 2,
    title: "Summer Vibes EP",
    type: "EP",
    releaseDate: "2025-01-22",
    daysUntil: 10,
    coverArt: "/night-music-album-cover.png",
  },
]

export function UpcomingReleases() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="size-5" />
          Upcoming Releases
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingReleases.map((release) => (
            <div
              key={release.id}
              className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <AppImage
                src={release.coverArt || "/placeholder.svg"}
                alt={release.title}
                width={64}
                height={64}
                layout="fixed"
                className="size-16 rounded-md object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{release.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {release.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(release.releaseDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{release.daysUntil} days</p>
                <p className="text-xs text-muted-foreground">until release</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
