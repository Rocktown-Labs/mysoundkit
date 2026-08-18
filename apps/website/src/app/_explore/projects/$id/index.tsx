"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  Disc,
  Heart,
  Music,
  Play,
  Plus,
  Share2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  usePublicProjectQuery,
  useToggleSaveTrackMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/projects/$id/")({
  component: PublicProjectDetailPage,
});

function PublicProjectDetailPage() {
  const { id } = Route.useParams(),
    { data: project, isLoading } = usePublicProjectQuery(id),
    { setCurrentTrack, setIsPlaying, setQueue } = useAudioPlayer(),
    { addItem } = useCart(),
    saveTrackMutation = useToggleSaveTrackMutation(),
    [savedTrackIds, setSavedTrackIds] = useState<Set<string>>(new Set()),
    [isProjectLiked, setIsProjectLiked] = useState(false);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading album details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Album or project not found.
      </div>
    );
  }

  const projectTracks = project.tracks ?? [],
    handlePlayAll = () => {
      if (projectTracks.length === 0) {
        toast({
          description: "No playable tracks in this project yet.",
          title: "Playback unavailable",
        });
        return;
      }

      const queue = projectTracks.map((t) => ({
        album: project.title,
        artist: project.artistName ?? "SoundKit Artist",
        cover: project.coverArtUrl,
        id: t.id,
        src: t.playbackUrl ?? "/demo-audio/fantasy26.wav",
        title: t.title,
        trackHref: `/tracks/${t.id}`,
      }));

      setQueue(queue);
      setCurrentTrack(queue[0]);
      setIsPlaying(true);
    },
    handlePlayTrack = (track: (typeof projectTracks)[number]) => {
      const playerTrack = {
        album: project.title,
        artist: project.artistName ?? "SoundKit Artist",
        cover: project.coverArtUrl,
        id: track.id,
        src: track.playbackUrl ?? "/demo-audio/fantasy26.wav",
        title: track.title,
        trackHref: `/tracks/${track.id}`,
      };

      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
      setIsPlaying(true);
    },
    handleToggleSaveTrack = async (trackId: string, trackTitle: string) => {
      setSavedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) {
          next.delete(trackId);
        } else {
          next.add(trackId);
        }
        return next;
      });

      try {
        const result = await saveTrackMutation.mutateAsync(trackId);
        toast({
          description: result.saved
            ? `Saved "${trackTitle}" to your Library!`
            : `Removed "${trackTitle}" from your Library.`,
          title: result.saved ? "Track Saved" : "Track Removed",
        });
      } catch {
        toast({
          description: `Failed to update "${trackTitle}" in your Library.`,
          title: "Action Failed",
          variant: "destructive",
        });
      }
    },
    handleBuyProject = () => {
      addItem({
        artistName: project.artistName ?? "SoundKit Artist",
        coverArtUrl: project.coverArtUrl ?? undefined,
        priceCents: 999,
        productType: "project",
        projectId: project.id,
        purchaseMode: "digital_download",
        title: project.title,
      });
      toast({
        description: `Added "${project.title}" to cart!`,
        title: "Added to Cart",
      });
    },
    handleShare = async () => {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: project.title,
            url: window.location.href,
          });
          return;
        } catch {
          // Fall through to clipboard
        }
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          description: "Project link copied to clipboard.",
          title: "Link Copied",
        });
      }
    };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      {/* Album Header Banner */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="relative size-64 rounded-2xl bg-muted overflow-hidden border border-border/40 shadow-2xl shrink-0">
          {project.coverArtUrl ? (
            <AppImage
              src={project.coverArtUrl}
              alt={project.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-muted-foreground">
              <Disc className="size-20 opacity-30" />
            </div>
          )}
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="uppercase font-bold tracking-wider text-xs"
            >
              {project.projectType}
            </Badge>
            {project.releaseDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(project.releaseDate).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-bold tracking-tight">
            {project.title}
          </h1>

          <p className="text-muted-foreground text-sm max-w-xl">
            {project.description || "Official project release on SoundKit."}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              size="lg"
              className="gap-2 font-bold px-8 shadow-xl shadow-primary/20"
              onClick={handlePlayAll}
            >
              <Play className="size-5 fill-current" /> Play Album
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 font-bold px-6"
              onClick={handleBuyProject}
            >
              <ShoppingBag className="size-5" /> Buy Album ($9.99)
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => {
                setIsProjectLiked((prev) => !prev);
                toast({
                  description: isProjectLiked
                    ? `Removed "${project.title}" from your liked projects.`
                    : `Saved "${project.title}" to your liked projects!`,
                });
              }}
            >
              <Heart
                className={
                  isProjectLiked
                    ? "size-5 fill-rose-500 text-rose-500"
                    : "size-5"
                }
              />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={handleShare}
            >
              <Share2 className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tracklist Section */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Music className="size-5 text-primary" /> Tracklist (
              {projectTracks.length} Songs)
            </h2>
            <span className="text-xs text-muted-foreground">
              Save individual songs to your library or stream below
            </span>
          </div>

          <div className="divide-y border border-border/40 rounded-xl overflow-hidden">
            {projectTracks.length > 0 ? (
              projectTracks.map((track, idx) => {
                const isTrackSaved = savedTrackIds.has(track.id);

                return (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-4 bg-card/40 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <span className="w-6 text-center font-mono text-sm text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div className="truncate min-w-0 flex-1">
                        <Link
                          to="/tracks/$id"
                          params={{ id: track.id }}
                          className="font-semibold text-sm truncate hover:text-primary transition-colors block"
                        >
                          {track.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {track.genre || "Music"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Save Individual Track Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 px-3"
                        onClick={() =>
                          void handleToggleSaveTrack(track.id, track.title)
                        }
                        title={
                          isTrackSaved
                            ? "Saved to Library"
                            : "Save Track to Library"
                        }
                      >
                        {isTrackSaved ? (
                          <BookmarkCheck className="size-3.5 text-primary" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {isTrackSaved ? "Saved" : "Save"}
                        </span>
                      </Button>

                      {/* Stream Track Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs h-8 px-3"
                        onClick={() => handlePlayTrack(track)}
                      >
                        <Play className="size-3.5 fill-current" /> Stream
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No tracks listed in this project.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
