import { createFileRoute } from "@tanstack/react-router";
import { Heart, ListPlus, Music2, Sparkles } from "lucide-react";

import { ListeningPartyCard } from "@/components/explore/listening-party-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_explore/live/parties/")({
  component: LivePartiesPage,
});

function LivePartiesPage() {
  return (
    <div className="space-y-8 pb-8">
      <section>
        <h2 className="text-2xl font-bold">Join A Listening Party</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Listening parties can be a single album shared with the whole room or
          a two-album faceoff that alternates track by track. Either way, the
          room stays in sync and the actions stay simple.
        </p>
      </section>

      <section className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 md:min-w-0 md:gap-6">
          <ListeningPartyCard
            albumCovers={[
              "/summer-music-album-cover.png",
              "/night-music-album-cover.png",
            ]}
            currentTrack="Spotlight Album - Track 3"
            hostName="SoundKit Curators"
            id="single-album-party"
            listenerCount={4210}
            title="Single Album Spotlight"
          />
          <ListeningPartyCard
            albumCovers={[
              "/hip-hop-album-cover.png",
              "/summer-music-album-cover.png",
              "/night-music-album-cover.png",
            ]}
            currentTrack="Album A Track 2 vs Album B Track 2"
            hostName="A&R Live Room"
            id="album-faceoff"
            listenerCount={2890}
            title="Alternating Album Faceoff"
          />
          <ListeningPartyCard
            albumCovers={[
              "/night-music-album-cover.png",
              "/hip-hop-album-cover.png",
            ]}
            currentTrack="Unreleased Track 5"
            hostName="Indie Discovery Club"
            id="indie-discovery"
            listenerCount={1630}
            title="New Music Discovery Session"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="size-5" />
              Single Album Rooms
            </CardTitle>
            <CardDescription>
              One release, one queue, one shared chat.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The room hears the same album together from front to back, reacts in
            chat, and saves favorites after each track finishes.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Album Faceoff Rooms
            </CardTitle>
            <CardDescription>
              Album 1 track 1, then album 2 track 1, all the way through.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Perfect for comparing two new projects in public. Listeners hear one
            track from each album, react, then move to the next pair.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="size-5" />
              Like The Track
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Quick reactions stay lightweight so the room keeps moving.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="size-5" />
              Save For Later
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Save individual songs the second the track lands for you.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListPlus className="size-5" />
              Add To Playlist
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Build playlists live as the room alternates from track to track.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
