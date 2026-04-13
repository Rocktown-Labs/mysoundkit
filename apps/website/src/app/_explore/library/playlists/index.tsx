import { Music, Plus, ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export const Route = createFileRoute('/_explore/library/playlists/')({
  component: PlaylistsPage,
})

function PlaylistsPage() {
  const [open, setOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState("")
  const [playlistDescription, setPlaylistDescription] = useState("")

  const playlists = [
    {
      id: "1",
      name: "My Favorites",
      trackCount: 42,
      description: "Your most played tracks",
    },
    {
      id: "2",
      name: "Workout Vibes",
      trackCount: 28,
      description: "High energy tracks",
    },
    {
      id: "3",
      name: "Chill Sessions",
      trackCount: 35,
      description: "Relax and unwind",
    },
  ]

  const handleCreatePlaylist = () => {
    // Handle playlist creation
    console.log("[v0] Creating playlist:", { playlistName, playlistDescription })
    setOpen(false)
    setPlaylistName("")
    setPlaylistDescription("")
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
            <Music className="size-8 text-primary" />
            My Playlists
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">Your curated collections</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              New Playlist
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Playlist</DialogTitle>
              <DialogDescription>
                Give your playlist a name and description. You can add songs after creating it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Playlist Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Summer Vibes 2025"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What's this playlist about?"
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlaylist} disabled={!playlistName.trim()}>
                Create Playlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map((playlist) => (
          <Link key={playlist.id} to={`/library/playlists/${playlist.id}`}>
            <Card className="group hover:bg-accent transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <Music className="size-10 text-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{playlist.trackCount} tracks</span>
                </div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                  {playlist.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{playlist.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
