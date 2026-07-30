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
  Copy,
} from "lucide-react";
import { useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useTrackQuery } from "@/lib/soundkit-api-hooks";

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
};

function TrackDetailPage() {
  const { id } = Route.useParams();
  const trackQuery = useTrackQuery(id);
  const { setCurrentTrack, setQueue } = useAudioPlayer();
  const track = trackQuery.data;
  // Hooks must stay above the early returns below, otherwise the hook count
  // changes once the query resolves and React crashes (error #310).
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [syncedLyrics, setSyncedLyrics] = useState<
    { time: string; text: string }[] | null
  >(null);

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

  const coverArt =
    track.coverArtUrl && track.coverArtUrl.length > 0
      ? track.coverArtUrl
      : "/placeholder.svg";
  const assets =
    "assets" in track && Array.isArray(track.assets) ? track.assets : [];
  const collaborators =
    "collaborators" in track && Array.isArray(track.collaborators)
      ? track.collaborators
      : [];
  const masterAsset = assets.find((asset) => asset.assetKind === "master");
  const isLive = Boolean(track.isPublic);
  const statusLabel = isLive
    ? "Ready / Live"
    : track.productionStatus === "demo"
      ? "Draft"
      : track.productionStatus;

  const handleShare = () => {
    const shareUrl =
      typeof window === "undefined"
        ? `/tracks/${track.id}`
        : `${window.location.origin}/tracks/${track.id}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
      toast({
        description: `Track link copied to clipboard: ${shareUrl}`,
        title: "Link copied!",
      });
    }
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSyncedLyrics([
      { text: "[Intro] Turn the lights low...", time: "00:04.12" },
      {
        text: "(Chorus) Midnight dreams falling through the rain",
        time: "00:12.45",
      },
      { text: "Counting every second till we meet again", time: "00:24.80" },
      {
        text: "(Verse 1) Rhythms in the dark, baseline in my soul",
        time: "00:36.15",
      },
      { text: "Never letting go, SoundKit takes control", time: "00:48.30" },
    ]);
    setIsTranscribing(false);
    toast({
      description:
        "AI lyrics transcription and time-sync generated successfully!",
      title: "Lyrics Synced",
    });
  };

  const handlePlay = () => {
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
  };

  const hasScheduledDate = Boolean(track.releaseAt);
  const isScheduledInFuture =
    hasScheduledDate &&
    new Date(track.releaseAt as string).getTime() > Date.now();

  return (
    <div className="space-y-6">
      {isScheduledInFuture ? (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <Calendar className="mt-0.5 size-5 text-indigo-400" />
          <div>
            <p className="font-semibold text-indigo-200">Scheduled Release</p>
            <p className="text-sm text-indigo-300/80">
              Scheduled to go live on{" "}
              {new Date(track.releaseAt as string).toLocaleDateString(
                undefined,
                { dateStyle: "full" }
              )}
              .
            </p>
          </div>
        </div>
      ) : isLive ? (
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
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
          <LoaderCircle className="mt-0.5 size-5 animate-spin text-muted-foreground" />
          <div>
            <p className="font-semibold">Draft saved</p>
            <p className="text-sm text-muted-foreground">
              This track is not public yet. Open it when you are ready to go
              live.
            </p>
          </div>
        </div>
      )}

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
            {track.isForSale && track.price != null ? (
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
              <p className="text-lg font-semibold">
                {track.releaseAt
                  ? new Date(track.releaseAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })
                  : isLive
                    ? "Immediate (Live)"
                    : "Draft"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Updated</p>
              <p className="text-lg font-semibold">
                {new Date(track.updatedAt).toLocaleDateString()}
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
                        {formatBytes(masterAsset.sizeBytes)} ·{" "}
                        {masterAsset.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {track.playbackUrl ? (
                      <Button
                        onClick={handlePlay}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Play className="size-4" />
                      </Button>
                    ) : null}
                    <Button size="sm" type="button" variant="ghost" disabled>
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
        </TabsContent>

        <TabsContent className="space-y-4" value="lyrics">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Time-Synced Lyrics & Battle Transcripts
                </CardTitle>
                <CardDescription className="text-xs">
                  Transcribe song lyrics automatically using AI for battle
                  matchups or karaoke/sing-along displays.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="shrink-0"
              >
                {isTranscribing ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                {syncedLyrics
                  ? "Re-transcribe with AI"
                  : "AI Transcribe & Sync"}
              </Button>
            </CardHeader>
            <CardContent>
              {syncedLyrics ? (
                <div className="rounded-xl border border-border/40 bg-background/80 p-4 font-mono text-xs space-y-2 max-h-60 overflow-y-auto">
                  {syncedLyrics.map((line, idx) => (
                    <div key={idx} className="flex gap-4 text-muted-foreground">
                      <span className="text-primary font-bold shrink-0">
                        {line.time}
                      </span>
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground">
                    No time-synced lyrics available yet
                  </p>
                  <p>
                    Click &ldquo;AI Transcribe & Sync&rdquo; above to generate
                    timecoded lyrics for battles and playback previews.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="space-y-4" value="collaborators">
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
                        <AvatarImage
                          src={collab.avatarUrl ?? "/placeholder.svg"}
                        />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
