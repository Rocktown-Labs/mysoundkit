import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Music, Plus, ArrowLeft } from "lucide-react";
import { useState } from "react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  useCreatePlaylistMutation,
  useLibraryPlaylistsQuery,
  useMeQuery,
} from "@/lib/soundkit-api-hooks";

import { columns } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/playlists/")({
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const { data: me } = useMeQuery();
  const { data: playlists = [], isLoading } = useLibraryPlaylistsQuery();
  const createPlaylistMutation = useCreatePlaylistMutation();
  const isSignedIn = Boolean(me?.user);
  const tableData = playlists.map((playlist) => ({
    description: playlist.description ?? "No description",
    id: playlist.id,
    name: playlist.title,
    trackCount: playlist.trackCount,
  }));

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) return;
    try {
      const playlist = await createPlaylistMutation.mutateAsync({
        description: playlistDescription,
        title: playlistName,
      });
      setOpen(false);
      setPlaylistName("");
      setPlaylistDescription("");
      toast({
        description: `Created playlist "${playlist.title}".`,
        title: "Playlist Created",
      });
      navigate({
        params: { id: playlist.id },
        to: "/library/playlists/$id",
      });
    } catch {
      toast({
        description: "Could not create playlist. Please try again.",
        title: "Error creating playlist",
        variant: "destructive",
      });
    }
  };

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
          <p className="text-muted-foreground text-sm md:text-base">
            Your curated collections
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          {isSignedIn ? (
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 size-4" />
                New Playlist
              </Button>
            </DialogTrigger>
          ) : (
            <Button asChild>
              <Link to="/login">Log In</Link>
            </Button>
          )}
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Playlist</DialogTitle>
              <DialogDescription>
                Give your playlist a name and description. You can add songs
                after creating it.
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
              <Button
                onClick={handleCreatePlaylist}
                disabled={!playlistName.trim()}
              >
                Create Playlist
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading || tableData.length > 0 ? (
        <DataTable
          columns={columns}
          data={tableData}
          filterPlaceholder="Search playlists..."
        />
      ) : (
        <LibraryEmptyState
          actionHref={isSignedIn ? "/tracks" : "/login"}
          actionLabel={isSignedIn ? "Browse Songs" : "Log In"}
          description={
            isSignedIn
              ? "Create playlists as you discover songs you want to keep together."
              : "Log in to create playlists and keep your SoundKit collection synced."
          }
          icon={Music}
          secondaryHref={isSignedIn ? undefined : "/signup"}
          secondaryLabel={isSignedIn ? undefined : "Create Account"}
          title={isSignedIn ? "No playlists yet" : "Log in to manage playlists"}
        />
      )}
    </div>
  );
}
