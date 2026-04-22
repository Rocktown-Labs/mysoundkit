import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Video } from "lucide-react";

import { VideoCard } from "@/components/explore/video-card";
import { Button } from "@/components/ui/button";
import { mockVideos } from "@/lib/mock-videos";

export const Route = createFileRoute("/_explore/videos/")({
  component: VideosPage,
});

function VideosPage() {
  const router = useRouter();

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back
      </Button>

      <div className="mb-8 space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl lg:text-4xl">
          <Video className="size-6 text-primary md:size-8" />
          Videos
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Watch official music videos, battle replays, teasers, and premium live
          recordings once they wrap.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mockVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}
