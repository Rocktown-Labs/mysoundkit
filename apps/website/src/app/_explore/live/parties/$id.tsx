import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ListPlus, MessageSquare, Music2, Users } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
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

export const Route = createFileRoute("/_explore/live/parties/$id")({
  component: ListeningPartyDetailPage,
});

function ListeningPartyDetailPage() {
  const { id } = Route.useParams();
  const isFaceoffParty = id === "album-faceoff";

  const queuedTracks = isFaceoffParty
    ? [
        {
          album: "Album One",
          art: "/hip-hop-album-cover.png",
          title: "Track 1",
        },
        {
          album: "Album Two",
          art: "/summer-music-album-cover.png",
          title: "Track 1",
        },
        {
          album: "Album One",
          art: "/hip-hop-album-cover.png",
          title: "Track 2",
        },
        {
          album: "Album Two",
          art: "/summer-music-album-cover.png",
          title: "Track 2",
        },
      ]
    : [
        {
          album: "Spotlight Album",
          art: "/night-music-album-cover.png",
          title: "Intro",
        },
        {
          album: "Spotlight Album",
          art: "/night-music-album-cover.png",
          title: "Track 2",
        },
        {
          album: "Spotlight Album",
          art: "/night-music-album-cover.png",
          title: "Track 3",
        },
        {
          album: "Spotlight Album",
          art: "/night-music-album-cover.png",
          title: "Track 4",
        },
      ];

  return (
    <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,2fr)_360px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="relative aspect-square md:aspect-auto">
              <AppImage
                alt="Listening party album art"
                className="h-full w-full object-cover"
                height={720}
                src={
                  isFaceoffParty
                    ? "/hip-hop-album-cover.png"
                    : "/night-music-album-cover.png"
                }
                width={720}
              />
            </div>
            <div className="relative aspect-square md:aspect-auto">
              <AppImage
                alt="Listening party secondary album art"
                className="h-full w-full object-cover"
                height={720}
                src={
                  isFaceoffParty
                    ? "/summer-music-album-cover.png"
                    : "/night-music-album-cover.png"
                }
                width={720}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                <Badge variant="destructive">Live</Badge>
                <Badge variant="secondary">
                  {isFaceoffParty ? "Album Faceoff" : "Single Album Session"}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Listening Party</Badge>
            <Badge variant="outline">
              <Users className="mr-1 size-3" />
              2,814 listeners
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              {isFaceoffParty
                ? "Alternating Album Faceoff"
                : "Single Album Spotlight"}
            </h1>
            <p className="max-w-3xl text-muted-foreground">
              {isFaceoffParty
                ? "Track pairs alternate between two releases so everyone can react, like, save, or add to a playlist before the next pair starts."
                : "The room is locked onto one album from front to back, with chat reactions and quick save actions after every track."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>
              <Heart className="mr-2 size-4" />
              Like Current Track
            </Button>
            <Button variant="secondary">
              <Music2 className="mr-2 size-4" />
              Save Song
            </Button>
            <Button variant="outline">
              <ListPlus className="mr-2 size-4" />
              Add To Playlist
            </Button>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Track Queue</CardTitle>
            <CardDescription>
              {isFaceoffParty
                ? "The room alternates album by album, track by track."
                : "The room is playing one album straight through."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {queuedTracks.map((track, index) => (
              <div
                key={`${track.album}-${track.title}`}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <AppImage
                  alt={track.album}
                  className="size-14 rounded-md object-cover"
                  height={56}
                  src={track.art}
                  width={56}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{track.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {track.album}
                  </p>
                </div>
                <Badge variant={index === 1 ? "default" : "secondary"}>
                  {index === 1 ? "Now Playing" : `Up Next ${index}`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              Live Chat
            </CardTitle>
            <CardDescription>
              Shared reactions stay in sync with the room.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "This transition is smooth.",
              "Saving this one immediately.",
              "Album two is pulling ahead for me.",
            ].map((message, index) => (
              <div key={message} className="flex gap-3">
                <Avatar className="size-9">
                  <AvatarImage src="/diverse-user-avatars.png" />
                  <AvatarFallback>SK</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-xl bg-muted p-3 text-sm">
                  <p className="font-medium">Listener {index + 1}</p>
                  <p className="mt-1 text-muted-foreground">{message}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Send a message..." />
              <Button size="sm">Send</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Party Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" variant="secondary">
              View Host Profile
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link to="/live/parties">Back to Parties</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
