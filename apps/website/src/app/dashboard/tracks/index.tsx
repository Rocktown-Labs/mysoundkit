import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Download, MoreVertical } from "lucide-react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const mockTracks = [
  {
    id: "1",
    name: "Summer Vibes",
    genre: "Hip-Hop",
    bpm: 140,
    key: "C Major",
    status: "complete",
    coverArt: "/summer-music-album-cover.png",
    files: {
      instrumental: true,
      vocals: 2,
      adlibs: true,
      session: true,
      reference: true,
    },
    collaborators: ["user@soundkit.app"],
    updatedAt: "2 hours ago",
  },
  {
    id: "2",
    name: "Night Drive",
    genre: "R&B",
    bpm: 85,
    key: "A Minor",
    status: "mixed",
    coverArt: "/night-music-album-cover.png",
    files: {
      instrumental: true,
      vocals: 3,
      adlibs: true,
      session: false,
      reference: true,
    },
    collaborators: ["user@soundkit.app", "collab@soundkit.app"],
    updatedAt: "1 day ago",
  },
  {
    id: "3",
    name: "City Lights",
    genre: "Pop",
    bpm: 128,
    key: "G Major",
    status: "demo",
    coverArt: "/hip-hop-album-cover.png",
    files: {
      instrumental: true,
      vocals: 1,
      adlibs: false,
      session: true,
      reference: false,
    },
    collaborators: ["user@soundkit.app"],
    updatedAt: "3 days ago",
  },
]

export const Route = createFileRoute('/dashboard/tracks/')({
  component: TracksPage,
})

function TracksPage() {
  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">Tracks</h1>
            <p className="text-muted-foreground">Manage your individual music tracks</p>
          </div>
          <Link to="/dashboard/tracks/new">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Track
            </Button>
          </Link>
        </div>

        {/* Track Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockTracks.map((track) => (
            <Card
              key={track.id}
              className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-12 h-12 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${track.coverArt})` }}
                    />
                    <div>
                      <h3 className="font-semibold">{track.name}</h3>
                      <p className="text-sm text-muted-foreground">{track.genre}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </DropdownMenuItem>
                      <DropdownMenuItem>Edit Track</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={track.status === "complete" ? "default" : "secondary"}
                      className={
                        track.status === "complete"
                          ? "bg-primary/20 text-primary"
                          : track.status === "mixed"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted"
                      }
                    >
                      {track.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">BPM</span>
                    <span>{track.bpm}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Key</span>
                    <span>{track.key}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{track.collaborators.length} collaborator(s)</span>
                    <span>{track.updatedAt}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    
  )
}
