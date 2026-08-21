"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Download,
  Edit,
  Share2,
  Play,
  Music2,
  FileAudio,
  LoaderCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Save,
  Plus,
  Clock3,
  Rocket,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { downloadFileFromApi } from "@/lib/api";
import { shareLink } from "@/lib/share";
import {
  useCreateTrackLyricsMutation,
  useProcessTrackMutation,
  useReviewTrackLyricsMutation,
  useTrackQuery,
  useUpdateTrackMutation,
} from "@/lib/soundkit-api-hooks";
import type { TrackDetail } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/tracks/$id/")({
  component: TrackDetailPage,
});

const formatBytes = (sizeBytes: number | null | undefined) => {
    if (!sizeBytes || sizeBytes <= 0) {
      return "—";
    }
    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  },
  formatTrackStatusLabel = (
    isLive: boolean,
    productionStatus: string | null | undefined
  ) => {
    if (isLive) {
      return "Ready / Live";
    }

    if (productionStatus === "demo") {
      return "Draft";
    }

    return productionStatus ?? "Draft";
  },
  formatReleaseDateLabel = (
    releaseAt: string | null | undefined,
    isLive: boolean
  ) => {
    if (releaseAt) {
      return new Date(releaseAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      });
    }

    if (isLive) {
      return "Immediate (Live)";
    }

    return "Draft";
  },
  getCoverArtUrl = (coverArtUrl: null | string | undefined) =>
    coverArtUrl && coverArtUrl.length > 0 ? coverArtUrl : "/placeholder.svg",
  SECTION_HEADER_PATTERN =
    /^\s*(?:\[(?:hook|chorus|verse(?:\s+\d+)?|bridge|pre-chorus|intro|outro|refrain|post-chorus)\]|(?:hook|chorus|verse(?:\s+\d+)?|bridge|pre-chorus|intro|outro|refrain|post-chorus):)\s*$/iu;

interface TimedLyricLine {
  endMs: number;
  startMs: number;
  text: string;
}

type TrackAsset = TrackDetail["assets"][number];
type TrackCollaborator = TrackDetail["collaborators"][number];

interface LyricsWorkspaceProps {
  initialLyrics: null | string | undefined;
  initialRevision:
    | {
        id: string;
        sourceType: string;
        status: "approved" | "pending_review" | "rejected";
        timedLines: null | TimedLyricLine[];
      }
    | null
    | undefined;
  isTranscribing: boolean;
  masterAssetExists: boolean;
  onRefetchTrack: () => Promise<unknown>;
  onTranscribe: () => Promise<void>;
  trackId: string;
}

const SECTION_SNIPPETS = [
    "[Intro]",
    "[Verse 1]",
    "[Pre-Chorus]",
    "[Hook]",
    "[Verse 2]",
    "[Bridge]",
    "[Outro]",
  ] as const,
  formatSecondsInput = (milliseconds: number) =>
    (milliseconds / 1000).toFixed(2),
  secondsInputToMilliseconds = (value: string) => {
    const seconds = Number(value);

    if (!Number.isFinite(seconds) || seconds < 0) {
      return null;
    }

    return Math.round(seconds * 1000);
  },
  lyricLinesFromText = (text: string) =>
    text
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !SECTION_HEADER_PATTERN.test(line)),
  generateDraftTimedLines = (text: string): TimedLyricLine[] =>
    lyricLinesFromText(text).map((line, index) => {
      const startMs = index * 4000;

      return {
        endMs: startMs + 3500,
        startMs,
        text: line,
      };
    }),
  normalizeTimedLines = (lines: TimedLyricLine[]) =>
    lines
      .map((line) => ({
        endMs: Math.round(line.endMs),
        startMs: Math.round(line.startMs),
        text: line.text.trim(),
      }))
      .filter((line) => line.text && line.endMs > line.startMs),
  renderReleaseStatusBanner = (
    releaseAt: string | null | undefined,
    isScheduledInFuture: boolean,
    isLive: boolean
  ) => {
    if (isScheduledInFuture && releaseAt) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <Calendar className="mt-0.5 size-5 text-indigo-400" />
          <div>
            <p className="font-semibold text-indigo-200">Scheduled Release</p>
            <p className="text-sm text-indigo-300/80">
              Scheduled to go live on{" "}
              {new Date(releaseAt).toLocaleDateString(undefined, {
                dateStyle: "full",
              })}
              .
            </p>
          </div>
        </div>
      );
    }

    if (isLive) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-semibold">Track is live</p>
            <p className="text-sm text-muted-foreground">
              Your master is available for playback. Background processing will
              fill in BPM, duration, stems, and lyrics when ready.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <LoaderCircle className="mt-0.5 size-5 animate-spin text-muted-foreground" />
        <div>
          <p className="font-semibold">Draft saved</p>
          <p className="text-sm text-muted-foreground">
            This track is not public yet. Open it when you are ready to go live.
          </p>
        </div>
      </div>
    );
  };

function LyricsWorkspace({
  initialLyrics,
  initialRevision,
  isTranscribing,
  masterAssetExists,
  onRefetchTrack,
  onTranscribe,
  trackId,
}: LyricsWorkspaceProps) {
  const createLyricsMutation = useCreateTrackLyricsMutation(trackId),
    reviewLyricsMutation = useReviewTrackLyricsMutation(trackId),
    [lyricsText, setLyricsText] = useState(initialLyrics ?? ""),
    [timedLines, setTimedLines] = useState<TimedLyricLine[]>(
      initialRevision?.timedLines ?? []
    );

  useEffect(() => {
    setLyricsText(initialLyrics ?? "");
    setTimedLines(initialRevision?.timedLines ?? []);
  }, [initialLyrics, initialRevision?.id, initialRevision?.timedLines]);

  const hasTimedLines = timedLines.length > 0,
    hasValidTimedLines = normalizeTimedLines(timedLines).length > 0,
    canApproveCurrent =
      Boolean(initialRevision?.id) &&
      initialRevision?.status !== "approved" &&
      (initialRevision?.timedLines?.length ?? 0) > 0,
    appendSection = (section: string) => {
      setLyricsText((current) => {
        const spacer = current.trim().length > 0 ? "\n\n" : "";

        return `${current}${spacer}${section}\n`;
      });
    },
    handleGenerateDraftSync = () => {
      const generated = generateDraftTimedLines(lyricsText);

      if (generated.length === 0) {
        toast({
          description:
            "Add at least one lyric line before creating sync points.",
          title: "No lyric lines found",
          variant: "destructive",
        });
        return;
      }

      setTimedLines(generated);
    },
    handleTimedLineChange = (
      index: number,
      field: keyof TimedLyricLine,
      value: string
    ) => {
      setTimedLines((current) =>
        current.map((line, lineIndex) => {
          if (lineIndex !== index) {
            return line;
          }

          if (field === "text") {
            return { ...line, text: value };
          }

          const milliseconds = secondsInputToMilliseconds(value);

          return milliseconds === null
            ? line
            : { ...line, [field]: milliseconds };
        })
      );
    },
    handleSubmitLyrics = async ({ approve }: { approve: boolean }) => {
      const normalizedTimedLines = normalizeTimedLines(timedLines);

      if (!lyricsText.trim()) {
        toast({
          description: "Add lyrics before saving a revision.",
          title: "Lyrics required",
          variant: "destructive",
        });
        return;
      }

      if (approve && normalizedTimedLines.length === 0) {
        toast({
          description: "Approved lyrics need at least one synced line.",
          title: "Sync required",
          variant: "destructive",
        });
        return;
      }

      try {
        const revision = await createLyricsMutation.mutateAsync({
          language: "en",
          text: lyricsText,
          timedLines:
            normalizedTimedLines.length > 0 ? normalizedTimedLines : undefined,
        });

        if (approve) {
          await reviewLyricsMutation.mutateAsync({
            body: { status: "approved" },
            lyricsId: revision.id,
          });
        }

        await onRefetchTrack();
        toast({
          description: approve
            ? "Lyrics were saved and approved for synced playback."
            : "Lyrics were saved as a pending revision.",
          title: approve ? "Lyrics approved" : "Lyrics saved",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Could not save lyrics.",
          title: "Lyrics save failed",
          variant: "destructive",
        });
      }
    },
    handleApproveCurrent = async () => {
      if (!(initialRevision?.id && canApproveCurrent)) {
        return;
      }

      try {
        await reviewLyricsMutation.mutateAsync({
          body: { status: "approved" },
          lyricsId: initialRevision.id,
        });
        await onRefetchTrack();
        toast({
          description: "The current synced lyrics are approved.",
          title: "Lyrics approved",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not approve lyrics.",
          title: "Approval failed",
          variant: "destructive",
        });
      }
    };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Lyrics Workspace
            </CardTitle>
            <CardDescription className="text-xs">
              Write sectioned lyrics, generate a sync draft, or queue OpenAI
              transcription from the vocal stem.
            </CardDescription>
          </div>
          <Button
            className="shrink-0"
            disabled={isTranscribing || !masterAssetExists}
            onClick={() => void onTranscribe()}
            size="sm"
            type="button"
          >
            {isTranscribing ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {isTranscribing ? "Queueing..." : "Generate lyrics with AI"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SECTION_SNIPPETS.map((section) => (
              <Button
                key={section}
                onClick={() => appendSection(section)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus className="mr-2 size-3" />
                {section}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lyrics-text">Lyrics</Label>
            <Textarea
              id="lyrics-text"
              className="min-h-80 font-mono text-sm"
              onChange={(event) => setLyricsText(event.target.value)}
              placeholder={"[Hook]\nWrite or paste the sung lyrics here..."}
              value={lyricsText}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerateDraftSync}
              type="button"
              variant="outline"
            >
              <Clock3 className="mr-2 size-4" />
              Draft Sync Points
            </Button>
            <Button
              disabled={createLyricsMutation.isPending}
              onClick={() => void handleSubmitLyrics({ approve: false })}
              type="button"
              variant="secondary"
            >
              <Save className="mr-2 size-4" />
              Save Revision
            </Button>
            <Button
              disabled={createLyricsMutation.isPending || !hasValidTimedLines}
              onClick={() => void handleSubmitLyrics({ approve: true })}
              type="button"
            >
              <CheckCircle2 className="mr-2 size-4" />
              Save & Approve
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Sync Lines</CardTitle>
            <CardDescription className="text-xs">
              Edit start and end seconds for each sung line.
            </CardDescription>
          </div>
          {initialRevision ? (
            <Badge variant="outline">{initialRevision.status}</Badge>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {hasTimedLines ? (
            timedLines.map((line, index) => (
              <div
                key={`${line.startMs}-${line.endMs}-${line.text}`}
                className="grid gap-2 rounded-lg border border-border/50 bg-background/70 p-3 sm:grid-cols-[88px_88px_minmax(0,1fr)]"
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`line-${index}-start`}>Start</Label>
                  <Input
                    id={`line-${index}-start`}
                    min="0"
                    onChange={(event) =>
                      handleTimedLineChange(
                        index,
                        "startMs",
                        event.target.value
                      )
                    }
                    step="0.01"
                    type="number"
                    value={formatSecondsInput(line.startMs)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`line-${index}-end`}>End</Label>
                  <Input
                    id={`line-${index}-end`}
                    min="0"
                    onChange={(event) =>
                      handleTimedLineChange(index, "endMs", event.target.value)
                    }
                    step="0.01"
                    type="number"
                    value={formatSecondsInput(line.endMs)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`line-${index}-text`}>Line</Label>
                  <Input
                    id={`line-${index}-text`}
                    onChange={(event) =>
                      handleTimedLineChange(index, "text", event.target.value)
                    }
                    value={line.text}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Generate draft sync points from the lyrics text or run AI
              transcription after the master asset is uploaded.
            </div>
          )}

          {canApproveCurrent ? (
            <Button
              disabled={reviewLyricsMutation.isPending}
              onClick={() => void handleApproveCurrent()}
              type="button"
            >
              <CheckCircle2 className="mr-2 size-4" />
              Approve Current Revision
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TrackFilesPanel({
  assets,
  masterAsset,
  onPlay,
  playbackUrl,
}: {
  assets: TrackAsset[];
  masterAsset: TrackAsset | undefined;
  onPlay: () => void;
  playbackUrl: null | string | undefined;
}) {
  const handleDownloadMaster = async () => {
    if (!masterAsset?.downloadUrl) {
      toast({
        description: "No guarded master download is available for this track.",
        title: "Download unavailable",
        variant: "destructive",
      });
      return;
    }

    try {
      await downloadFileFromApi({
        fallbackFileName: masterAsset.objectKey?.split("/").pop() ?? "master",
        url: masterAsset.downloadUrl,
      });
      toast({
        description: "Downloading master file...",
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music2 className="size-5" />
            Master
          </CardTitle>
          <CardDescription>
            Primary audio uploaded to SoundKit storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {masterAsset ? (
            <div className="flex items-center justify-between rounded-lg bg-accent/20 p-3">
              <div className="flex items-center gap-3">
                <FileAudio className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {masterAsset.objectKey?.split("/").pop() ?? "Master"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(masterAsset.sizeBytes)} · {masterAsset.status}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {playbackUrl ? (
                  <Button
                    onClick={onPlay}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Play className="size-4" />
                  </Button>
                ) : null}
                <Button
                  disabled={!masterAsset.downloadUrl}
                  onClick={() => void handleDownloadMaster()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Download className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No master asset attached yet.
            </p>
          )}
        </CardContent>
      </Card>

      {assets
        .filter((asset) => asset.assetKind !== "master")
        .map((asset) => (
          <Card key={asset.id}>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {asset.assetKind.replaceAll("_", " ")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {formatBytes(asset.sizeBytes)} · {asset.status}
            </CardContent>
          </Card>
        ))}
    </>
  );
}

function TrackCollaboratorsPanel({
  collaborators,
}: {
  collaborators: TrackCollaborator[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Collaborators</CardTitle>
        <CardDescription>People credited on this track</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collaborators added yet.
          </p>
        ) : (
          collaborators.map((collab) => (
            <div
              className="flex items-center justify-between rounded-lg bg-accent/20 p-3"
              key={collab.id}
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={collab.avatarUrl ?? "/placeholder.svg"} />
                  <AvatarFallback>
                    {(collab.name ?? collab.email ?? "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {collab.name ?? collab.email ?? "Collaborator"}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {collab.role}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{collab.status}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TrackDetailPage() {
  const { id } = Route.useParams(),
    trackQuery = useTrackQuery(id),
    processTrackMutation = useProcessTrackMutation(id),
    updateTrackMutation = useUpdateTrackMutation(id),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    track = trackQuery.data,
    // Hooks must stay above the early returns below, otherwise the hook count
    // changes once the query resolves and React crashes (error #310).
    [isTranscribing, setIsTranscribing] = useState(false);

  if (trackQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Loading track…
      </div>
    );
  }

  if (trackQuery.error || !track) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Track not found</h1>
        <p className="text-muted-foreground">
          This track may still be processing, or the upload did not finish.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard/tracks">Back to Tracks</Link>
        </Button>
      </div>
    );
  }

  const coverArt = getCoverArtUrl(track.coverArtUrl),
    assets =
      "assets" in track && Array.isArray(track.assets) ? track.assets : [],
    collaborators =
      "collaborators" in track && Array.isArray(track.collaborators)
        ? track.collaborators
        : [],
    masterAsset = assets.find((asset) => asset.assetKind === "master"),
    isLive = Boolean(track.isPublic),
    statusLabel = formatTrackStatusLabel(isLive, track.productionStatus),
    handleShare = async () => {
      const publicTrackPath =
          track.regionSlug && track.slug
            ? `/tracks/${track.regionSlug}/${track.slug}`
            : `/tracks/${track.id}`,
        shareUrl =
          typeof window === "undefined"
            ? publicTrackPath
            : `${window.location.origin}${publicTrackPath}`,
        outcome = await shareLink({
          text: `${track.title} by ${track.artistName}`,
          title: track.title,
          url: shareUrl,
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
        description: `Track link copied to clipboard: ${shareUrl}`,
        title: "Link copied!",
      });
    },
    handleReleaseNow = async () => {
      try {
        await updateTrackMutation.mutateAsync({ isPublic: true });
        toast({
          description: `${track.title} is now public.`,
          title: "Track released",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error ? error.message : "Could not release track.",
          title: "Release failed",
          variant: "destructive",
        });
      }
    },
    handleTranscribe = async () => {
      setIsTranscribing(true);
      try {
        const result = await processTrackMutation.mutateAsync();
        await trackQuery.refetch();
        toast({
          description: result.message,
          title:
            result.status === "failed"
              ? "Processing unavailable"
              : "Processing queued",
          variant: result.status === "failed" ? "destructive" : "default",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not start track processing.",
          title: "Processing failed",
          variant: "destructive",
        });
      } finally {
        setIsTranscribing(false);
      }
    },
    handlePlay = () => {
      if (!track.playbackUrl) {
        return;
      }
      const playerTrack = {
        artist: track.artistName,
        artistHref: track.artistUsername
          ? `/artist/${track.artistUsername}`
          : "/dashboard/profile",
        cover: coverArt,
        id: track.id,
        src: track.playbackUrl,
        title: track.title,
        trackHref: `/dashboard/tracks/${track.id}`,
      };
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    },
    hasScheduledDate = Boolean(track.releaseAt),
    isScheduledInFuture =
      hasScheduledDate &&
      new Date(track.releaseAt as string).getTime() > Date.now(),
    releaseDateLabel = formatReleaseDateLabel(track.releaseAt, isLive);

  return (
    <div className="space-y-6">
      {renderReleaseStatusBanner(track.releaseAt, isScheduledInFuture, isLive)}

      <div className="flex flex-col gap-6 lg:flex-row">
        <div
          className="h-64 w-full rounded-lg bg-cover bg-center lg:w-64"
          style={{ backgroundImage: `url(${coverArt})` }}
        />
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
                {track.title}
              </h1>
              <p className="text-muted-foreground">{track.genre}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLive ? null : (
                <Button
                  disabled={updateTrackMutation.isPending}
                  onClick={handleReleaseNow}
                  type="button"
                >
                  <Rocket className="mr-2 size-4" />
                  Release now
                </Button>
              )}
              {track.playbackUrl ? (
                <Button onClick={handlePlay} type="button">
                  <Play className="mr-2 size-4" />
                  Play
                </Button>
              ) : null}
              <Link params={{ id }} to="/dashboard/tracks/$id/edit">
                <Button type="button" variant="outline">
                  <Edit className="mr-2 size-4" />
                  Edit
                </Button>
              </Link>
              <Button onClick={handleShare} type="button" variant="outline">
                <Share2 className="mr-2 size-4" />
                Share
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={isLive ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
            {track.isPublic ? <Badge variant="outline">Public</Badge> : null}
            {track.assetStatus ? (
              <Badge variant="outline">Assets: {track.assetStatus}</Badge>
            ) : null}
            {track.isForSale &&
            track.price !== null &&
            track.price !== undefined ? (
              <Badge variant="outline">${Number(track.price).toFixed(2)}</Badge>
            ) : null}
          </div>

          {track.description ? (
            <p className="text-muted-foreground">{track.description}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <p className="text-sm text-muted-foreground">BPM</p>
              <p className="text-lg font-semibold">
                {track.bpm ?? "Processing…"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Key</p>
              <p className="text-lg font-semibold">
                {track.musicalKey ?? "Processing…"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-lg font-semibold">{track.duration}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Release Date</p>
              <p className="text-lg font-semibold">{releaseDateLabel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-lg font-semibold">
                {track.updatedAt
                  ? new Date(track.updatedAt).toLocaleDateString()
                  : "Processing…"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Tabs className="w-full" defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="lyrics">Lyrics & AI Sync</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="files">
          <TrackFilesPanel
            assets={assets}
            masterAsset={masterAsset}
            onPlay={handlePlay}
            playbackUrl={track.playbackUrl}
          />
        </TabsContent>

        <TabsContent className="space-y-4" value="lyrics">
          <LyricsWorkspace
            initialLyrics={track.lyrics}
            initialRevision={track.lyricsRevision}
            isTranscribing={isTranscribing}
            masterAssetExists={Boolean(masterAsset)}
            onRefetchTrack={() => trackQuery.refetch()}
            onTranscribe={handleTranscribe}
            trackId={track.id}
          />
        </TabsContent>

        <TabsContent className="space-y-4" value="collaborators">
          <TrackCollaboratorsPanel collaborators={collaborators} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
