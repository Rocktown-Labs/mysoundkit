import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Music, Plus, ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { LibraryEmptyState } from "@/components/explore/library-empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  useDbPlaylistActions,
  useDbPlaylists,
} from "@/lib/data-db";
import { useMeQuery } from "@/lib/soundkit-api-hooks";

import { createPlaylistColumns } from "./-columns";
import type { Playlist } from "./-columns";
import { DataTable } from "./-data-table";

export const Route = createFileRoute("/_explore/library/playlists/")({
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const navigate = useNavigate(),
    router = useRouter(),
    { toast } = useToast(),
    [open, setOpen] = useState(false),
    [deleteCandidate, setDeleteCandidate] = useState<Playlist | null>(null),
    [deleteConfirmation, setDeleteConfirmation] = useState(""),
    [isDeleting, setIsDeleting] = useState(false),
    [playlistName, setPlaylistName] = useState(""),
    [playlistDescription, setPlaylistDescription] = useState(""),
    { data: me } = useMeQuery(),
    { data: playlists = [], isLoading } = useDbPlaylists(),
    { create, deletePlaylist } = useDbPlaylistActions(),
    isSignedIn = Boolean(me?.user),
    tableData = playlists.map((playlist) => ({
      description: playlist.description ?? "No description",
      id: playlist.id,
      name: playlist.title,
      trackCount: playlist.trackCount,
    })),
    handleCreatePlaylist = async () => {
      if (!playlistName.trim()) {
        return;
      }
      try {
        const playlistInput = {
            description: playlistDescription,
            title: playlistName,
          },
          { id, transaction } = create(playlistInput);
        await transaction.isPersisted.promise;
        setOpen(false);
        setPlaylistName("");
        setPlaylistDescription("");
        toast({
          description: `Created playlist "${playlistInput.title}".`,
          title: "Playlist Created",
        });
        await router.invalidate();
        navigate({
          params: { id },
          to: "/library/playlists/$id",
        });
      } catch {
        toast({
          description: "Could not create playlist. Please try again.",
          title: "Error creating playlist",
          variant: "destructive",
        });
      }
    },
    handleDeletePlaylist = useCallback(async () => {
      if (!deleteCandidate) {
        return;
      }

      setIsDeleting(true);
      try {
        await deletePlaylist(deleteCandidate.id).isPersisted.promise;
        toast({
          description: `"${deleteCandidate.name}" has been deleted.`,
          title: "Playlist deleted",
        });
        setDeleteCandidate(null);
        setDeleteConfirmation("");
        await router.invalidate();
      } catch {
        toast({
          description: "Could not delete this playlist. Please try again.",
          title: "Delete failed",
          variant: "destructive",
        });
      } finally {
        setIsDeleting(false);
      }
    }, [deleteCandidate, deletePlaylist, router, toast]),
    columns = useMemo(
      () =>
        createPlaylistColumns({
          onDelete: (playlist) => setDeleteCandidate(playlist),
        }),
      []
    );

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
              <Link search={{ redirect: "/dashboard" }} to="/login">
                Log In
              </Link>
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

      <AlertDialog
        onOpenChange={(isOpen) => {
          if (!(isOpen || isDeleting)) {
            setDeleteCandidate(null);
            setDeleteConfirmation("");
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the playlist from your library. Type the
              playlist name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">{deleteCandidate?.name}</p>
            <Input
              disabled={isDeleting}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="Type the playlist name"
              value={deleteConfirmation}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !deleteCandidate ||
                deleteConfirmation !== deleteCandidate.name ||
                isDeleting
              }
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePlaylist();
              }}
            >
              Delete Playlist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
