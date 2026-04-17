import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Music2, Play, MoreVertical } from "lucide-react";
import { useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import { columns } from "./-columns";
import type { PlaylistTrack } from "./-columns";
import { DataTable } from "./-data-table";

const playlistTracks: PlaylistTrack[] = [
  {
    addedAt: "Jan 15, 2025",
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:45",
    id: "1",
    title: "Midnight Vibes",
  },
  {
    addedAt: "Jan 10, 2025",
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:20",
    id: "2",
    title: "Electric Dreams",
  },
  {
    addedAt: "Jan 5, 2025",
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:15",
    id: "3",
    title: "Street Poetry",
  },
];

// Mock available songs for adding to playlist
const availableSongs = [
  {
    artist: "Voltage Dreams",
    cover: "/placeholder.svg?height=80&width=80",
    id: "4",
    title: "Voltage",
  },
  {
    artist: "Metro Flow",
    cover: "/placeholder.svg?height=80&width=80",
    id: "5",
    title: "Metro Life",
  },
  {
    artist: "Synthwave City",
    cover: "/placeholder.svg?height=80&width=80",
    id: "6",
    title: "Neon Nights",
  },
];

export const Route = createFileRoute("/_explore/library/playlists/$id/")({
  component: PlaylistDetailPage,
});

function PlaylistDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [addSongOpen, setAddSongOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSongs = availableSongs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Playlists
      </Button>

      <div className="mb-8 flex items-start gap-6">
        <div className="relative size-48 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          <Music2 className="absolute inset-0 m-auto size-20 text-muted-foreground" />
        </div>

        <div className="flex-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
            Playlist
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            My Favorites
          </h1>
          <p className="text-muted-foreground mb-4">Your most played tracks</p>
          <div className="flex items-center gap-4">
            <Button size="lg">
              <Play className="mr-2 h-5 w-5 fill-current" />
              Play All
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" variant="outline">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Playlist</DropdownMenuItem>
                <DropdownMenuItem>Share Playlist</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Delete Playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={playlistTracks}
        onAddSong={() => setAddSongOpen(true)}
      />

      <Dialog open={addSongOpen} onOpenChange={setAddSongOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Song to Playlist</DialogTitle>
            <DialogDescription>
              Search and select songs to add to your playlist
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Search songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-2">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      console.log("[v0] Adding song to playlist:", song.id);
                      setAddSongOpen(false);
                    }}
                  >
                    <div className="relative size-12 flex-shrink-0">
                      <AppImage
                        src={song.cover || "/placeholder.svg"}
                        alt={song.title}
                        width={48}
                        height={48}
                        layout="fixed"
                        className="size-full rounded object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{song.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {song.artist}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Add
                    </Button>
                  </div>
                ))}
                {filteredSongs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No songs found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
