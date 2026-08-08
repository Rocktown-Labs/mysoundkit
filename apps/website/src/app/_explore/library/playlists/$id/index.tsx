import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Music2, Play, MoreVertical, Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  useAddPlaylistTrackMutation,
  useLibraryRecentQuery,
  useLibrarySavedQuery,
  useLibraryWatchedQuery,
  usePlaylistQuery,
  useRemovePlaylistTrackMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/playlists/$id/")({
  component: PlaylistDetailPage,
});

function PlaylistDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [addSongOpen, setAddSongOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("search");

  const { data: playlistData, isLoading } = usePlaylistQuery(id);
  const { data: publicTracks = [] } = useTracksQuery();
  const { data: savedTracks = [] } = useLibrarySavedQuery();
  const { data: recentPlays = [] } = useLibraryRecentQuery();
  const { data: watchedHistory = [] } = useLibraryWatchedQuery();

  const addTrackMutation = useAddPlaylistTrackMutation();
  const removeTrackMutation = useRemovePlaylistTrackMutation();

  const playlist = playlistData?.playlist;
  const currentTracks = playlistData?.tracks ?? [];

  const handleAddSong = async (track: { id: string; title: string }) => {
    try {
      await addTrackMutation.mutateAsync({ playlistId: id, trackId: track.id });
      toast({
        description: `Added "${track.title}" to playlist.`,
        title: "Track Added",
      });
    } catch {
      toast({
        description: "Could not add track to playlist.",
        title: "Error",
        variant: "destructive",
      });
    }
  };

  const filteredSearchTracks = publicTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artistName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formattedSavedTracks = savedTracks.map((t) => ({
    artist: t.artist,
    cover: t.cover,
    id: t.id,
    title: t.title,
  }));

  const formattedRecentTracks = recentPlays.map((r) => ({
    artist: r.artist,
    cover: r.cover,
    id: r.id,
    title: r.title,
  }));

  const formattedWatchedTracks = watchedHistory.map((w) => ({
    artist: w.creatorName ?? "Creator",
    cover: w.thumbnailUrl ?? "/placeholder.svg",
    id: w.id,
    title: w.title,
  }));

  const renderTrackSelectorList = (
    list: { artist: string; cover: string; id: string; title: string }[]
  ) => (
    <ScrollArea className="h-[280px] rounded-md border p-4">
      <div className="space-y-2">
        {list.map((song) => {
          const isAlreadyInPlaylist = currentTracks.some((t) => t.id === song.id);
          return (
            <div
              key={song.id}
              className="flex items-center gap-3 p-2 hover:bg-accent rounded-lg transition-colors"
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
                <p className="font-medium truncate text-sm">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist}
                </p>
              </div>
              <Button
                size="sm"
                variant={isAlreadyInPlaylist ? "ghost" : "outline"}
                disabled={isAlreadyInPlaylist || addTrackMutation.isPending}
                onClick={() => handleAddSong(song)}
              >
                {isAlreadyInPlaylist ? "Added" : "Add"}
              </Button>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No songs found in this category
          </p>
        )}
      </div>
    </ScrollArea>
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
        <div className="relative size-36 md:size-48 flex-shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border/40">
          <Music2 className="size-16 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
            Playlist
          </p>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 truncate">
            {playlist?.title ?? (isLoading ? "Loading..." : "Playlist")}
          </h1>
          <p className="text-muted-foreground text-sm mb-4">
            {playlist?.description || "No description provided."} •{" "}
            {currentTracks.length} tracks
          </p>
          <div className="flex items-center gap-3">
            <Button size="default" disabled={currentTracks.length === 0}>
              <Play className="mr-2 h-4 w-4 fill-current" />
              Play All
            </Button>
            <Button
              size="default"
              variant="outline"
              onClick={() => setAddSongOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Songs
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={currentTracks.map((t) => ({
          addedAt: "Recently",
          artist: t.artist,
          artistSlug: t.artistSlug,
          cover: t.cover,
          duration: t.duration,
          id: t.id,
          title: t.title,
        }))}
        onAddSong={() => setAddSongOpen(true)}
      />

      <Dialog open={addSongOpen} onOpenChange={setAddSongOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Song to Playlist</DialogTitle>
            <DialogDescription>
              Search songs in the catalog or pull directly from your saved & recently played tracks.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="search">Search DB</TabsTrigger>
              <TabsTrigger value="saved">Saved ({savedTracks.length})</TabsTrigger>
              <TabsTrigger value="recent">Recent ({recentPlays.length})</TabsTrigger>
              <TabsTrigger value="watched">Watched ({watchedHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4">
              <Input
                placeholder="Search catalog by title or artist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {renderTrackSelectorList(
                filteredSearchTracks.map((t) => ({
                  artist: t.artistName,
                  cover: t.coverArtUrl ?? "/placeholder.svg",
                  id: t.id,
                  title: t.title,
                }))
              )}
            </TabsContent>

            <TabsContent value="saved">
              {renderTrackSelectorList(formattedSavedTracks)}
            </TabsContent>

            <TabsContent value="recent">
              {renderTrackSelectorList(formattedRecentTracks)}
            </TabsContent>

            <TabsContent value="watched">
              {renderTrackSelectorList(formattedWatchedTracks)}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
