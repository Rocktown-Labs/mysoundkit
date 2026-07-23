import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Captions,
  Lock,
  MessageSquare,
  Play,
  Radio,
  Users,
  Video,
} from "lucide-react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import {
  LiveChatPanel,
  LiveLyricsPanel,
} from "@/components/live/live-room-panels";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveRoom } from "@/lib/live-room";

import { LivePreviewShowcase } from "../preview";

export const Route = createFileRoute("/_explore/live/streams/$id")({
  component: () => (
    <LivePreviewShowcase defaultTab="stream" defaultPerspective="viewer" />
  ),
});

function StreamDetailPage() {
  const { id } = Route.useParams();
  const { chat, query } = useLiveRoom(id);
  const room = query.data;
  const currentTrack = room?.tracklist.find(
    (track) => track.id === room.currentTrackId
  );

  if (query.isLoading || !room) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading live stream...
      </div>
    );
  }

  return (
    <LiveRoomAccessGuard roomTitle={room.title}>
      <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,1.8fr)_420px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="relative aspect-video">
              <AppImage
                alt={room.title}
                className="h-full w-full object-cover"
                height={720}
                src={
                  currentTrack?.coverArtUrl ??
                  "/music-battle-video-thumbnail.jpg"
                }
                width={1280}
              />
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <Play className="ml-1 size-8 fill-current" />
                </div>
              </div>
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge variant="destructive">Live</Badge>
                <Badge variant="secondary">Cloudflare Realtime ready</Badge>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarImage src="/diverse-user-avatars.png" />
                <AvatarFallback>SK</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold">{room.title}</h1>
                <p className="text-muted-foreground">
                  Hosted by {room.hostName}
                </p>
              </div>
            </div>
            <p className="max-w-3xl text-muted-foreground">{room.summary}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <Users className="mr-1 size-3" />
                {room.viewerCount.toLocaleString()} watching
              </Badge>
              <Badge variant="outline">
                <Radio className="mr-1 size-3" />
                Live room chat synced by Durable Objects
              </Badge>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="size-5" />
                  Access Model
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Stream playback can be backed by Cloudflare Stream signed URLs
                for paid or authenticated live sessions.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="size-5" />
                  Media Path
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Creator-to-audience video can move through Cloudflare
                RealtimeKit or Stream while room presence and chat stay
                coordinated at the edge.
              </CardContent>
            </Card>
          </section>

          <LiveLyricsPanel track={currentTrack} />
        </div>

        <aside className="space-y-6">
          <LiveChatPanel
            disabled={chat.isPending}
            messages={room.chat}
            onSend={(message) => chat.mutate({ message, userName: "You" })}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-5 text-primary" />
                Live Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Viewer count", room.viewerCount.toLocaleString()],
                ["Realtime chat", "Always on"],
                ["Captions", "Prepared"],
                ["Stream health", "Monitoring"],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  key={label}
                >
                  <span className="flex items-center gap-2">
                    {label === "Realtime chat" ? (
                      <MessageSquare className="size-4 text-primary" />
                    ) : (label === "Captions" ? (
                      <Captions className="size-4 text-primary" />
                    ) : (
                      <Activity className="size-4 text-primary" />
                    ))}
                    {label}
                  </span>
                  <Badge variant="outline">{value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Button asChild className="w-full" variant="outline">
            <Link to="/live/streams">Back to Streams</Link>
          </Button>
        </aside>
      </div>
    </LiveRoomAccessGuard>
  );
}
