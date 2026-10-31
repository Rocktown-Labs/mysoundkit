/* eslint-disable one-var, sort-vars */
import { ListPlus, Pause, Play } from "lucide-react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { AppImage } from "@/components/ui/app-image";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { videoQueueItem } from "@/lib/player-media";
import type { PlayerVideoMetadata } from "@/lib/player-media";

export function QueuedVideoPreview(
  props: PlayerVideoMetadata & {
    artist: string;
    artistHref?: string | null;
    posterUrl: string;
    title: string;
    videoHref: string;
  }
) {
  const {
    addToQueue,
    currentTrack,
    isPlaying,
    queue,
    setCurrentTrack,
    setIsPlaying,
    setQueue,
    togglePlay,
  } = useAudioPlayer();
  const item = videoQueueItem(props);
  const isCurrent = item?.id === currentTrack?.id;
  const playNow = () => {
    if (!item) {
      return;
    }
    if (isCurrent) {
      togglePlay();
      return;
    }
    const preserved = queue.filter((entry) => entry.id !== item.id);
    if (
      currentTrack &&
      !preserved.some((entry) => entry.id === currentTrack.id)
    ) {
      preserved.unshift(currentTrack);
    }
    setQueue([item, ...preserved]);
    setIsPlaying(false);
    setCurrentTrack(item);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="queued-video-preview">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
        <AppImage
          alt={`${props.title} video poster`}
          className="size-full object-cover"
          height={720}
          src={props.posterUrl}
          width={1280}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Button
            aria-label={isCurrent && isPlaying ? "Pause video" : "Play video"}
            disabled={!item}
            onClick={playNow}
            size="lg"
          >
            {isCurrent && isPlaying ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {isCurrent && isPlaying ? "Pause video" : "Play video"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">
          {isCurrent
            ? "Now playing in your queue. Keep watching as you browse."
            : "Play now or add this video to your music queue."}
        </p>
        <Button
          disabled={!item}
          onClick={() => {
            if (!item) {
              return;
            }
            const added = addToQueue(item);
            toast({
              description: added
                ? `${item.title} will play in your queue.`
                : "This video is already in your queue.",
              title: added ? "Added to queue" : "Already queued",
            });
          }}
          variant="outline"
        >
          <ListPlus aria-hidden="true" />
          Add to queue
        </Button>
      </div>
    </div>
  );
}
