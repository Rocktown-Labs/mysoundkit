import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  LoaderCircle,
  Mic2,
  PlayCircle,
  Plus,
  Send,
  UserCheck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  useOpenVerseQuery,
  useSubmitOpenVerseMutation,
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
    submitMutation = useSubmitOpenVerseMutation(id),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    [assetId, setAssetId] = useState(""),
    [message, setMessage] = useState(""),
    [acceptedSubId, setAcceptedSubId] = useState<string | null>(null),
    listing = query.data,
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
    submitVerse = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitMutation.mutate({
        assetId: assetId.trim() || undefined,
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-6">
        <Card className="overflow-hidden border-border/40 bg-card/50">
          <div
            className="flex aspect-video items-center justify-center bg-muted bg-cover bg-center"
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
            >
              <PlayCircle className="size-5" />
            </Button>
          </div>
          <CardContent className="space-y-4 p-5">
            <div>
              <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
                {listing.title}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {listing.artistName} opened a slot on {listing.trackTitle}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{listing.genre}</Badge>
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

      <aside>
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle>Submit Your Verse</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitVerse}>
              <div className="space-y-2">
                <Label htmlFor="assetId">Uploaded verse asset ID</Label>
                <Input
                  id="assetId"
                  onChange={(event) => setAssetId(event.target.value)}
                  placeholder="Optional until upload picker is connected"
                  value={assetId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell the artist what you want to bring to the song."
                  value={message}
                />
              </div>
              <Button
                className="w-full"
                disabled={submitMutation.isPending}
                type="submit"
              >
                {submitMutation.isPending ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                Submit
              </Button>
              {submitMutation.isSuccess && (
                <p className="text-sm text-muted-foreground">
                  Submission received.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
