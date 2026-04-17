import { createFileRoute } from "@tanstack/react-router";
import { Lock, PlayCircle, Radio, Video } from "lucide-react";

import { StreamCard } from "@/components/explore/stream-card";
import { AppImage } from "@/components/ui/app-image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
});

function LiveStreamsPage() {
  return (
    <div className="space-y-8 pb-8">
      <section>
        <h2 className="text-2xl font-bold">Creator Streams</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Live streams can flex between creator broadcasts, studio sessions, and
          replay states. The surface should feel adaptable whether the session
          is happening right now or has already wrapped.
        </p>
      </section>

      <section className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 md:min-w-0 md:gap-6">
          <StreamCard
            category="Studio"
            creatorAvatar="/diverse-user-avatars.png"
            creatorName="Metro Boomin"
            id="stream-studio"
            thumbnailUrl="/music-battle-video-thumbnail.jpg"
            title="Beat making from the first drum hit"
            viewerCount={15_400}
          />
          <StreamCard
            category="Performance"
            creatorAvatar="/diverse-user-avatars.png"
            creatorName="Ariana"
            id="stream-performance"
            thumbnailUrl="/hip-hop-battle-stage.jpg"
            title="Live vocal session and audience Q&A"
            viewerCount={32_100}
          />
          <StreamCard
            category="Talkback"
            creatorAvatar="/diverse-user-avatars.png"
            creatorName="Mike Dean"
            id="stream-breakdown"
            thumbnailUrl="/rap-battle-crowd.jpg"
            title="Mix review, playback, and live notes"
            viewerCount={8500}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-5" />
              Premium Live Access
            </CardTitle>
            <CardDescription>
              Active live video stays premium gated.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Premium members get into the live room while the creator is
            streaming. Non-subscribers can still find the finished content once
            the live session is over.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="size-5" />
              Replay-Ready Layout
            </CardTitle>
            <CardDescription>
              One page pattern that handles live and completed states.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The same stream page can show a live player, a recap state, clips,
            or a finished replay without needing a separate UI pattern.
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="relative aspect-video">
            <AppImage
              alt="Creator stream replay"
              className="h-full w-full object-cover"
              height={360}
              src="/music-battle-video-thumbnail.jpg"
              width={640}
            />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-5" />
              Replay Queue
            </CardTitle>
            <CardDescription>
              Finished sessions ready for playback after the live room closes.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="overflow-hidden">
          <div className="relative aspect-video">
            <AppImage
              alt="Creator stream control room"
              className="h-full w-full object-cover"
              height={360}
              src="/rap-battle-crowd.jpg"
              width={640}
            />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="size-5" />
              Adaptable Stream Surface
            </CardTitle>
            <CardDescription>
              Built to work for live, replay, or upcoming creator sessions.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
