/* eslint-disable complexity, no-promise-executor-return, no-void, one-var, promise/avoid-new, react/todo, require-unicode-regexp, sort-vars, unicorn/prefer-ternary */
import { useUploadFiles } from "@better-upload/client";
import { useQueryClient } from "@tanstack/react-query";
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
  MoreVertical,
  Check,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import {
  TrackCardQuickMenuItems,
  TrackQuickActionDialogs,
  editableTrackFromDetail,
} from "@/components/dashboard/track-quick-actions";
import type { QuickActionDialogName } from "@/components/dashboard/track-quick-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  API_V1_URL,
  PROJECT_ASSETS_UPLOAD_URL,
  apiClient,
  rpcJson,
} from "@/lib/api";
import {
  PROJECT_LIBRARY_KINDS,
  isTrackForProjectLibraryKind,
  projectLibraryKindDescriptions,
  projectLibraryKindLabels,
} from "@/lib/project-library";
import type { ProjectLibraryKind } from "@/lib/project-library";
import {
  soundkitQueryKeys,
  useAttachProjectLibraryAssetsMutation,
  useProjectQuery,
  useTracksQuery,
  useTrackQuery,
} from "@/lib/soundkit-api-hooks";
import type { TrackSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface ProjectFilesProps {
  projectId: string;
}

interface ProjectExportState {
  assets: {
    downloadUrl: string;
    fileName: string;
    id: string;
    status: string;
  }[];
  exportVersion: number;
  status: string;
  workflowInstanceId: string | null;
}

const projectAssetPost = apiClient.v1.projects[":projectId"].assets.$post,
  projectTrackPost = apiClient.v1.projects[":projectId"].tracks.$post;

const formatBytes = (sizeBytes: number | null | undefined) => {
    if (!sizeBytes || sizeBytes <= 0) {
      return "—";
    }
    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  assetMetadataValue = (metadata: unknown, key: string) => {
    if (!(metadata && typeof metadata === "object")) {
      return null;
    }
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  },
  assetKindLabel = (assetKind: string, metadata?: unknown) => {
    const requestedAssetKind = assetMetadataValue(
      metadata,
      "requestedAssetKind"
    );
    return (
      assetKind === "attachment" && requestedAssetKind
        ? requestedAssetKind
        : assetKind
    ).replaceAll("_", " ");
  },
  assetKindIcon = (assetKind: string) => {
    if (assetKind === "cover_art") {
      return ImageIcon;
    }
    if (assetKind.includes("audio") || assetKind === "master") {
      return FileAudio;
    }
    return File;
  },
  sourceTrackIdFromMetadata = (metadata: unknown) => {
    if (!(metadata && typeof metadata === "object")) {
      return null;
    }
    const { sourceTrackId } = metadata as { sourceTrackId?: unknown };
    return typeof sourceTrackId === "string" ? sourceTrackId : null;
  };

interface ProjectLibrarySourcePickerProps {
  attachedTrackIds: Set<string>;
  kind: ProjectLibraryKind;
  libraryTracks: TrackSummary[];
  onToggle: (trackId: string) => void;
  selectedTrackIds: Set<string>;
  tracksError: Error | null;
  tracksLoading: boolean;
}

function ProjectLibrarySourcePicker({
  attachedTrackIds,
  kind,
  libraryTracks,
  onToggle,
  selectedTrackIds,
  tracksError,
  tracksLoading,
}: ProjectLibrarySourcePickerProps) {
  const availableTracks = libraryTracks.filter(
    (track) =>
      isTrackForProjectLibraryKind(track, kind) &&
      !attachedTrackIds.has(track.id)
  );
  let selectedSourceContent: ReactNode;

  if (tracksLoading) {
    selectedSourceContent = (
      <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-sm text-muted-foreground">
        Loading your uploads…
      </div>
    );
  } else if (tracksError) {
    selectedSourceContent = (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
        We couldn’t load your uploads. You can still add a new file below.
      </div>
    );
  } else if (availableTracks.length === 0) {
    selectedSourceContent = (
      <div className="rounded-md border border-dashed border-border/50 p-4 text-center text-sm text-muted-foreground">
        No {projectLibraryKindLabels[kind].toLowerCase()} uploads are available
        yet. Add a new file below to get started.
      </div>
    );
  } else {
    selectedSourceContent = availableTracks.map((track) => {
      const isSelected = selectedTrackIds.has(track.id);
      return (
        <button
          aria-pressed={isSelected}
          className={cn(
            "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors",
            isSelected
              ? "border-primary/60 bg-primary/10"
              : "border-border/40 bg-background/40 hover:bg-background/80"
          )}
          key={track.id}
          onClick={() => onToggle(track.id)}
          type="button"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded border",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/50"
            )}
          >
            {isSelected ? <Check className="size-3" /> : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{track.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {track.genre} · {track.duration}
            </span>
          </span>
          <Badge className="shrink-0" variant="secondary">
            {track.isPublic ? "Published" : "Draft"}
          </Badge>
        </button>
      );
    });
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">From your uploads</p>
          <p className="text-xs text-muted-foreground">
            {projectLibraryKindDescriptions[kind]}
          </p>
        </div>
        <Badge variant="outline">{availableTracks.length} available</Badge>
      </div>

      <div className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
        {selectedSourceContent}
      </div>
    </div>
  );
}

export function ProjectFiles({ projectId }: ProjectFilesProps) {
  const [activeTrackAction, setActiveTrackAction] = useState<{
      action: QuickActionDialogName;
      trackId: string;
    } | null>(null),
    [uploadKind, setUploadKind] = useState<ProjectLibraryKind>("concept"),
    [selectedLibraryTrackIds, setSelectedLibraryTrackIds] = useState<string[]>(
      []
    ),
    queryClient = useQueryClient(),
    projectQuery = useProjectQuery(projectId),
    libraryTracksQuery = useTracksQuery(undefined, {
      limit: 100,
      scope: "dashboard",
    }),
    attachLibraryAssetsMutation =
      useAttachProjectLibraryAssetsMutation(projectId),
    trackQuery = useTrackQuery(activeTrackAction?.trackId ?? ""),
    [isReordering, setIsReordering] = useState(false),
    [isExporting, setIsExporting] = useState(false),
    [exportState, setExportState] = useState<ProjectExportState | null>(null),
    fileInputRef = useRef<HTMLInputElement>(null),
    {
      averageProgress,
      isPending: isUploading,
      upload,
    } = useUploadFiles({
      api: PROJECT_ASSETS_UPLOAD_URL,
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
              title = rawTitle.trim() || "Untitled Track";

            if (uploadKind === "master") {
              await rpcJson(
                await projectTrackPost({
                  json: {
                    sourceObjectKey: file.objectInfo.key,
                    title,
                  },
                  param: { projectId },
                })
              );
            } else {
              await rpcJson(
                await projectAssetPost({
                  json: {
                    assetKind: uploadKind,
                    displayName: file.raw.name,
                    mimeType: file.raw.type || undefined,
                    objectKey: file.objectInfo.key,
                    sizeBytes: file.raw.size,
                  },
                  param: { projectId },
                })
              );
            }
          }

          toast({
            description:
              uploadKind === "master"
                ? "Masters uploaded and added to the project tracklist."
                : `${uploadKind[0]?.toUpperCase()}${uploadKind.slice(1)} assets added to the project workspace.`,
            title: "Upload complete",
          });
          await Promise.all([
            projectQuery.refetch(),
            queryClient.invalidateQueries({
              queryKey: soundkitQueryKeys.projects,
            }),
          ]);
        } catch (error) {
          toast({
            description:
              error instanceof Error ? error.message : "Error attaching asset",
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
    libraryTracks = libraryTracksQuery.data ?? [],
    attachedTrackIds = new Set(tracks.map((track) => track.id)),
    attachedLibraryTrackIds = new Set(
      assets
        .map((asset) => sourceTrackIdFromMetadata(asset.metadata))
        .filter((trackId): trackId is string => Boolean(trackId))
    ),
    handleUploadKindChange = (value: string) => {
      const nextKind = PROJECT_LIBRARY_KINDS.find((kind) => kind === value);
      if (!nextKind) {
        return;
      }
      setUploadKind(nextKind);
      setSelectedLibraryTrackIds([]);
    },
    toggleLibraryTrack = (trackId: string) => {
      setSelectedLibraryTrackIds((currentTrackIds) =>
        currentTrackIds.includes(trackId)
          ? currentTrackIds.filter(
              (currentTrackId) => currentTrackId !== trackId
            )
          : [...currentTrackIds, trackId]
      );
    },
    handleAttachLibraryAssets = async () => {
      if (selectedLibraryTrackIds.length === 0) {
        return;
      }

      try {
        const selectedTrackCount = selectedLibraryTrackIds.length,
          updatedProject = await attachLibraryAssetsMutation.mutateAsync({
            assetKind: uploadKind,
            trackIds: selectedLibraryTrackIds,
          });
        queryClient.setQueryData(
          soundkitQueryKeys.project(projectId),
          updatedProject
        );
        setSelectedLibraryTrackIds([]);
        const label = projectLibraryKindLabels[uploadKind].toLowerCase();
        toast({
          description: `Selected ${label}${selectedTrackCount === 1 ? "" : "s"} were added to this project.`,
          title: "Project updated",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not add the selected uploads.",
          title: "Could not update project",
          variant: "destructive",
        });
      }
    },
    loadExportState = async () => {
      const response = await fetch(
        `${API_V1_URL}/projects/${encodeURIComponent(projectId)}/export`,
        { credentials: "include" }
      );
      if (!response.ok) {
        return null;
      }
      const state = (await response.json()) as ProjectExportState;
      setExportState(state);
      return state;
    },
    startProjectExport = async () => {
      setIsExporting(true);
      try {
        const response = await fetch(
          `${API_V1_URL}/projects/${encodeURIComponent(projectId)}/export`,
          { credentials: "include", method: "POST" }
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(body?.message ?? "Project export could not start.");
        }
        for (let poll = 0; poll < 150; poll += 1) {
          const state = await loadExportState();
          if (
            state?.status === "ready" ||
            state?.status === "failed" ||
            state?.status === "partial"
          ) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        toast({
          description:
            "Release-context files are available below when processing completes.",
          title: "Project export updated",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Project export failed.",
          title: "Export failed",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    },
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
        await Promise.all([
          projectQuery.refetch(),
          queryClient.invalidateQueries({
            queryKey: soundkitQueryKeys.projects,
          }),
        ]);
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
    <>
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
            <div className="flex gap-2">
              <Button
                disabled={tracks.length === 0 || isExporting}
                onClick={() => void startProjectExport()}
                variant="outline"
              >
                {isExporting ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <Download className="mr-2 size-4" />
                )}
                Prepare release files
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={playableTracks.length === 0}
                onClick={handlePlayAll}
              >
                <Play className="h-4 w-4 mr-2" />
                Play All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {exportState && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Release export v{exportState.exportVersion}
                </span>
                <Badge variant="outline">{exportState.status}</Badge>
              </div>
              {exportState.assets.map((asset) => (
                <Button
                  asChild
                  className="w-full justify-start"
                  disabled={asset.status !== "ready"}
                  key={asset.id}
                  variant="ghost"
                >
                  <a href={`${API_V1_URL}${asset.downloadUrl}`}>
                    <Download className="mr-2 size-4" />
                    {asset.fileName}
                  </a>
                </Button>
              ))}
            </div>
          )}
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
                            disabled={
                              isReordering || index === tracks.length - 1
                            }
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild={true}>
                          <Button
                            aria-label={`Actions for ${track.title}`}
                            size="sm"
                            variant="ghost"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <TrackCardQuickMenuItems
                            onOpenAction={(action) =>
                              setActiveTrackAction({
                                action,
                                trackId: track.id,
                              })
                            }
                            track={{
                              id: track.id,
                              isForSale: track.isForSale,
                            }}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        disabled={!track.downloadUrl}
                        onClick={() => {
                          if (track.downloadUrl) {
                            window.open(
                              `${API_V1_URL}${track.downloadUrl}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {assets.map((asset) => {
                const IconComponent = assetKindIcon(asset.assetKind),
                  name =
                    assetMetadataValue(asset.metadata, "displayName") ??
                    asset.objectKey?.split("/").pop() ??
                    assetKindLabel(asset.assetKind, asset.metadata),
                  label = assetKindLabel(asset.assetKind, asset.metadata);
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
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatBytes(asset.sizeBytes)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            •
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {asset.status}
                          </span>
                          {asset.version ? (
                            <span className="text-sm text-muted-foreground">
                              • v{asset.version}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <Button
                      disabled={!asset.downloadUrl}
                      onClick={() => {
                        if (asset.downloadUrl) {
                          window.open(
                            `${API_V1_URL}${asset.downloadUrl}`,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </>
          )}

          {/* Existing library sources and direct uploads */}
          <div className="space-y-4">
            <Tabs
              className="w-full"
              onValueChange={handleUploadKindChange}
              value={uploadKind}
            >
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="concept">Add Concept</TabsTrigger>
                <TabsTrigger value="beat">Add Beat</TabsTrigger>
                <TabsTrigger value="master">Add Master</TabsTrigger>
              </TabsList>
              <TabsContent className="mt-4" value={uploadKind}>
                <ProjectLibrarySourcePicker
                  attachedTrackIds={
                    uploadKind === "master"
                      ? attachedTrackIds
                      : attachedLibraryTrackIds
                  }
                  kind={uploadKind}
                  libraryTracks={libraryTracks}
                  onToggle={toggleLibraryTrack}
                  selectedTrackIds={new Set(selectedLibraryTrackIds)}
                  tracksError={libraryTracksQuery.error}
                  tracksLoading={libraryTracksQuery.isLoading}
                />
                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={
                      selectedLibraryTrackIds.length === 0 ||
                      attachLibraryAssetsMutation.isPending
                    }
                    onClick={() => void handleAttachLibraryAssets()}
                    type="button"
                  >
                    {attachLibraryAssetsMutation.isPending ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 size-4" />
                    )}
                    Add selected{" "}
                    {projectLibraryKindLabels[uploadKind].toLowerCase()}
                    {selectedLibraryTrackIds.length === 1 ? "" : "s"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span>or upload a new file</span>
              <Separator className="flex-1" />
            </div>

            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                isUploading
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/40 hover:border-primary/40"
              )}
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
                <div className="flex flex-col items-center justify-center gap-2">
                  <LoaderCircle className="size-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    Uploading {averageProgress}%…
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadKind === "master"
                      ? "Adding masters to the project tracklist"
                      : `Adding ${projectLibraryKindLabels[uploadKind].toLowerCase()} assets to the project workspace`}
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 size-8 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    Upload a new{" "}
                    {projectLibraryKindLabels[uploadKind].toLowerCase()} file
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Choose File
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Masters become ordered project tracks. Beats and concepts stay
              private workspace assets until you are ready to use them.
            </p>
          </div>
        </CardContent>
      </Card>
      <TrackQuickActionDialogs
        activeDialog={activeTrackAction?.action ?? null}
        assets={trackQuery.data?.assets ?? []}
        collaborators={trackQuery.data?.collaborators ?? []}
        mediaReady={trackQuery.data?.mediaReady === true}
        onClose={() => setActiveTrackAction(null)}
        onSaved={() => projectQuery.refetch()}
        track={editableTrackFromDetail(trackQuery.data)}
        trackId={activeTrackAction?.trackId ?? ""}
      />
    </>
  );
}
