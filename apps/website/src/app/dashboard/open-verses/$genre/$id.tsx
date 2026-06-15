import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, PlayCircle, Send } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const { id } = Route.useParams();
  const query = useOpenVerseQuery(id);
  const submitMutation = useSubmitOpenVerseMutation(id);
  const { setCurrentTrack, setQueue } = useAudioPlayer();
  const [assetId, setAssetId] = useState("");
  const [message, setMessage] = useState("");
  const listing = query.data;

  const playListing = () => {
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
  };

  const submitVerse = (event: FormEvent<HTMLFormElement>) => {
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
