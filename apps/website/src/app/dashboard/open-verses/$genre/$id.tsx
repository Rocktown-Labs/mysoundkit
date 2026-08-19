import { useUploadFiles } from "@better-upload/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  FileAudio,
  LoaderCircle,
  Mic2,
  PlayCircle,
  Send,
  Upload,
  UserCheck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL, MEDIA_BASE_URL, MEDIA_UPLOAD_URL } from "@/lib/api";
import { canonicalGenreName } from "@/lib/music-genres";
import {
  useOpenVerseQuery,
  useSubmitOpenVerseMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/$genre/$id")({
  component: OpenVerseDetailPage,
});

interface Submission {
  assetId: string | null;
  createdAt: string;
  id: string;
  listingId: string;
  message: string | null;
  status: "accepted" | "declined" | "shortlisted" | "submitted" | "withdrawn";
  submitterAvatarUrl?: string | null;
  submitterDisplayName?: string;
  submitterUserId: string;
  submitterUsername?: string;
}

const formatSlot = (start: number | null, end: number | null) =>
  start === null || end === null
    ? "Artist will confirm the slot"
    : `${Math.round(start / 1000)}s - ${Math.round(end / 1000)}s`;

function OpenVerseDetailPage() {
  const { id } = Route.useParams(),
    query = useOpenVerseQuery(id),
    submitMutation = useSubmitOpenVerseMutation(id),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    [submissions, setSubmissions] = useState<Submission[]>([]),
    [selectedFile, setSelectedFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isDownloading, setIsDownloading] = useState(false),
    [accessRequestStatus, setAccessRequestStatus] = useState<string | null>(
      null
    ),
    fileInputRef = useRef<HTMLInputElement | null>(null),
    { upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      route: "media",
    }),
    listing = query.data;

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `${API_V1_URL}/open-verses/${encodeURIComponent(id)}/access-requests/me`,
      { credentials: "include" }
    )
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { status?: string } | null)
          : null
      )
      .then((request) => {
        if (!cancelled) {
          setAccessRequestStatus(request?.status ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccessRequestStatus(null);
        }
      });
    void fetch(
      `${API_V1_URL}/open-verses/${encodeURIComponent(id)}/submissions`,
      { credentials: "include" }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load submissions.");
        }
        return (await response.json()) as Submission[];
      })
      .then((rows) => {
        if (!cancelled) {
          setSubmissions(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const playListing = () => {
      if (!listing?.playbackUrl) {
        return;
      }
      const playerTrack = {
        artist: listing.artistName,
        artistHref: listing.artistUsername
          ? `/artist/${listing.artistUsername}`
          : "/dashboard/profile",
        cover: listing.coverArtUrl ?? "/open-verse-placeholder.svg",
        id: listing.id,
        src: listing.playbackUrl,
        title: listing.title,
        trackHref: `/dashboard/open-verses/${listing.genreSlug}/${listing.id}`,
      };
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    },
    downloadClip = async () => {
      if (!listing?.playbackUrl) {
        return;
      }
      setIsDownloading(true);
      try {
        const response = await fetch(listing.playbackUrl);
        if (!response.ok) {
          throw new Error("The persisted Open Verse clip is not available.");
        }
        const url = URL.createObjectURL(await response.blob()),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${listing.trackTitle.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-open-verse.wav`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The clip could not be downloaded.",
          title: "Download unavailable",
          variant: "destructive",
        });
      } finally {
        setIsDownloading(false);
      }
    },
    requestAccess = async () => {
      try {
        const response = await fetch(
          `${API_V1_URL}/open-verses/${encodeURIComponent(id)}/access-requests`,
          {
            body: JSON.stringify({}),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error(
            "You need an eligible Track or Project before requesting access."
          );
        }
        const request = (await response.json()) as { status: string };
        setAccessRequestStatus(request.status);
        toast({
          description: "The creator will review your request.",
          title: "Access requested",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The request could not be saved.",
          title: "Access request failed",
          variant: "destructive",
        });
      }
    },
    submitVerse = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedFile || !listing) {
        return;
      }
      setIsSubmitting(true);
      try {
        const uploadResult = await upload([selectedFile]),
          uploaded = uploadResult.files[0],
          objectKey = uploaded?.objectInfo.key;
        if (!objectKey) {
          throw new Error("The submission upload did not finish.");
        }
        const created = await submitMutation.mutateAsync({
          assetMimeType: selectedFile.type || "audio/wav",
          assetObjectKey: objectKey,
          assetOriginalFileName: selectedFile.name,
          assetSizeBytes: selectedFile.size,
          assetUrl: `${MEDIA_BASE_URL}/${objectKey}`,
          message: message.trim() || undefined,
        });
        setSubmissions((current) => [
          { ...created, submitterUserId: "me" },
          ...current,
        ]);
        setSelectedFile(null);
        setMessage("");
        toast({
          description: "Your real submission media is ready for owner review.",
          title: "Verse submitted",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The submission could not be saved.",
          title: "Submission failed",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    acceptSubmission = async (submission: Submission) => {
      try {
        const response = await fetch(
          `${API_V1_URL}/open-verses/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submission.id)}/accept`,
          { credentials: "include", method: "POST" }
        );
        if (!response.ok) {
          throw new Error("Only the listing owner can accept submissions.");
        }
        setSubmissions((current) =>
          current.map((row) =>
            row.id === submission.id ? { ...row, status: "accepted" } : row
          )
        );
        toast({
          description:
            "The accepted artist was added to the underlying Track collaborators.",
          title: "Submission accepted",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The submission could not be accepted.",
          title: "Acceptance failed",
          variant: "destructive",
        });
      }
    };

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading open verse…
        </CardContent>
      </Card>
    );
  }
  if (!listing) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Open verse not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-6">
        <Card className="overflow-hidden border-border/40 bg-card/50">
          <div
            className="relative flex aspect-video items-center justify-center bg-muted bg-cover bg-center"
            style={{
              backgroundImage: `url(${listing.coverArtUrl ?? "/open-verse-placeholder.svg"})`,
            }}
          >
            <Button
              aria-label={`Play ${listing.title}`}
              className="size-14 rounded-full shadow-2xl"
              disabled={!listing.playbackUrl}
              onClick={playListing}
              size="icon"
              type="button"
            >
              <PlayCircle className="size-8" />
            </Button>
          </div>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
                  {listing.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {listing.artistName} opened a slot on {listing.trackTitle}.
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={isDownloading || !listing.playbackUrl}
                onClick={() => void downloadClip()}
                size="sm"
                variant="outline"
              >
                <Download className="size-4" />
                {isDownloading ? "Preparing…" : "Download Open Slot (.WAV)"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {canonicalGenreName(listing.genre)}
              </Badge>
              {listing.bpm && (
                <Badge variant="outline">{listing.bpm} BPM</Badge>
              )}
              {listing.musicalKey && (
                <Badge variant="outline">{listing.musicalKey}</Badge>
              )}
              <Badge variant="outline">
                {formatSlot(listing.slotStartsAtMs, listing.slotEndsAtMs)}
              </Badge>
              <Badge variant="outline">
                {listing.accessMode === "open"
                  ? "Open to eligible artists"
                  : "Approval required"}
              </Badge>
            </div>
            {listing.description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {listing.description}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="size-5 text-primary" />
              Submissions{" "}
              <Badge variant="secondary">{submissions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {submissions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No submissions yet.
              </p>
            )}
            {submissions.map((submission) => {
              const accepted = submission.status === "accepted";
              return (
                <div
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border/40 p-4 sm:flex-row sm:items-center"
                  key={submission.id}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {submission.submitterDisplayName ?? "SoundKit Artist"}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        @
                        {submission.submitterUsername ??
                          submission.submitterUserId}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {submission.message ?? "No message"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(submission.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {submission.assetId && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`${API_V1_URL}/tracks/${listing.trackId}/assets/${submission.assetId}/download`}
                        >
                          <FileAudio className="mr-1 size-4" />
                          Audio
                        </a>
                      </Button>
                    )}
                    {accepted ? (
                      <Badge className="gap-1">
                        <UserCheck className="size-3" />
                        Accepted
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => void acceptSubmission(submission)}
                        size="sm"
                      >
                        <CheckCircle2 className="mr-1 size-4" />
                        Accept
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
      <aside>
        <Card>
          <CardHeader>
            <CardTitle>Submit Your Verse</CardTitle>
          </CardHeader>
          <CardContent>
            {listing.accessMode === "approval_required" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Request access from the creator before submitting files. The
                  creator must approve your request.
                </p>
                <Button
                  className="w-full"
                  disabled={
                    accessRequestStatus === "pending" ||
                    accessRequestStatus === "approved"
                  }
                  onClick={() => void requestAccess()}
                  type="button"
                >
                  {accessRequestStatus === "approved"
                    ? "Access approved"
                    : (accessRequestStatus === "pending"
                      ? "Request pending"
                      : "Request Access")}
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => void submitVerse(event)}
              >
                <input
                  ref={fileInputRef}
                  accept="audio/*,.wav,.mp3,.m4a,.aac"
                  className="sr-only"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
                <Button
                  className="h-16 w-full border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                  variant="outline"
                >
                  <Upload className="mr-2 size-4" />
                  {selectedFile ? selectedFile.name : "Attach Mixed Audition"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Mixed Audition is required. Dry Vocal and project archive
                  support can be added to the same persisted submission in a
                  later review step.
                </p>
                <Textarea
                  placeholder="Add a note for the creator (optional)"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!selectedFile || isSubmitting}
                  type="submit"
                >
                  <Send className="mr-2 size-4" />
                  {isSubmitting ? "Uploading…" : "Submit Verse"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
