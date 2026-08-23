import type { PlayerTrack } from "../components/audio-player-provider";

export type RepeatMode = "all" | "off" | "one";

export interface CompletedQueueState {
  nextTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  restartCurrent: boolean;
}

export const privatePreviewQueue = (track: PlayerTrack): PlayerTrack[] => [
  track,
];

export const completeQueuedTrack = ({
  currentTrack,
  queue,
  repeatMode,
}: {
  currentTrack: PlayerTrack;
  queue: PlayerTrack[];
  repeatMode: RepeatMode;
}): CompletedQueueState => {
  if (repeatMode === "one") {
    return { nextTrack: currentTrack, queue, restartCurrent: true };
  }

  const currentIndex = queue.findIndex((track) => track.id === currentTrack.id),
    sequentialNextTrack =
      currentIndex === -1
        ? (queue[0] ?? null)
        : (queue[currentIndex + 1] ?? null),
    remainingQueue = queue.filter((track) => track.id !== currentTrack.id);

  if (repeatMode === "all") {
    if (remainingQueue.length === 0) {
      return { nextTrack: currentTrack, queue, restartCurrent: true };
    }

    return {
      nextTrack: sequentialNextTrack ?? remainingQueue[0] ?? null,
      queue: [...remainingQueue, currentTrack],
      restartCurrent: false,
    };
  }

  return {
    nextTrack: sequentialNextTrack
      ? (remainingQueue.find((track) => track.id === sequentialNextTrack.id) ??
        null)
      : null,
    queue: remainingQueue,
    restartCurrent: false,
  };
};

export const shouldRestartCurrentTrack = ({
  currentIndex,
  currentTime,
  queueLength,
}: {
  currentIndex: number;
  currentTime: number;
  queueLength: number;
}) => currentTime > 3 || queueLength <= 1 || currentIndex <= 0;
