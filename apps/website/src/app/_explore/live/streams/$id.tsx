import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Play, Radio, Video } from "lucide-react";

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

export const Route = createFileRoute("/_explore/live/streams/$id")({
  component: StreamDetailPage,
});

function StreamDetailPage() {
  const { id } = Route.useParams();
  const isReplay = id === "stream-breakdown";

  return (
    <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,2fr)_360px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border">
          <div className="relative aspect-video">
            <AppImage
              alt="Creator stream"
              className="h-full w-full object-cover"
              height={720}
              src={
                isReplay
                  ? "/rap-battle-crowd.jpg"
                  : "/music-battle-video-thumbnail.jpg"
              }
              width={1280}
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Play className="ml-1 size-8 fill-current" />
              </div>
            </div>
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge variant={isReplay ? "secondary" : "destructive"}>
                {isReplay ? "Replay" : "Live"}
              </Badge>
              <Badge variant="secondary">
                {isReplay ? "Completed Session" : "Premium Live Access"}
              </Badge>
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
              <h1 className="text-3xl font-bold">
                {isReplay
                  ? "Mix Review, Playback, and Live Notes"
                  : "Beat Making From The First Drum Hit"}
              </h1>
              <p className="text-muted-foreground">
                {isReplay
                  ? "Replay-ready creator stream"
                  : "Premium live creator stream"}
              </p>
            </div>
          </div>
          <p className="max-w-3xl text-muted-foreground">
            {isReplay
              ? "This surface adapts into replay mode once the broadcast ends, so viewers can jump back into the session without needing a separate page type."
              : "While the creator is live, premium members can watch the full broadcast in real time. When the session wraps, this same page can shift into replay mode."}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-5" />
                Access Model
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Live video is premium only, while completed broadcasts can stay
              available for broader playback after the event.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5" />
                Flexible Stream State
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The same page can represent upcoming, live, or replay states with
              the same core media-first layout.
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-5" />
              Stream Status
            </CardTitle>
            <CardDescription>
              {isReplay
                ? "This session is available as a replay."
                : "Upgrade to join while the stream is still live."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border p-3 text-sm text-muted-foreground">
              {isReplay
                ? "Replay viewers can jump to highlights, recap moments, and finished playback."
                : "Live viewers get the active stream, creator interaction, and the full in-progress broadcast."}
            </div>
            <Button className="w-full">
              {isReplay ? "Watch Replay" : "Upgrade To Watch"}
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link to="/live/streams">Back to Streams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
