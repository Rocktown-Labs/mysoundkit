import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Captions,
  Heart,
  ListPlus,
  MessageSquare,
  Music2,
  Radio,
  Timer,
  Users,
} from "lucide-react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import {
  LiveChatPanel,
  LiveLyricsPanel,
  LiveTrackQueue,
} from "@/components/live/live-room-panels";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveRoom } from "@/lib/live-room";

import { LivePreviewShowcase } from "../preview";

export const Route = createFileRoute("/_explore/live/parties/$id")({
  component: () => <LivePreviewShowcase defaultTab="party" defaultPerspective="viewer" />,
});

function ListeningPartyDetailPage() {
  const { id } = Route.useParams();
  const { chat, query } = useLiveRoom(id);
  const room = query.data;
  const currentTrack = room?.tracklist.find(
    (track) => track.id === room.currentTrackId
  );

  if (query.isLoading || !room) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading live room...
      </div>
    );
  }

  return (
    <LiveRoomAccessGuard roomTitle={room.title}>
      <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="relative aspect-video">
              <AppImage
                alt={currentTrack?.title ?? room.title}
                className="h-full w-full object-cover"
                height={720}
                src={currentTrack?.coverArtUrl ?? "/night-music-album-cover.png"}
                width={1280}
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge variant="destructive">
                  <span className="mr-2 size-2 rounded-full bg-white" />
                  Live
                </Badge>
                <Badge variant="secondary">Cloudflare Stream ready</Badge>
              </div>
              <div className="absolute bottom-5 left-5 right-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                  <span className="flex items-center gap-1">
                    <Radio className="size-4" />
                    Hosted by {room.hostName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-4" />
                    {room.viewerCount.toLocaleString()} listening
                  </span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white md:text-5xl">
                    {room.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-white/75">{room.summary}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-wrap gap-3">
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
          </section>

          <LiveLyricsPanel track={currentTrack} />
          <LiveTrackQueue tracks={room.tracklist} />
        </div>

        <aside className="space-y-6">
          <LiveChatPanel
            disabled={chat.isPending}
            messages={room.chat}
            onSend={(message) => chat.mutate({ message, userName: "You" })}
          />
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="size-4 text-primary" />
                  Host badges
                </span>
                <Badge>Artist</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm">
                  <Timer className="size-4 text-primary" />
                  Timestamp chat
                </span>
                <Badge variant="outline">@1:27</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm">
                  <Captions className="size-4 text-primary" />
                  Synced lyrics
                </span>
                <Badge variant="outline">Ready</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-2 text-sm">
                  <MessageSquare className="size-4 text-primary" />
                  Chat
                </span>
                <Badge>Always on</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-4">
              <Button asChild className="w-full" variant="outline">
                <Link to="/live/parties">Back to Parties</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </LiveRoomAccessGuard>
  );
}
