import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  FileArchive,
  FileAudio,
  LoaderCircle,
  Mic2,
  Music2,
  PlayCircle,
  Plus,
  Send,
  Upload,
  UserCheck,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { sliceAudioFileToSnippet } from "@/lib/media-bunny-slicer";
import { canonicalGenreName } from "@/lib/music-genres";
import {
  useOpenVerseQuery,
  useProjectsQuery,
  useSubmitOpenVerseMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/$genre/$id")({
  component: OpenVerseDetailPage,
});

const formatSlot = ({
  end,
  start,
}: {
  end: number | null;
  start: number | null;
}) => {
  if (start === null || end === null) {
    return "Artist will confirm the slot";
  }

  const seconds = (value: number) => Math.round(value / 1000);

  return `${seconds(start)}s - ${seconds(end)}s`;
};

function OpenVerseDetailPage() {
  const { id } = Route.useParams(),
    query = useOpenVerseQuery(id),
    tracksQuery = useTracksQuery({ limit: 5 }),
    projectsQuery = useProjectsQuery({ limit: 5 }),
    submitMutation = useSubmitOpenVerseMutation(id),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    [assetId, setAssetId] = useState(""),
    [selectedMixedFile, setSelectedMixedFile] = useState<File | null>(null),
    [selectedVocalFile, setSelectedVocalFile] = useState<File | null>(null),
    [selectedStemFile, setSelectedStemFile] = useState<File | null>(null),
    [isDownloadingSnippet, setIsDownloadingSnippet] = useState(false),
    [message, setMessage] = useState(""),
    [acceptedSubId, setAcceptedSubId] = useState<string | null>(null),
    mixedInputRef = useRef<HTMLInputElement | null>(null),
    vocalInputRef = useRef<HTMLInputElement | null>(null),
    stemInputRef = useRef<HTMLInputElement | null>(null),
    listing = query.data,
    totalArtistUploads =
      (tracksQuery.data?.items?.length ?? 0) +
      (projectsQuery.data?.items?.length ?? 0),
    hasUploadedMusic = totalArtistUploads > 0,
    handleAcceptSubmission = (subId: string, artistName: string) => {
      setAcceptedSubId(subId);
      toast({
        description: `${artistName} has been added to official track credits & royalty splits.`,
        title: "Contender Accepted!",
      });
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
        cover: listing.coverArtUrl ?? "/placeholder.svg",
        id: listing.trackId,
        src: listing.playbackUrl,
        title: listing.trackTitle,
        trackHref: `/tracks/${listing.trackId}`,
      };

      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    },
    handleDownloadHookStub = async () => {
      if (!listing?.playbackUrl) {
        toast({
          description: "Audio preview not ready yet.",
          title: "Download unavailable",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsDownloadingSnippet(true);
        toast({
          description: "Preparing MediaBunny audio snippet (Hook & Open Slot)...",
          title: "Extracting Audio Stub",
        });

        const startSec = listing.slotStartsAtMs
          ? Math.round(listing.slotStartsAtMs / 1000)
          : 30;
        const endSec = listing.slotEndsAtMs
          ? Math.round(listing.slotEndsAtMs / 1000)
          : 75;

        const snippetFile = await sliceAudioFileToSnippet(
          listing.playbackUrl,
          startSec,
          endSec,
          `${listing.trackTitle.toLowerCase().replaceAll(/[^a-z0-9]/gu, "-")}-hook-slot-stub.wav`
        );

        const url = URL.createObjectURL(snippetFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = snippetFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          description: `Downloaded "${snippetFile.name}". Open in your DAW to record your take!`,
          title: "Hook Snippet Downloaded",
        });
      } catch (err) {
        toast({
          description: "Could not slice snippet. Please try downloading again.",
          title: "Snippet Extraction Failed",
          variant: "destructive",
        });
      } finally {
        setIsDownloadingSnippet(false);
      }
    },
    submitVerse = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedMixedFile && !selectedVocalFile && !assetId.trim()) {
        toast({
          description: "Please attach at least your Mixed Audition Take (.wav / .mp3).",
          title: "Audio Take Required",
          variant: "destructive",
        });
        return;
      }

      submitMutation.mutate({
        assetId:
          selectedMixedFile?.name ??
          selectedVocalFile?.name ??
          (assetId.trim() || undefined),
        message: message.trim() || undefined,
      });
    };

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading open verse...
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
            className="flex aspect-video items-center justify-center bg-muted bg-cover bg-center relative group"
            style={{
              backgroundImage: listing.coverArtUrl
                ? `url(${listing.coverArtUrl})`
                : undefined,
            }}
          >
            <Button
              disabled={!listing.playbackUrl}
              onClick={playListing}
              size="icon"
              type="button"
              className="size-14 rounded-full shadow-2xl hover:scale-105 transition"
            >
              <PlayCircle className="size-8" />
            </Button>
          </div>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
                  {listing.title}
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  {listing.artistName} opened a slot on {listing.trackTitle}.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="gap-2 shrink-0 border-primary/40 text-primary hover:bg-primary/10 font-bold"
                onClick={handleDownloadHookStub}
                disabled={isDownloadingSnippet}
              >
                {isDownloadingSnippet ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download Hook & Open Slot (.WAV)
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
                {formatSlot({
                  end: listing.slotEndsAtMs,
                  start: listing.slotStartsAtMs,
                })}
              </Badge>
            </div>
            {listing.description && (
              <p className="text-sm leading-6 text-muted-foreground">
                {listing.description}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Creator Vocal Submissions Review Desk */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Mic2 className="size-5 text-primary" />
                  Submitted Vocal Takes & Contenders
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Listen to submitted verse recordings, select your favorite
                  contender, and automatically add them to track credits &
                  splits.
                </p>
              </div>
              <Badge variant="secondary">2 Submissions</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                artistName: "Marcus Key",
                id: "sub_1",
                message:
                  "Fire 16-bar verse recorded over your hook! Vocal stems ready.",
                status: "submitted",
                timeAgo: "2 hours ago",
                username: "marcuskey",
              },
              {
                artistName: "Aria Vance",
                id: "sub_2",
                message: "Smooth R&B harmony layer + second verse vocals.",
                status: "accepted",
                timeAgo: "1 day ago",
                username: "ariavance",
              },
            ].map((sub) => {
              const isAccepted =
                acceptedSubId === sub.id || sub.status === "accepted";
              return (
                <div
                  key={sub.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                    isAccepted
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-border/40 bg-card/40 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {sub.artistName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm truncate">
                          {sub.artistName}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          @{sub.username}
                        </span>
                        {isAccepted && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                            <CheckCircle2 className="size-3" />
                            Added to Credits
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        "{sub.message}"
                      </p>
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                        Submitted {sub.timeAgo}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({
                          description:
                            "Auditioning vocal stem synced to open verse slot...",
                          title: `Playing ${sub.artistName}'s Vocal Take`,
                        });
                      }}
                    >
                      <PlayCircle className="mr-1.5 size-4 text-primary" />
                      Play Vocal Take
                    </Button>
                    <Button
                      size="sm"
                      disabled={isAccepted}
                      variant={isAccepted ? "secondary" : "default"}
                      onClick={() =>
                        handleAcceptSubmission(sub.id, sub.artistName)
                      }
                    >
                      {isAccepted ? (
                        <>
                          <UserCheck className="mr-1.5 size-4 text-emerald-400" />
                          Accepted
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1.5 size-4" />
                          Accept & Credit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-6">
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle>Submit Your Verse</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasUploadedMusic ? (
              /* Anti-Leech Guard: Requires at least 1 track or project uploaded */
              <div className="space-y-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                  <Music2 className="size-5" />
                </div>
                <h4 className="font-bold text-sm text-foreground">
                  Artist Profile Required
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To participate in Open Verses, you must have at least 1 track
                  or project uploaded to establish your SoundKit music identity.
                </p>
                <Button asChild size="sm" className="w-full font-bold mt-2">
                  <Link to="/dashboard/tracks/new">
                    <Plus className="size-3.5 mr-1.5" />
                    Upload Your First Track
                  </Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submitVerse}>
                {/* 3-Part Take Submission Uploaders */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      1. Mixed Audition (Hook + Vocal Mixdown) *
                    </Label>
                    <input
                      type="file"
                      accept="audio/*,.wav,.mp3,.m4a,.aac"
                      ref={mixedInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedMixedFile(file);
                          setAssetId(file.name);
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed h-14 flex items-center justify-center gap-2 hover:bg-accent/40 text-xs"
                      onClick={() => mixedInputRef.current?.click()}
                    >
                      {selectedMixedFile ? (
                        <span className="truncate max-w-[240px] text-primary font-bold">
                          ✓ {selectedMixedFile.name}
                        </span>
                      ) : (
                        <>
                          <Upload className="size-4 text-muted-foreground" />
                          <span>Attach Mixed Audition (.mp3, .wav)</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      2. Raw Dry Vocal Take (.wav)
                    </Label>
                    <input
                      type="file"
                      accept="audio/*,.wav,.aif,.flac"
                      ref={vocalInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedVocalFile(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed h-14 flex items-center justify-center gap-2 hover:bg-accent/40 text-xs"
                      onClick={() => vocalInputRef.current?.click()}
                    >
                      {selectedVocalFile ? (
                        <span className="truncate max-w-[240px] text-primary font-bold">
                          ✓ {selectedVocalFile.name}
                        </span>
                      ) : (
                        <>
                          <FileAudio className="size-4 text-muted-foreground" />
                          <span>Attach Dry Vocal (.wav)</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      3. Vocal Stems / DAW Project (Optional)
                    </Label>
                    <input
                      type="file"
                      accept=".zip,.rar,.tar,.wav"
                      ref={stemInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedStemFile(file);
                        }
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed h-14 flex items-center justify-center gap-2 hover:bg-accent/40 text-xs"
                      onClick={() => stemInputRef.current?.click()}
                    >
                      {selectedStemFile ? (
                        <span className="truncate max-w-[240px] text-primary font-bold">
                          ✓ {selectedStemFile.name}
                        </span>
                      ) : (
                        <>
                          <FileArchive className="size-4 text-muted-foreground" />
                          <span>Attach Stems Archive (.zip)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="message" className="text-xs font-semibold">
                    Message to Creator
                  </Label>
                  <Textarea
                    id="message"
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell the artist about your verse concept, flow, and inspiration..."
                    value={message}
                    rows={3}
                    className="text-xs"
                  />
                </div>

                <Button
                  className="w-full font-bold"
                  disabled={submitMutation.isPending}
                  type="submit"
                >
                  {submitMutation.isPending ? (
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 size-4" />
                  )}
                  Submit 3-Part Take
                </Button>
                {submitMutation.isSuccess && (
                  <p className="text-sm text-emerald-400 font-medium text-center">
                    Vocal take submitted successfully!
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
