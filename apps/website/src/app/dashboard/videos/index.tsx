/* eslint-disable sort-vars, unicorn/consistent-function-scoping */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Film,
  Plus,
  ShieldCheck,
  Play,
  MoreVertical,
  Search,
  Filter,
} from "lucide-react";
import { useState } from "react";

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
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  useDeleteVideoMutation,
  useMeQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";
import type { VideoSummary } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/videos/")({
  component: DashboardVideosPage,
});

function DashboardVideosPage() {
  const [searchQuery, setSearchQuery] = useState(""),
    [pendingDeleteVideo, setPendingDeleteVideo] = useState<VideoSummary | null>(
      null
    ),
    videosQuery = useVideosQuery({ scope: "dashboard" }),
    meQuery = useMeQuery(),
    deleteVideoMutation = useDeleteVideoMutation(),
    videos = videosQuery.data ?? [],
    verifiedUploads = videos.filter(
      (video) => video.sourceProvider === "mux"
    ).length,
    externalSources = videos.filter(
      (video) => video.sourceProvider === "external"
    ).length,
    processingVideos = videos.filter((video) =>
      ["pending", "processing", "uploading"].includes(video.status)
    ).length,
    videoStatusVariant = (status: string) => {
      if (status === "ready") {
        return "default";
      }

      if (status === "processing") {
        return "destructive";
      }

      return "secondary";
    },
    videoStats = [
      {
        description: "Hosted directly on SoundKit via Mux",
        icon: ShieldCheck,
        title: "Verified Uploads",
        value: String(verifiedUploads),
      },
      {
        description: "Linked official videos via YouTube",
        icon: Play,
        title: "External Sources",
        value: String(externalSources),
      },
      {
        description: "Waiting on transcode and IDs",
        icon: Film,
        title: "Processing",
        value: String(processingVideos),
      },
      {
        description: "From your video library",
        icon: Play,
        title: "Total Videos",
        value: String(videos.length),
      },
    ],
    filteredVideos = videos.filter(
      (video) =>
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.videoKind.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Videos
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload verified music videos or link external sources.
          </p>
        </div>
        <Link to="/dashboard/videos/new">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
            <Plus className="mr-2 size-4" />
            New Video
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={videoStats} />

      {/* Library Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search videos, artists..."
              className="pl-9 bg-card/50 border-border/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="bg-card/50 border-border/40"
            >
              <Filter className="mr-2 size-3.5" />
              Filter
            </Button>
            <p className="text-xs text-muted-foreground ml-auto sm:ml-0">
              Showing {filteredVideos.length} videos
            </p>
          </div>
        </div>

        <Card className="bg-card/40 backdrop-blur-sm border-border/40">
          <CardContent className="p-0">
            <div
              className={
                meQuery.data?.user.mediaLayout === "cards"
                  ? "grid gap-3 p-3 md:grid-cols-2"
                  : "divide-y divide-border/20"
              }
            >
              {filteredVideos.map((video) => (
                <div
                  className="group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
                  key={video.id}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-36 flex-shrink-0 overflow-hidden rounded-xl border border-border/50 group-hover:border-primary/40 transition-colors">
                      <AppImage
                        alt={`${video.title} thumbnail`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        height={180}
                        layout="fixed"
                        loading="lazy"
                        src={video.thumbnailUrl}
                        width={320}
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
                        {video.sourceProvider}
                      </div>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="truncate font-semibold hover:text-primary hover:underline"
                          params={{ id: video.id }}
                          to="/dashboard/videos/$id"
                        >
                          {video.title}
                        </Link>
                        <Badge
                          variant={videoStatusVariant(video.status)}
                          className="text-[10px] uppercase tracking-wider h-5"
                        >
                          {video.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">
                          {video.verifiedOnPlatform
                            ? "SoundKit upload"
                            : "External source"}
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          {video.videoKind.replaceAll("_", " ")}
                        </span>
                        <span>•</span>
                        <div className="flex items-center">
                          {video.verifiedOnPlatform ? (
                            <>
                              <ShieldCheck className="mr-1 size-3 text-emerald-400" />
                              <span className="text-emerald-400/90 font-medium">
                                SoundKit Verified
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-400/90 font-medium italic">
                              External Source
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60">
                        {video.playbackPolicy} playback
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      params={
                        video.regionSlug && video.slug
                          ? { regionSlug: video.regionSlug, slug: video.slug }
                          : { id: video.id }
                      }
                      to={
                        video.regionSlug && video.slug
                          ? "/videos/$regionSlug/$slug"
                          : "/videos/$id"
                      }
                      className="flex-1 sm:flex-none"
                    >
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto bg-card hover:bg-accent border-border/50"
                      >
                        <Play className="mr-2 size-3.5 fill-current" />
                        Preview
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem>Change Visibility</DropdownMenuItem>
                        <DropdownMenuItem asChild={true}>
                          <Link
                            params={{ id: video.id }}
                            to="/dashboard/videos/$id"
                          >
                            View Analytics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setPendingDeleteVideo(video)}
                        >
                          Delete Video
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
            {videosQuery.isLoading && (
              <div className="p-12 text-center space-y-3">
                <Film className="size-12 text-muted-foreground/20 mx-auto" />
                <h3 className="text-lg font-medium">Loading videos</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Checking your SoundKit uploads and external links.
                </p>
              </div>
            )}
            {!videosQuery.isLoading && filteredVideos.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <Film className="size-12 text-muted-foreground/20 mx-auto" />
                <h3 className="text-lg font-medium">
                  {searchQuery ? "No videos found" : "No videos yet"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {searchQuery
                    ? "We couldn't find any videos matching your search."
                    : "Upload a verified video or link an external source to start your library."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog
        open={pendingDeleteVideo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteVideo(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteVideo?.title ?? ""} will be permanently removed from
              SoundKit. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!pendingDeleteVideo) {
                  return;
                }
                deleteVideoMutation.mutate(pendingDeleteVideo.id, {
                  onError: (error) =>
                    toast({
                      description:
                        error instanceof Error
                          ? error.message
                          : "Could not delete this video.",
                      title: "Delete Failed",
                      variant: "destructive",
                    }),
                  onSuccess: () =>
                    toast({
                      description: `${pendingDeleteVideo.title} was deleted.`,
                      title: "Video Deleted",
                    }),
                });
                setPendingDeleteVideo(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
