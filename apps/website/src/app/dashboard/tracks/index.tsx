/* eslint-disable no-use-before-define, react-perf/jsx-no-new-function-as-prop */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Disc,
  Download,
  Mic2,
  MoreVertical,
  Music,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { StatsGrid } from "@/components/dashboard/stats-grid";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { downloadFileFromApi } from "@/lib/api";
import {
  useDeleteTrackMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import { getDashboardTracks } from "@/lib/soundkit.functions";

const formatDateSafe = (isoString?: string | null) => {
  if (!isoString) {
    return "Just now";
  }
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(date);
  } catch {
    return "Recently";
  }
};

export const Route = createFileRoute("/dashboard/tracks/")({
  component: TracksPage,
  loader: () => getDashboardTracks(),
});

function TracksPage() {
  const initialTracks = Route.useLoaderData();
  const { data: tracks = [], error, isLoading } = useTracksQuery(initialTracks);
  const deleteTrackMutation = useDeleteTrackMutation();
  const { setCurrentTrack, setQueue } = useAudioPlayer();
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const completedCount = tracks.filter(
    (track) => track.productionStatus === "complete"
  ).length;
  const trackStats = [
    {
      description: "Across all genres and projects",
      icon: Music,
      title: "Total Tracks",
      value: String(tracks.length),
    },
    {
      description: "Active recording and processing",
      icon: Mic2,
      title: "In Production",
      value: String(Math.max(tracks.length - completedCount, 0)),
    },
    {
      description: "Mixed, mastered and ready",
      icon: Disc,
      title: "Completed",
      value: String(completedCount),
    },
    {
      description: "Platform-wide engagement",
      icon: PlayCircle,
      title: "Total Plays",
      value: String(tracks.reduce((total, track) => total + track.plays, 0)),
    },
  ];

  const playableTracks = tracks
    .filter((track) => Boolean(track.playbackUrl))
    .map((track) => ({
      artist: track.artistName,
      artistHref: track.artistUsername
        ? `/artist/${track.artistUsername}`
        : "/dashboard/profile",
      cover: track.coverArtUrl ?? "/placeholder.svg",
      id: track.id,
      src: track.playbackUrl ?? "",
      title: track.title,
      trackHref: `/tracks/${track.id}`,
    }));

  const playTrack = (trackId: string) => {
    const track = playableTracks.find((entry) => entry.id === trackId);

    if (!track) {
      return;
    }

    setQueue(playableTracks);
    setCurrentTrack(track);
  };

  const downloadTrackMaster = async (track: (typeof tracks)[number]) => {
    if (!track.downloadUrl) {
      toast({
        description: "No guarded master download is available for this track.",
        title: "Download unavailable",
        variant: "destructive",
      });
      return;
    }

    try {
      await downloadFileFromApi({
        fallbackFileName: `${track.title}.download`,
        url: track.downloadUrl,
      });
      toast({
        description: `Downloading ${track.title}...`,
        title: "Starting Download",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error ? error.message : "Unable to download master.",
        title: "Download unavailable",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Tracks
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your individual music tracks
          </p>
        </div>
        <Link to="/dashboard/tracks/new">
          <Button className="bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90">
            <Plus className="mr-2 size-4" />
            New Track
          </Button>
        </Link>
      </div>

      <StatsGrid stats={trackStats} />

      {isLoading && (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading your tracks...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-6 text-sm text-destructive">
            We could not load your tracks. Refresh and try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && tracks.length === 0 && (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="p-6">
            <p className="font-semibold">No tracks yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload your first master to make it playable in your dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tracks.map((track) => (
          <Card
            className="group overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/50"
            key={track.id}
          >
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    aria-label={`Play ${track.title}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/20 bg-muted bg-cover bg-center transition-transform group-hover:scale-105"
                    disabled={!track.playbackUrl}
                    onClick={() => playTrack(track.id)}
                    style={{
                      backgroundImage: track.coverArtUrl
                        ? `url(${track.coverArtUrl})`
                        : undefined,
                    }}
                    type="button"
                  >
                    <PlayCircle className="size-5 text-primary" />
                  </button>
                  <div className="min-w-0">
                    <Link
                      className="block truncate font-semibold transition-colors group-hover:text-primary"
                      params={{ id: track.id }}
                      to="/dashboard/tracks/$id"
                    >
                      {track.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {track.genre}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild={true}>
                    <Button
                      className="text-muted-foreground"
                      size="icon"
                      variant="ghost"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!track.downloadUrl}
                      onClick={() => void downloadTrackMaster(track)}
                    >
                      <Download className="mr-2 size-4" />
                      Download Master
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to="/dashboard/tracks/$id/edit"
                        params={{ id: track.id }}
                      >
                        <Pencil className="mr-2 size-4" />
                        Edit Track
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={deleteTrackMutation.isPending}
                      onClick={() => {
                        setDeleteCandidate({
                          id: track.id,
                          title: track.title,
                        });
                        setDeleteConfirmation("");
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete Track
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    className={
                      track.assetStatus === "processing"
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                        : undefined
                    }
                    variant={
                      track.productionStatus === "complete"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {track.assetStatus === "processing"
                      ? "processing"
                      : track.productionStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                    BPM
                  </span>
                  <span className="font-mono">{track.bpm ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                    Key
                  </span>
                  <span className="font-medium">{track.musicalKey ?? "-"}</span>
                </div>
              </div>

              <div className="border-border/20 border-t pt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Activity className="size-3 text-primary" />
                    {track.collaboratorCount} collaborator(s)
                  </span>
                  <span>{formatDateSafe(track.updatedAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !deleteTrackMutation.isPending) {
            setDeleteCandidate(null);
            setDeleteConfirmation("");
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete track?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the track and its dashboard record. Type
              the track title to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">{deleteCandidate?.title}</p>
            <Input
              disabled={deleteTrackMutation.isPending}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="Type the track title"
              value={deleteConfirmation}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTrackMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !deleteCandidate ||
                deleteConfirmation !== deleteCandidate.title ||
                deleteTrackMutation.isPending
              }
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteCandidate) {
                  return;
                }
                try {
                  await deleteTrackMutation.mutateAsync(deleteCandidate.id);
                  toast({
                    description: `"${deleteCandidate.title}" has been deleted.`,
                    title: "Track Deleted",
                  });
                  setDeleteCandidate(null);
                  setDeleteConfirmation("");
                } catch {
                  toast({
                    description: "Failed to delete track. Please try again.",
                    title: "Error",
                    variant: "destructive",
                  });
                }
              }}
            >
              {deleteTrackMutation.isPending ? "Deleting..." : "Delete Track"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
