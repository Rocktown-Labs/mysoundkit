import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye, Lock, Radio, ShieldCheck, Video } from "lucide-react";

import { VideoCard } from "@/components/explore/video-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SoundKitVideoPlayer } from "@/components/video/soundkit-video-player";
import { getMockVideo, mockVideos } from "@/lib/mock-videos";

export const Route = createFileRoute("/_explore/videos/$id")({
  component: VideoDetailPage,
});

function VideoDetailPage() {
  const router = useRouter();
  const { id } = Route.useParams();
  const video = getMockVideo(id);
  const relatedVideos = mockVideos
    .filter((entry) => entry.id !== video.id)
    .slice(0, 3);
  const isPremiumLive = video.playbackPolicy === "premium_only_live";

  return (
    <div className="space-y-6 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="w-fit"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={video.status === "live" ? "destructive" : "secondary"}
              >
                {video.status === "live"
                  ? "Live"
                  : video.videoKind.replaceAll("_", " ")}
              </Badge>
              <Badge className="bg-black/80 text-white">
                {video.verifiedOnPlatform ? (
                  <>
                    <ShieldCheck className="mr-1 size-3.5 text-emerald-400" />
                    SoundKit Verified
                  </>
                ) : (
                  "External Source"
                )}
              </Badge>
              {isPremiumLive ? (
                <Badge className="bg-black/70 text-white">
                  <Lock className="mr-1 size-3" />
                  Premium while live
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {video.creator.name}
              </p>
              <h1 className="text-2xl font-bold md:text-4xl">{video.title}</h1>
            </div>

            <SoundKitVideoPlayer
              externalPlaybackUrl={video.externalPlaybackUrl}
              muxPlaybackId={video.muxPlaybackId}
              posterUrl={video.thumbnail}
              title={video.title}
              verifiedOnPlatform={video.verifiedOnPlatform}
            />

            <div className="flex flex-wrap gap-3">
              {video.status === "live" && isPremiumLive ? (
                <Button>Upgrade to Watch</Button>
              ) : (video.externalPlaybackUrl ? (
                <Button asChild={true}>
                  <a
                    href={video.externalPlaybackUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Watch Source Video
                  </a>
                </Button>
              ) : (
                <Button disabled={video.muxPlaybackId === null}>
                  Play on SoundKit
                </Button>
              ))}
            </div>
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="size-4" />
                  {video.viewCount} views
                </span>
                <span className="flex items-center gap-1">
                  {video.status === "live" ? (
                    <Radio className="size-4 text-red-500" />
                  ) : (
                    <Video className="size-4" />
                  )}
                  {video.duration}
                </span>
              </div>
              <p className="text-sm text-muted-foreground md:text-base">
                {video.description}
              </p>
              <p className="text-sm text-muted-foreground">
                {video.verifiedOnPlatform
                  ? "This asset was uploaded directly to SoundKit and will receive the verified treatment anywhere it appears in the app."
                  : "This asset is linked from an external host. Fans can still discover it on SoundKit, but it is not marked as an on-platform upload."}
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">More Videos</h2>
            <Link to="/videos" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {relatedVideos.map((relatedVideo) => (
              <VideoCard
                key={relatedVideo.id}
                compact={true}
                video={relatedVideo}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
