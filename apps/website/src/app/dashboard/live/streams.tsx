import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Radio, Video, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useVideosQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

function DashboardLiveStreamsPage() {
  const videosQuery = useVideosQuery();
  const videos = videosQuery.data ?? [];
  const liveRecordings = videos.filter(
    (video) => video.videoKind === "live_recording"
  );
  const processingVideos = videos.filter(
    (video) => video.status === "processing"
  );

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Creator Streams
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage live stream recordings and prepare Cloudflare Stream
            broadcasts.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/streams">Open Public Streams</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={Radio}
          label="Live Recordings"
          value={liveRecordings.length}
        />
        <MetricCard
          icon={Users}
          label="Processing"
          value={processingVideos.length}
        />
        <MetricCard icon={Video} label="Total Videos" value={videos.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Stream Library</CardTitle>
            <CardDescription>
              Real live recordings uploaded or linked in your video catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {videosQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading stream videos...
              </p>
            )}

            {!videosQuery.isLoading && liveRecordings.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Radio className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-semibold">No live recordings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with a verified video upload while Cloudflare Stream
                  live input creation is being connected.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/dashboard/videos/new">New Video</Link>
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {liveRecordings.map((video) => (
                <div
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={video.id}
                >
                  <div>
                    <p className="font-semibold">{video.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {video.sourceProvider} - {video.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{video.playbackPolicy}</Badge>
                    {video.externalPlaybackUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={video.externalPlaybackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 size-4" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Live</CardTitle>
            <CardDescription>
              Cloudflare Stream live inputs need account-level API credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              SoundKit is ready to use Cloudflare Stream for live broadcasts:
              create a Live Input, give the creator RTMPS/SRT/WebRTC publish
              details, and play back the resulting live feed in the public
              stream room.
            </div>
            <Button asChild className="w-full">
              <Link to="/dashboard/videos/new">
                <Video className="mr-2 size-4" />
                Upload Live Recording
              </Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <a
                href="https://developers.cloudflare.com/stream/stream-live/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cloudflare Stream Docs
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  );
}
