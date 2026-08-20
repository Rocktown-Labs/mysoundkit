/* eslint-disable one-var, sort-vars, require-unicode-regexp */
import { useUploadFiles } from "@better-upload/client";
import {
  Upload,
  Download,
  Play,
  FileAudio,
  ImageIcon,
  File,
  LoaderCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { API_V1_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import { useProjectQuery } from "@/lib/soundkit-api-hooks";

interface ProjectFilesProps {
  projectId: string;
}

const formatBytes = (sizeBytes: number | null | undefined) => {
    if (!sizeBytes || sizeBytes <= 0) {
      return "—";
    }
    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  assetKindLabel = (assetKind: string) => assetKind.replaceAll("_", " "),
  assetKindIcon = (assetKind: string) => {
    if (assetKind === "cover_art") {
      return ImageIcon;
    }
    if (assetKind.includes("audio") || assetKind === "master") {
      return FileAudio;
    }
    return File;
  };

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  const projectQuery = useProjectQuery(projectId),
    [isReordering, setIsReordering] = useState(false),
    fileInputRef = useRef<HTMLInputElement>(null),
    {
      averageProgress,
      isPending: isUploading,
      upload,
    } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      onError: (uploadError) => {
        toast({
          description: uploadError.message || "Failed to upload file.",
          title: "Upload failed",
          variant: "destructive",
        });
      },
      onUploadComplete: async ({ files }) => {
        try {
          for (const file of files) {
            const rawTitle = file.raw.name
                .replace(/\.[^/.]+$/, "")
                .replaceAll(/[_-]/g, " "),
              title = rawTitle.trim() || "Untitled Track",
              response = await fetch(
                `${API_V1_URL}/projects/${encodeURIComponent(projectId)}/tracks`,
                {
                  body: JSON.stringify({
                    sourceObjectKey: file.objectInfo.key,
                    title,
                  }),
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  method: "POST",
                }
              );

            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              throw new Error(err.message || "Failed to add track to project");
            }
          }

          toast({
            description: "Files uploaded and added to project workspace.",
            title: "Upload complete",
          });
          await projectQuery.refetch();
        } catch (error) {
          toast({
            description:
              error instanceof Error ? error.message : "Error attaching track",
            title: "Upload error",
            variant: "destructive",
          });
        }
      },
      route: "media",
    }),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    project = projectQuery.data,
    tracks = project?.tracks ?? [],
    assets = project?.assets ?? [],
    handlePlayTrack = (track: (typeof tracks)[number]) => {
      if (!track.playbackUrl) {
        return;
      }
      const playerTrack = {
        artist: track.artistName,
        artistHref: track.artistUsername
          ? `/artist/${track.artistUsername}`
          : "/dashboard/profile",
        cover: track.coverArtUrl ?? "/placeholder.svg",
        id: track.id,
        src: track.playbackUrl,
        title: track.title,
        trackHref: `/dashboard/tracks/${track.id}`,
      };
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    },
    playableTracks = tracks.filter((track) => Boolean(track.playbackUrl)),
    handleMoveTrack = async (index: number, direction: -1 | 1) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= tracks.length) {
        return;
      }

      const orderedTrackIds = tracks.map((track) => track.id),
        currentId = orderedTrackIds[index],
        targetId = orderedTrackIds[targetIndex];
      if (!(currentId && targetId)) {
        return;
      }
      orderedTrackIds[index] = targetId;
      orderedTrackIds[targetIndex] = currentId;

      setIsReordering(true);
      try {
        const response = await fetch(
          `${API_V1_URL}/projects/${encodeURIComponent(projectId)}/tracks/order`,
          {
            body: JSON.stringify({ trackIds: orderedTrackIds }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }
        );
        if (!response.ok) {
          throw new Error("Could not update the project sequence.");
        }
        await projectQuery.refetch();
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not reorder tracks.",
          title: "Sequence update failed",
          variant: "destructive",
        });
      } finally {
        setIsReordering(false);
      }
    },
    handlePlayAll = () => {
      if (playableTracks.length === 0) {
        return;
      }
      const queue = playableTracks.map((track) => ({
        artist: track.artistName,
        artistHref: track.artistUsername
          ? `/artist/${track.artistUsername}`
          : "/dashboard/profile",
        cover: track.coverArtUrl ?? "/placeholder.svg",
        id: track.id,
        src: track.playbackUrl as string,
        title: track.title,
        trackHref: `/dashboard/tracks/${track.id}`,
      }));
      setQueue(queue);
      setCurrentTrack(queue[0]);
    };

  if (projectQuery.isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-playfair)]">
            Project Files
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading files…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)]">
              Project Files
            </CardTitle>
            <CardDescription>
              Tracks and assets associated with this project
            </CardDescription>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90"
            disabled={playableTracks.length === 0}
            onClick={handlePlayAll}
          >
            <Play className="h-4 w-4 mr-2" />
            Play All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tracks.length === 0 && assets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
            No files attached to this project yet.
          </div>
        ) : (
          <>
            {tracks.map((track, index) => {
              const hasAudio = Boolean(track.playbackUrl),
                IconComponent = hasAudio ? FileAudio : File;
              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{track.title}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {track.genre}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {track.duration}
                        </span>
                        {track.productionStatus ? (
                          <>
                            <span className="text-sm text-muted-foreground">
                              •
                            </span>
                            <span className="text-sm text-muted-foreground capitalize">
                              {track.productionStatus}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {tracks.length > 1 ? (
                      <>
                        <Button
                          aria-label={`Move ${track.title} up`}
                          disabled={isReordering || index === 0}
                          onClick={() => handleMoveTrack(index, -1)}
                          size="sm"
                          variant="ghost"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          aria-label={`Move ${track.title} down`}
                          disabled={isReordering || index === tracks.length - 1}
                          onClick={() => handleMoveTrack(index, 1)}
                          size="sm"
                          variant="ghost"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </>
                    ) : null}
                    {hasAudio ? (
                      <Button
                        onClick={() => handlePlayTrack(track)}
                        size="sm"
                        variant="ghost"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button disabled size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {assets.map((asset) => {
              const IconComponent = assetKindIcon(asset.assetKind),
                name =
                  asset.objectKey?.split("/").pop() ??
                  assetKindLabel(asset.assetKind);
              return (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{name}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {assetKindLabel(asset.assetKind)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatBytes(asset.sizeBytes)}
                        </span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {asset.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button disabled size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </>
        )}

        {/* Upload Areas for Missing Files */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isUploading
              ? "border-primary/60 bg-primary/5"
              : "border-border/40 hover:border-primary/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const droppedFiles = [...e.dataTransfer.files];
            if (droppedFiles.length > 0) {
              upload(droppedFiles);
            }
          }}
        >
          <input
            accept="audio/*,image/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.zip"
            className="hidden"
            multiple
            onChange={(e) => {
              const selected = [...(e.target.files ?? [])];
              if (selected.length > 0) {
                upload(selected);
              }
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            ref={fileInputRef}
            type="file"
          />
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <LoaderCircle className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-medium">
                Uploading {averageProgress}%…
              </p>
              <p className="text-xs text-muted-foreground">
                Adding tracks to project workspace
              </p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop audio files or stems here, or click to browse
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
              >
                Choose Files
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
