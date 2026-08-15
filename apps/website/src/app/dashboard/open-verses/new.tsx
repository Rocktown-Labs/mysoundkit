import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { LoaderCircle, Plus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateOpenVerseMutation,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/new")({
  component: NewOpenVersePage,
});

function NewOpenVersePage() {
  const router = useRouter(),
   tracksQuery = useTracksQuery(),
   createMutation = useCreateOpenVerseMutation(),
   [trackId, setTrackId] = useState(""),
   [title, setTitle] = useState(""),
   [description, setDescription] = useState(""),
   [slotStartsAtMs, setSlotStartsAtMs] = useState(""),
   [slotEndsAtMs, setSlotEndsAtMs] = useState(""),
   selectedTrack = tracksQuery.data?.find((track) => track.id === trackId),

   publishOpenVerse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createMutation.mutate(
      {
        description: description.trim() || undefined,
        maxSubmissions: 50,
        slotEndsAtMs: slotEndsAtMs ? Number(slotEndsAtMs) * 1000 : undefined,
        slotStartsAtMs: slotStartsAtMs
          ? Number(slotStartsAtMs) * 1000
          : undefined,
        title: title.trim(),
        trackId,
      },
      {
        onSuccess: (listing) => {
          void router.navigate({
            params: { genre: listing.genreSlug, id: listing.id },
            to: "/dashboard/open-verses/$genre/$id",
          });
        },
      }
    );
  };

  return (
    <form className="max-w-3xl space-y-6" onSubmit={publishOpenVerse}>
      <div>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
          Publish Open Verse
        </h1>
        <p className="mt-1 text-muted-foreground">
          Select one of your uploaded tracks and invite artists to submit a
          verse.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Need to make the track first?</p>
          <p className="text-sm text-muted-foreground">
            Create a track, upload its audio and cover, then publish it here as
            an open verse listing.
          </p>
        </div>
        <Button asChild={true} variant="outline">
          <Link to="/dashboard/tracks/new">Create New Track</Link>
        </Button>
      </div>

      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <CardTitle>Track and Slot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="track">Track</Label>
            <Select onValueChange={setTrackId} value={trackId}>
              <SelectTrigger id="track">
                <SelectValue placeholder="Choose an uploaded track" />
              </SelectTrigger>
              <SelectContent>
                {(tracksQuery.data ?? []).map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {track.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tracksQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading tracks...</p>
            )}
            {!tracksQuery.isLoading &&
              (tracksQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You do not have uploaded tracks yet. Create a track first,
                  then return to publish it as an open verse.
                </p>
              )}
          </div>

          {selectedTrack && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{selectedTrack.genre}</Badge>
              {selectedTrack.bpm && (
                <Badge variant="outline">{selectedTrack.bpm} BPM</Badge>
              )}
              {selectedTrack.musicalKey && (
                <Badge variant="outline">{selectedTrack.musicalKey}</Badge>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Listing title</Label>
            <Input
              id="title"
              minLength={1}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Need a 16-bar rap verse"
              required={true}
              value={title}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Slot starts at seconds</Label>
              <Input
                id="start"
                min={0}
                onChange={(event) => setSlotStartsAtMs(event.target.value)}
                placeholder="64"
                type="number"
                value={slotStartsAtMs}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Slot ends at seconds</Label>
              <Input
                id="end"
                min={0}
                onChange={(event) => setSlotEndsAtMs(event.target.value)}
                placeholder="96"
                type="number"
                value={slotEndsAtMs}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Direction</Label>
            <Textarea
              id="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the voice, energy, theme, or reference you want."
              value={description}
            />
          </div>

          <Button
            disabled={!trackId || !title.trim() || createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Publish
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
