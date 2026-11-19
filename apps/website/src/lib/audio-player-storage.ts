import { isStoredVideoMetadata } from "./player-media";
import type { PlayerVideoMetadata } from "./player-media";

export const AUDIO_PLAYER_STORAGE_KEY = "soundkit.audio-player.v1",
  RECENTLY_PLAYED_LIMIT = 20;

export interface PlayerTrack {
  album?: string;
  artist: string;
  artistHref?: string | null;
  autoplay?: boolean;
  cover?: string | null;
  duration?: number | null;
  id: string;
  mediaType?: "audio" | "video";
  sourceType?: "battle" | "library" | "listening_party" | "vod";
  src: string;
  title: string;
  trackHref?: string | null;
  video?: PlayerVideoMetadata;
}

export type PlayerRepeatMode = "all" | "off" | "one";

export interface StoredPlayerState {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  recentlyPlayed: PlayerTrack[];
  repeatMode: PlayerRepeatMode;
  visible: boolean;
}

export function createEmptyPlayerState(): StoredPlayerState {
  return {
    currentTrack: null,
    queue: [],
    recentlyPlayed: [],
    repeatMode: "off",
    visible: false,
  };
}

export function isPlayableSrc(src: unknown): src is string {
  // blob: URLs die with the tab session that created them, so never persist or
  // restore them via localStorage (they render broken art and reject playback).
  return typeof src === "string" && src.length > 0 && !src.startsWith("blob:");
}

export function isPlayerTrack(value: unknown): value is PlayerTrack {
  if (!(value && typeof value === "object")) {
    return false;
  }

  const track = value as Partial<PlayerTrack>;

  return (
    (track.mediaType === undefined ||
      track.mediaType === "audio" ||
      (track.mediaType === "video" && isStoredVideoMetadata(track.video))) &&
    typeof track.artist === "string" &&
    typeof track.id === "string" &&
    isPlayableSrc(track.src) &&
    typeof track.title === "string"
  );
}

export function sanitizePlayerStateForStorage(
  state: StoredPlayerState
): StoredPlayerState {
  const currentTrack =
    state.currentTrack && isPlayerTrack(state.currentTrack)
      ? state.currentTrack
      : null;

  return {
    currentTrack,
    queue: state.queue.filter(isPlayerTrack),
    recentlyPlayed: state.recentlyPlayed
      .filter(isPlayerTrack)
      .slice(0, RECENTLY_PLAYED_LIMIT),
    repeatMode: state.repeatMode,
    visible: state.visible && currentTrack !== null,
  };
}

export function migrateLegacyPlayerStorage(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  scopedStorageKey: string,
  options?: { removeLegacy?: boolean }
): boolean {
  const removeLegacy = options?.removeLegacy ?? true;

  try {
    const legacyRaw = storage.getItem(AUDIO_PLAYER_STORAGE_KEY);
    if (!legacyRaw) {
      return false;
    }

    if (!storage.getItem(scopedStorageKey)) {
      storage.setItem(scopedStorageKey, legacyRaw);
    }

    if (removeLegacy) {
      storage.removeItem(AUDIO_PLAYER_STORAGE_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

function parseStoredPlayerJson(raw: string): StoredPlayerState {
  const parsed = JSON.parse(raw) as {
    currentTrack?: unknown;
    queue?: unknown;
    recentlyPlayed?: unknown;
    repeatMode?: unknown;
    visible?: unknown;
  };

  return {
    currentTrack: isPlayerTrack(parsed.currentTrack)
      ? { ...parsed.currentTrack, autoplay: false }
      : null,
    queue: Array.isArray(parsed.queue)
      ? parsed.queue.filter(isPlayerTrack)
      : [],
    recentlyPlayed: Array.isArray(parsed.recentlyPlayed)
      ? parsed.recentlyPlayed
          .filter(isPlayerTrack)
          .slice(0, RECENTLY_PLAYED_LIMIT)
      : [],
    repeatMode:
      parsed.repeatMode === "all" || parsed.repeatMode === "one"
        ? parsed.repeatMode
        : "off",
    visible: parsed.visible === true && isPlayerTrack(parsed.currentTrack),
  };
}

export function readStoredPlayerState(
  storage: Pick<Storage, "getItem">,
  storageKey: string
): StoredPlayerState {
  try {
    const raw = storage.getItem(storageKey);

    if (!raw) {
      return createEmptyPlayerState();
    }

    return parseStoredPlayerJson(raw);
  } catch {
    return createEmptyPlayerState();
  }
}

export function appendRecentlyPlayed(
  history: PlayerTrack[],
  track: PlayerTrack
): PlayerTrack[] {
  return [track, ...history.filter((item) => item.id !== track.id)].slice(
    0,
    RECENTLY_PLAYED_LIMIT
  );
}
