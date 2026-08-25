import { useUploadFiles } from "@better-upload/client";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  FileAudio,
  LoaderCircle,
  Mic2,
  Globe2,
  PlayCircle,
  Send,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  apiClient,
  API_V1_URL,
  MEDIA_BASE_URL,
  MEDIA_UPLOAD_URL,
  rpcJson,
  TRACK_SOURCE_UPLOAD_URL,
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { sliceAudioFileToSnippet } from "@/lib/media-bunny-slicer";
import { readAudioDurationMs } from "@/lib/media-duration";
import { canonicalGenreName } from "@/lib/music-genres";
import {
  useOpenVerseQuery,
  useSubmitOpenVerseMutation,
  useUpdateTrackMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/$genre/$id")({
  component: OpenVerseDetailPage,
});

interface Submission {
  adlibAssetId: string | null;
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
  vocalStemAssetId: string | null;
}

const formatSlot = (start: number | null, end: number | null) =>
  start === null || end === null
    ? "Artist will confirm the slot"
    : `${Math.round(start / 1000)}s - ${Math.round(end / 1000)}s`;

function OpenVerseDetailPage() {
  const { id } = Route.useParams(),
    router = useRouter(),
    query = useOpenVerseQuery(id),
    submitMutation = useSubmitOpenVerseMutation(id),
    { data: session } = authClient.useSession(),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    [submissions, setSubmissions] = useState<Submission[]>([]),
    [selectedAdlibsFile, setSelectedAdlibsFile] = useState<File | null>(null),
    [selectedAuditionFile, setSelectedAuditionFile] = useState<File | null>(
      null
    ),
    [selectedVocalStemFile, setSelectedVocalStemFile] = useState<File | null>(
      null
    ),
    [message, setMessage] = useState(""),
    [finalMasterFile, setFinalMasterFile] = useState<File | null>(null),
    [isFinalizing, setIsFinalizing] = useState(false),
    [isSubmitting, setIsSubmitting] = useState(false),
    [isDownloading, setIsDownloading] = useState(false),
    [accessRequestStatus, setAccessRequestStatus] = useState<string | null>(
      null
    ),
    adlibsInputRef = useRef<HTMLInputElement | null>(null),
    auditionInputRef = useRef<HTMLInputElement | null>(null),
    finalMasterInputRef = useRef<HTMLInputElement | null>(null),
    vocalStemInputRef = useRef<HTMLInputElement | null>(null),
    { upload } = useUploadFiles({
      api: MEDIA_UPLOAD_URL,
      credentials: "include",
      route: "media",
    }),
    { uploadAsync: uploadFinalMaster } = useUploadFiles({
      api: TRACK_SOURCE_UPLOAD_URL,
      credentials: "include",
      route: "track-source",
    }),
    listing = query.data,
    updateTrackMutation = useUpdateTrackMutation(listing?.trackId ?? ""),
    isListingOwner = listing?.ownerUserId === session?.user.id,
    isCurrentUserAdmin =
      session?.user.role
        ?.split(",")
        .map((value) => value.trim())
        .includes("admin") ?? false,
    [isDeletingListing, setIsDeletingListing] = useState(false),
    [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

  const toggleListingVisibility = async () => {
    if (!listing || updateTrackMutation.isPending) {
      return;
    }
    try {
      await updateTrackMutation.mutateAsync({ isPublic: !listing.isPublic });
      await query.refetch();
      toast({
        description: listing.isPublic
          ? "The Open Verse is now unlisted."
          : "The Open Verse is now live.",
        title: listing.isPublic ? "Open Verse unlisted" : "Open Verse live",
      });
    } catch (error) {
      toast({
        description:
          error instanceof Error
            ? error.message
            : "Could not change Open Verse visibility.",
        title: "Visibility update failed",
        variant: "destructive",
      });
    }
  },

   deleteListing = async () => {
      if (!listing) {
        return;
      }
      setIsDeletingListing(true);
      try {
        const response = await fetch(
          `${API_V1_URL}/open-verses/${encodeURIComponent(listing.id)}`,
          { credentials: "include", method: "DELETE" }
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? "Unable to delete the listing.");
        }
        toast({
          description: "The open verse listing was deleted.",
          title: "Listing Deleted",
        });
        void router.navigate({ to: "/dashboard/open-verses" });
      } catch (deleteError) {
        toast({
          description:
            deleteError instanceof Error
              ? deleteError.message
              : "Unable to delete the listing.",
          title: "Delete Failed",
          variant: "destructive",
        });
      } finally {
        setIsDeletingListing(false);
        setIsDeleteDialogOpen(false);
      }
    },
    playListing = () => {
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
        const sourceBlob = await response.blob(),
          downloadBlob = listing.previewAssetId
            ? sourceBlob
            : await sliceAudioFileToSnippet(
                sourceBlob,
                (listing.slotStartsAtMs ?? 0) / 1000,
                (listing.slotEndsAtMs ?? 30_000) / 1000,
                `${listing.trackTitle.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-open-verse-slot.wav`
              ),
          url = URL.createObjectURL(downloadBlob),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${listing.trackTitle.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-open-verse-slot.wav`;
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
      if (!(selectedAuditionFile && selectedVocalStemFile && listing)) {
        return;
      }
      setIsSubmitting(true);
      try {
        const uploadAsset = async (file: File) => {
            const uploadResult = await upload([file]),
              uploaded = uploadResult.files[0],
              objectKey = uploaded?.objectInfo.key;
            if (!objectKey) {
              throw new Error("A submission upload did not finish.");
            }
            return {
              assetMimeType: file.type || "audio/wav",
              assetObjectKey: objectKey,
              assetOriginalFileName: file.name,
              assetSizeBytes: file.size,
              assetUrl: `${MEDIA_BASE_URL}/${objectKey}`,
            };
          },
          [audition, vocalStem, adlibs] = await Promise.all([
            uploadAsset(selectedAuditionFile),
            uploadAsset(selectedVocalStemFile),
            selectedAdlibsFile ? uploadAsset(selectedAdlibsFile) : null,
          ]),
          created = await submitMutation.mutateAsync({
            adlibs: adlibs ?? undefined,
            audition,
            message: message.trim() || undefined,
            vocalStem,
          });
        setSubmissions((current) => [
          { ...created, submitterUserId: "me" },
          ...current,
        ]);
        setSelectedAdlibsFile(null);
        setSelectedAuditionFile(null);
        setSelectedVocalStemFile(null);
        setMessage("");
        toast({
          description:
            "Your audition, vocal stem, and optional adlibs are ready for owner review.",
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
        await query.refetch();
        toast({
          description:
            "The accepted files and collaborator are preserved. Upload the completed final master when your external mix is ready.",
          title: "Awaiting final master",
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
    },
    finalizeOpenVerse = async () => {
      if (!(listing && isListingOwner && finalMasterFile)) {
        return;
      }
      setIsFinalizing(true);
      try {
        const result = await uploadFinalMaster([finalMasterFile]),
          uploaded = result.files.find(
            (entry) =>
              entry.raw === finalMasterFile ||
              entry.name === finalMasterFile.name
          );
        if (!uploaded?.objectInfo.key) {
          throw new Error("The final master upload did not complete.");
        }
        const durationMs = await readAudioDurationMs(finalMasterFile).catch(
            () => null
          ),
          detail = await rpcJson(
            await apiClient.v1.tracks[":trackId"].assets.$post({
              json: {
                assetKind: "master",
                durationMs: durationMs ?? undefined,
                metadata: {
                  durationMs,
                  originalFileName: finalMasterFile.name,
                },
                mimeType: finalMasterFile.type || "audio/wav",
                objectKey: uploaded.objectInfo.key,
                sizeBytes: finalMasterFile.size,
                status: "uploaded",
                storageProvider: "r2",
              },
              param: { trackId: listing.trackId },
            })
          ),
          masterAsset = detail.assets.find(
            (asset) =>
              asset.assetKind === "master" &&
              asset.objectKey === uploaded.objectInfo.key
          );
        if (!masterAsset) {
          throw new Error("SoundKit could not register the final master.");
        }

        const response = await fetch(
            `${API_V1_URL}/open-verses/${encodeURIComponent(listing.id)}/final-master`,
            {
              body: JSON.stringify({ sourceAssetId: masterAsset.id }),
              credentials: "include",
              headers: { "content-type": "application/json" },
              method: "POST",
            }
          ),
          payload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
        if (!response.ok) {
          throw new Error(payload?.message ?? "Finalization failed.");
        }
        setFinalMasterFile(null);
        await query.refetch();
        toast({
          description:
            "The new master is authoritative. Final media processing continues durably.",
          title: "Final master processing started",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "The final master could not be processed.",
          title: "Finalization failed",
          variant: "destructive",
        });
      } finally {
        setIsFinalizing(false);
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
              <div className="flex flex-wrap items-center gap-2">
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
                {isListingOwner ? (
                  <Button
                    className="gap-2"
                    disabled={updateTrackMutation.isPending}
                    onClick={toggleListingVisibility}
                    size="sm"
                    variant="outline"
                  >
                    <Globe2 className="size-4" />
                    {updateTrackMutation.isPending
                      ? "Saving…"
                      : (listing.isPublic
                        ? "Unlist"
                        : "Make live")}
                  </Button>
                ) : null}
                {isCurrentUserAdmin ? (
                  <Button
                    className="gap-2"
                    disabled={isDeletingListing}
                    onClick={() => setIsDeleteDialogOpen(true)}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete listing
                  </Button>
                ) : null}
              </div>
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
            {!listing.previewAssetId &&
              listing.slotStartsAtMs !== null &&
              listing.slotEndsAtMs !== null && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  SoundKit is preparing the selected{" "}
                  {formatSlot(listing.slotStartsAtMs, listing.slotEndsAtMs)}{" "}
                  listening snippet. The original master remains private.
                </div>
              )}
          </CardContent>
        </Card>

        {isListingOwner && listing.status === "awaiting_final_master" && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="size-5 text-primary" />
                Upload completed final master
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Finish the mix/master outside SoundKit, then upload the new
                authoritative recording. Accepted submission files and credits
                remain preserved.
              </p>
              <input
                ref={finalMasterInputRef}
                accept=".wav,.flac,.aiff,.aif,.m4a,.mp3,audio/*"
                className="hidden"
                onChange={(event) =>
                  setFinalMasterFile(event.target.files?.[0] ?? null)
                }
                type="file"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => finalMasterInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {finalMasterFile?.name ?? "Choose new final master"}
              </Button>
              <Button
                type="button"
                className="w-full gap-2"
                disabled={!finalMasterFile || isFinalizing}
                onClick={() => void finalizeOpenVerse()}
              >
                {isFinalizing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {isFinalizing
                  ? "Registering final master…"
                  : "Start final-track processing"}
              </Button>
            </CardContent>
          </Card>
        )}

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
                          Audition
                        </a>
                      </Button>
                    )}
                    {submission.vocalStemAssetId && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`${API_V1_URL}/tracks/${listing.trackId}/assets/${submission.vocalStemAssetId}/download`}
                        >
                          <Mic2 className="mr-1 size-4" />
                          Vocal Stem
                        </a>
                      </Button>
                    )}
                    {submission.adlibAssetId && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`${API_V1_URL}/tracks/${listing.trackId}/assets/${submission.adlibAssetId}/download`}
                        >
                          <FileAudio className="mr-1 size-4" />
                          Adlibs
                        </a>
                      </Button>
                    )}
                    {accepted ? (
                      <Badge className="gap-1">
                        <UserCheck className="size-3" />
                        Accepted
                      </Badge>
                    ) : (isListingOwner && listing.status === "open" ? (
                      <Button
                        onClick={() => void acceptSubmission(submission)}
                        size="sm"
                      >
                        <CheckCircle2 className="mr-1 size-4" />
                        Accept
                      </Button>
                    ) : null)}
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
            {listing.status === "open" ? (
              listing.accessMode === "approval_required" ? (
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
                    ref={auditionInputRef}
                    accept="audio/*,.wav,.mp3,.m4a,.aac"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedAuditionFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  <Button
                    className="h-16 w-full border-dashed"
                    onClick={() => auditionInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Upload className="mr-2 size-4" />
                    {selectedAuditionFile
                      ? selectedAuditionFile.name
                      : "Attach Full Audition Bounce *"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Upload the full bounced take with the open-verse part
                    recorded over the downloaded slot preview.
                  </p>
                  <input
                    ref={vocalStemInputRef}
                    accept="audio/*,.wav,.mp3,.m4a,.aac"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedVocalStemFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  <Button
                    className="h-16 w-full border-dashed"
                    onClick={() => vocalStemInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <Mic2 className="mr-2 size-4" />
                    {selectedVocalStemFile
                      ? selectedVocalStemFile.name
                      : "Attach Dry Vocal Stem *"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Include the isolated vocal so the creator can mix your take
                    into the original session.
                  </p>
                  <input
                    ref={adlibsInputRef}
                    accept="audio/*,.wav,.mp3,.m4a,.aac"
                    className="sr-only"
                    onChange={(event) =>
                      setSelectedAdlibsFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                  <Button
                    className="h-14 w-full border-dashed"
                    onClick={() => adlibsInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <FileAudio className="mr-2 size-4" />
                    {selectedAdlibsFile
                      ? selectedAdlibsFile.name
                      : "Attach Adlibs (Optional)"}
                  </Button>
                  <Textarea
                    placeholder="Add a note for the creator (optional)"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <Button
                    className="w-full"
                    disabled={
                      !(selectedAuditionFile && selectedVocalStemFile) ||
                      isSubmitting
                    }
                    type="submit"
                  >
                    <Send className="mr-2 size-4" />
                    {isSubmitting ? "Uploading…" : "Submit Verse"}
                  </Button>
                </form>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                This Open Verse is closed to new submissions. The accepted
                collaboration is awaiting or processing its completed final
                master.
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
      {isCurrentUserAdmin ? (
        <AlertDialog
          onOpenChange={setIsDeleteDialogOpen}
          open={isDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete this open verse listing?
              </AlertDialogTitle>
              <AlertDialogDescription>
                “{listing?.title}” and all of its access requests and
                submissions will be permanently removed. The linked track is not
                affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isDeletingListing}
                onClick={() => void deleteListing()}
              >
                {isDeletingListing ? "Deleting…" : "Delete listing"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
