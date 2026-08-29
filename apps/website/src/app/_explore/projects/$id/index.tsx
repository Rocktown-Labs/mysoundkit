"use client";

/* eslint-disable complexity, one-var, sort-vars */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Disc,
  Download,
  FileAudio,
  FileJson,
  Heart,
  Image,
  Layers,
  Music,
  Play,
  Plus,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import type { PlayerTrack } from "@/components/audio-player-provider";
import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useDbSavedTrackActions, useDbSavedTrackIds } from "@/lib/data-db";
import { shareLink } from "@/lib/share";
import { usePublicProjectQuery } from "@/lib/soundkit-api-hooks";
import type { PublicProjectDetail } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/projects/$id/")({
  component: PublicProjectDetailPage,
});

type ProjectTrack = PublicProjectDetail["tracks"][number];

type ProjectAsset = PublicProjectDetail["assets"][number];

function PublicProjectDetailPage() {
  const { id } = Route.useParams(),
    router = useRouter(),
    { data: project, error, isError, isLoading } = usePublicProjectQuery(id),
    { setCurrentTrack, setIsPlaying, setQueue, addToQueue } = useAudioPlayer(),
    { addItem } = useCart(),
    { data: savedTrackRows = [] } = useDbSavedTrackIds(),
    { toggle } = useDbSavedTrackActions(),
    savedTrackIds = new Set(savedTrackRows.map((track) => track.id)),
    [isProjectLiked, setIsProjectLiked] = useState(false),
    [isSavingProject, setIsSavingProject] = useState(false);

  if (isLoading) {
    return <ProjectPageMessage message="Loading project..." />;
  }

  if (isError || !project) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-bold text-2xl">Project unavailable</h1>
          <p className="text-muted-foreground text-sm">
            {error instanceof Error
              ? error.message
              : "This project could not be loaded from the API."}
          </p>
          <Button onClick={() => router.history.back()} variant="outline">
            <ArrowLeft className="size-4" />
            Back to catalog
          </Button>
        </div>
      </div>
    );
  }

  const projectTracks = project.tracks ?? [],
    playableTracks = projectTracks.filter((track) =>
      Boolean(track.playbackUrl ?? track.previewUrl)
    ),
    projectPriceCents = project.priceCents ?? 999,
    projectPriceLabel = `$${(projectPriceCents / 100).toFixed(2)}`,
    toPlayerTrack = (track: ProjectTrack): PlayerTrack => ({
      album: project.title,
      artist: project.artistName ?? "SoundKit Artist",
      artistHref: project.artistUsername
        ? `/artist/${project.artistUsername}`
        : null,
      cover: project.coverArtUrl,
      id: track.id,
      src: track.playbackUrl ?? track.previewUrl ?? "/demo-audio/fantasy26.wav",
      title: track.title,
      trackHref: trackHref(track),
    }),
    handlePlayAll = () => {
      if (playableTracks.length === 0) {
        toast({
          description: "No playable tracks in this project yet.",
          title: "Playback unavailable",
          variant: "destructive",
        });
        return;
      }

      const queue = projectTracks.map(toPlayerTrack);
      setQueue(queue);
      setCurrentTrack(queue[0]);
      setIsPlaying(true);
    },
    handleQueueAll = () => {
      if (playableTracks.length === 0) {
        toast({
          description: "No playable tracks in this project yet.",
          title: "Queue unavailable",
          variant: "destructive",
        });
        return;
      }

      let addedCount = 0;
      for (const track of playableTracks) {
        if (addToQueue(toPlayerTrack(track))) {
          addedCount += 1;
        }
      }
      toast({
        description:
          addedCount > 0
            ? `Added ${addedCount} ${addedCount === 1 ? "track" : "tracks"} from ${project.title} to your queue.`
            : `${project.title} is already in your queue.`,
        title: addedCount > 0 ? "Queue Updated" : "Already Queued",
      });
    },
    handlePlayTrack = (track: ProjectTrack) => {
      const playerTrack = toPlayerTrack(track);
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
      setIsPlaying(true);
    },
    handleToggleSaveTrack = async (trackId: string, trackTitle: string) => {
      const wasSaved = savedTrackIds.has(trackId);
      try {
        await toggle(trackId).isPersisted.promise;
        toast({
          description: wasSaved
            ? `Removed "${trackTitle}" from your Library.`
            : `Saved "${trackTitle}" to your Library.`,
          title: wasSaved ? "Track Removed" : "Track Saved",
        });
      } catch {
        toast({
          description: "Please sign in to save tracks to your library.",
          title: "Sign in required",
          variant: "destructive",
        });
      }
    },
    handleBuyProject = () => {
      addItem({
        artistName: project.artistName ?? "SoundKit Artist",
        coverArtUrl: project.coverArtUrl ?? undefined,
        priceCents: projectPriceCents,
        productType: "project",
        projectId: project.id,
        purchaseMode: "digital_download",
        title: project.title,
      });
      toast({
        description: `Added "${project.title}" to cart.`,
        title: "Added to Cart",
      });
    },
    handleShare = async () => {
      const outcome = await shareLink({
        text: `Listen to ${project.title} by ${project.artistName ?? "this artist"} on SoundKit.`,
        title: `Play ${project.title} on SoundKit`,
        url: window.location.href,
      });
      if (outcome === "shared") {
        return;
      }
      if (outcome === "unsupported") {
        toast({
          description: "Sharing is not supported on this device.",
          title: "Unable to share",
          variant: "destructive",
        });
        return;
      }
      toast({
        description: "Project link copied to clipboard.",
        title: "Link Copied",
      });
    },
    handleToggleProjectLike = () => {
      if (isSavingProject) {
        return;
      }
      setIsSavingProject(true);
      setIsProjectLiked((liked) => !liked);
      setIsSavingProject(false);
      toast({
        description: isProjectLiked
          ? `Removed "${project.title}" from your liked projects.`
          : `Saved "${project.title}" to your liked projects.`,
        title: isProjectLiked ? "Project Removed" : "Project Saved",
      });
    };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-50 border-border/10 border-b bg-card/40 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Button
            className="font-black text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground"
            onClick={() => router.history.back()}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="mr-2 size-3.5" />
            Catalog
          </Button>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Share project"
              className="size-8"
              onClick={handleShare}
              size="icon"
              title="Share project"
              variant="ghost"
            >
              <Share2 className="size-4" />
            </Button>
            <Button
              aria-label={isProjectLiked ? "Unlike project" : "Like project"}
              className="size-8"
              disabled={isSavingProject}
              onClick={handleToggleProjectLike}
              size="icon"
              title={isProjectLiked ? "Unlike project" : "Like project"}
              variant="ghost"
            >
              <Heart
                className={isProjectLiked ? "fill-rose-500 text-rose-500" : ""}
              />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="space-y-10">
          <section className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-8">
            <div className="group relative size-60 shrink-0 md:size-72">
              {project.coverArtUrl ? (
                <AppImage
                  alt={`${project.title} cover artwork`}
                  className="size-full rounded-lg border border-border/40 object-cover shadow-2xl"
                  height={640}
                  src={project.coverArtUrl}
                  width={640}
                />
              ) : (
                <div className="flex size-full items-center justify-center rounded-lg border border-border/40 bg-muted text-muted-foreground shadow-2xl">
                  <Disc className="size-20 opacity-30" />
                </div>
              )}
              {playableTracks.length > 0 ? (
                <button
                  aria-label={`Play ${project.title}`}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/25 opacity-100 transition-all hover:bg-black/40 md:opacity-0 md:hover:opacity-100 motion-reduce:transition-none"
                  onClick={handlePlayAll}
                  type="button"
                >
                  <span className="flex size-16 scale-90 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform group-hover:scale-100 motion-reduce:transition-none">
                    <Play className="size-8 fill-current" />
                  </span>
                </button>
              ) : null}
            </div>

            <div className="flex-1 space-y-4 pt-2">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className="h-5 rounded-none border-primary/40 bg-primary/5 px-2 py-0.5 font-black text-[10px] text-primary uppercase tracking-[0.2em]"
                    variant="outline"
                  >
                    {project.projectType}
                  </Badge>
                  {project.releaseDate ? (
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Calendar className="size-3.5" />
                      {formatReleaseDate(project.releaseDate)}
                    </span>
                  ) : null}
                </div>
                <h1 className="max-w-3xl break-words font-[family-name:var(--font-playfair)] font-black text-4xl uppercase leading-[0.92] tracking-normal md:text-5xl lg:text-6xl">
                  {project.title}
                </h1>
                {project.artistUsername ? (
                  <Link
                    className="inline-flex text-muted-foreground text-lg font-black uppercase tracking-tighter transition-colors hover:text-primary"
                    params={{ username: project.artistUsername }}
                    to="/artist/$username"
                  >
                    {project.artistName ?? "SoundKit Artist"}
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-lg font-black uppercase tracking-tighter">
                    {project.artistName ?? "SoundKit Artist"}
                  </p>
                )}
                <p className="max-w-3xl text-muted-foreground text-sm leading-6">
                  {project.description ||
                    "Official project release on SoundKit."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-12 flex-1 rounded-lg px-8 font-black uppercase tracking-[0.1em] shadow-primary/20 shadow-xl sm:flex-none"
                  disabled={playableTracks.length === 0}
                  onClick={handlePlayAll}
                  size="lg"
                >
                  <Play className="mr-3 size-5 fill-current" /> Play Album
                </Button>
                <Button
                  className="h-12 flex-1 rounded-lg border-border/40 px-8 font-black uppercase tracking-[0.1em] sm:flex-none"
                  disabled={playableTracks.length === 0}
                  onClick={handleQueueAll}
                  size="lg"
                  variant="outline"
                >
                  <Plus className="mr-2 size-5" /> Queue
                </Button>
                {project.isForSale ? (
                  <Button
                    className="h-12 flex-1 rounded-lg bg-emerald-600 px-6 font-black text-white uppercase tracking-[0.1em] hover:bg-emerald-700 sm:flex-none"
                    onClick={handleBuyProject}
                    size="lg"
                  >
                    <ShoppingCart className="mr-2 size-5" /> Buy{" "}
                    {projectPriceLabel}
                  </Button>
                ) : null}
                <Button
                  aria-label={
                    isProjectLiked ? "Unlike project" : "Like project"
                  }
                  className={`size-12 rounded-lg border-border/40 hover:border-rose-500/40 hover:text-rose-500 ${isProjectLiked ? "border-rose-500/50 bg-rose-500/10 text-rose-500" : ""}`}
                  disabled={isSavingProject}
                  onClick={handleToggleProjectLike}
                  size="icon"
                  variant="outline"
                >
                  <Heart className={isProjectLiked ? "fill-current" : ""} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 border-border/10 border-t pt-4 md:grid-cols-4">
                <ProjectStat
                  label="Tracks"
                  value={String(project.trackCount)}
                />
                <ProjectStat
                  label="Runtime"
                  value={project.duration ?? "0:00"}
                />
                <ProjectStat
                  label="Release"
                  value={
                    project.status === "released" ? "Released" : project.status
                  }
                />
                <ProjectStat label="Format" value={project.projectType} />
              </div>
            </div>
          </section>

          <ProjectTracklist
            onPlayTrack={handlePlayTrack}
            onSaveTrack={(track) =>
              handleToggleSaveTrack(track.id, track.title)
            }
            savedTrackIds={savedTrackIds}
            tracks={projectTracks}
          />

          <ProjectAssetsSection assets={project.assets} />
        </div>
      </div>
    </div>
  );
}

function ProjectPageMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6 text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  );
}

function ProjectStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 font-black text-[9px] text-muted-foreground uppercase tracking-[0.2em] opacity-50">
        {label}
      </p>
      <p className="font-black text-xl tabular-nums">{value}</p>
    </div>
  );
}

function ProjectTracklist({
  onPlayTrack,
  onSaveTrack,
  savedTrackIds,
  tracks,
}: {
  onPlayTrack: (track: ProjectTrack) => void;
  onSaveTrack: (track: ProjectTrack) => void;
  savedTrackIds: Set<string>;
  tracks: ProjectTrack[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-2">
        <h2 className="flex items-center gap-2 font-black text-xl uppercase tracking-tight">
          <Music className="size-5 text-primary" />
          Tracklist ({tracks.length} Songs)
        </h2>
        <span className="hidden text-muted-foreground text-xs sm:block">
          Save individual songs or stream them below
        </span>
      </div>
      <div className="divide-y divide-border/10 overflow-hidden rounded-lg border border-border/40">
        {tracks.length > 0 ? (
          tracks.map((track, index) => (
            <ProjectTrackRow
              isSaved={savedTrackIds.has(track.id)}
              key={track.id}
              onPlay={() => onPlayTrack(track)}
              onSave={() => onSaveTrack(track)}
              position={index + 1}
              track={track}
            />
          ))
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No tracks listed in this project.
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectTrackRow({
  isSaved,
  onPlay,
  onSave,
  position,
  track,
}: {
  isSaved: boolean;
  onPlay: () => void;
  onSave: () => void;
  position: number;
  track: ProjectTrack;
}) {
  const trackContent = (
    <>
      <span className="w-6 text-center font-mono text-muted-foreground text-sm">
        {position}
      </span>
      <div className="min-w-0 flex-1 truncate">
        <span className="block truncate font-semibold text-sm transition-colors group-hover:text-primary">
          {track.title}
        </span>
        <span className="block truncate text-muted-foreground text-xs">
          {track.genre || "Music"}
        </span>
      </div>
    </>
  );

  return (
    <div className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-white/[0.02]">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {track.regionSlug && track.slug ? (
          <Link
            className="flex min-w-0 flex-1 items-center gap-4"
            params={{ regionSlug: track.regionSlug, slug: track.slug }}
            to="/tracks/$regionSlug/$slug"
          >
            {trackContent}
          </Link>
        ) : (
          <Link
            className="flex min-w-0 flex-1 items-center gap-4"
            params={{ id: track.id }}
            to="/tracks/$id"
          >
            {trackContent}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          aria-label={isSaved ? `Unsave ${track.title}` : `Save ${track.title}`}
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={onSave}
          size="sm"
          title={isSaved ? "Saved to Library" : "Save Track to Library"}
          variant="outline"
        >
          {isSaved ? (
            <Heart className="size-3.5 fill-primary text-primary" />
          ) : (
            <Plus className="size-3.5" />
          )}
          <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
        </Button>
        <Button
          aria-label={`Stream ${track.title}`}
          className="h-8 gap-1.5 px-3 text-xs"
          disabled={!track.playbackUrl && !track.previewUrl}
          onClick={onPlay}
          size="sm"
          variant="ghost"
        >
          <Play className="size-3.5 fill-current" />
          <span className="hidden sm:inline">Stream</span>
        </Button>
      </div>
    </div>
  );
}

function ProjectAssetsSection({ assets }: { assets: ProjectAsset[] }) {
  const currentAssets = assets.filter((asset) => asset.isCurrent !== false);

  if (currentAssets.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="px-2 font-black text-muted-foreground text-xs uppercase tracking-[0.3em]">
        Included Files
      </h3>
      <div className="divide-y divide-border/10 overflow-hidden rounded-lg border border-border/40">
        {currentAssets.map((asset) => (
          <div
            className="flex items-center justify-between gap-4 px-4 py-4"
            key={asset.id}
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center border border-border/20 bg-muted/40 text-muted-foreground">
                <ProjectAssetIcon kind={asset.assetKind} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-sm uppercase tracking-tight">
                  {assetFileName(asset)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
                  {asset.assetKind.replaceAll("_", " ")} · {asset.status}
                </p>
              </div>
            </div>
            <Button
              aria-label={`Download ${assetFileName(asset)}`}
              className="size-9 shrink-0 rounded-none"
              disabled={!asset.downloadUrl}
              size="icon"
              title={
                asset.downloadUrl ? "Download file" : "Download unavailable"
              }
              variant="ghost"
            >
              <Download className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectAssetIcon({ kind }: { kind: string }) {
  if (
    kind.includes("image") ||
    kind.includes("artwork") ||
    kind.includes("cover")
  ) {
    return <Image className="size-5" />;
  }
  if (kind.includes("midi") || kind.includes("json")) {
    return <FileJson className="size-5" />;
  }
  if (kind.includes("stem")) {
    return <Layers className="size-5" />;
  }
  return <FileAudio className="size-5" />;
}

function assetFileName(asset: ProjectAsset) {
  return (
    asset.objectKey?.split("/").at(-1) ?? asset.assetKind.replaceAll("_", "-")
  );
}

function formatReleaseDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function trackHref(track: ProjectTrack) {
  return track.regionSlug && track.slug
    ? `/tracks/${track.regionSlug}/${track.slug}`
    : `/tracks/${track.id}`;
}
