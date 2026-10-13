/* eslint-disable one-var, sort-vars */
export interface PlayerTrack {
  album?: string;
  artist: string;
  artistHref?: string | null;
  cover?: string | null;
  duration?: number | null;
  id: string;
  lyrics?: string | null;
  src: string;
  title: string;
  trackHref?: string | null;
}

export type RepeatMode = "all" | "off" | "one";

/**
 * Calculates next track and updated queue state when a track finishes or skips.
 */
export function advanceQueue({
  currentTrack,
  queue,
  repeatMode,
}: {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  repeatMode: RepeatMode;
}): {
  nextTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  restartCurrent: boolean;
} {
  if (repeatMode === "one" && currentTrack) {
    return {
      nextTrack: currentTrack,
      queue,
      restartCurrent: true,
    };
  }

  if (queue.length === 0) {
    if (repeatMode === "all" && currentTrack) {
      return {
        nextTrack: currentTrack,
        queue: [],
        restartCurrent: true,
      };
    }
    return {
      nextTrack: null,
      queue: [],
      restartCurrent: false,
    };
  }

  const [next, ...remaining] = queue;

  if (repeatMode === "all" && currentTrack) {
    return {
      nextTrack: next,
      queue: [...remaining, currentTrack],
      restartCurrent: false,
    };
  }

  return {
    nextTrack: next,
    queue: remaining,
    restartCurrent: false,
  };
}

/**
 * Cycles through repeat modes: off -> all -> one -> off
 */
export function cycleRepeatMode(current: RepeatMode): RepeatMode {
  if (current === "off") {
    return "all";
  }
  if (current === "all") {
    return "one";
  }
  return "off";
}

/**
 * Formats a duration in seconds to standard MM:SS display.
 */
export function formatPlayerTime(seconds: number): string {
  if (Number.isNaN(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

/**
 * Formats remaining time in seconds to negative countdown display (-M:SS).
 */
export function formatRemainingTime(current: number, total: number): string {
  if (Number.isNaN(total) || total <= 0) {
    return "-0:00";
  }
  const remaining = Math.max(0, total - current);
  return `-${formatPlayerTime(remaining)}`;
}

/**
 * Deterministically shuffles an array without mutating input.
 */
export function shuffleTracks(tracks: PlayerTrack[]): PlayerTrack[] {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}
