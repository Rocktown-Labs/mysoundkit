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

export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  // Browsers remove these characters before resolving URLs. Reject them
  // before checking relative paths so an embedded separator cannot hide // or /\\.
  if (["\t", "\n", "\r"].some((character) => value.includes(character))) {
    return false;
  }

  // Allow same-origin relative paths while rejecting protocol-relative // and /\
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.startsWith("/\\");
  }

  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function isPlayableSrc(src: unknown): src is string {
  // Reject blob: (session-scoped) and non-http(s)/relative schemes.
  return isSafeUrl(src);
}

function isOptionalSafeUrl(value: unknown): boolean {
  return (
    value === undefined || value === null || value === "" || isSafeUrl(value)
  );
}

function normalizeRepeatMode(value: unknown): PlayerRepeatMode {
  return value === "all" || value === "one" ? value : "off";
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
    typeof track.title === "string" &&
    isOptionalSafeUrl(track.artistHref) &&
    isOptionalSafeUrl(track.trackHref) &&
    isOptionalSafeUrl(track.cover)
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
    repeatMode: normalizeRepeatMode(state.repeatMode),
    visible: state.visible && currentTrack !== null,
  };
}

export function migrateLegacyPlayerStorage(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  scopedStorageKey: string
): boolean {
  if (scopedStorageKey === AUDIO_PLAYER_STORAGE_KEY) {
    return false;
  }

  try {
    const legacyRaw = storage.getItem(AUDIO_PLAYER_STORAGE_KEY);
    if (!legacyRaw) {
      return false;
    }

    // Unscoped history has no owner and must never enter an anonymous queue.
    if (scopedStorageKey === `${AUDIO_PLAYER_STORAGE_KEY}:anonymous`) {
      storage.removeItem(AUDIO_PLAYER_STORAGE_KEY);
      return false;
    }

    if (!storage.getItem(scopedStorageKey)) {
      storage.setItem(scopedStorageKey, legacyRaw);
    }

    storage.removeItem(AUDIO_PLAYER_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function buildStoredPlayerState(parsed: {
  currentTrack?: unknown;
  queue?: unknown;
  recentlyPlayed?: unknown;
  repeatMode?: unknown;
  visible?: unknown;
}): StoredPlayerState {
  const currentTrack = isPlayerTrack(parsed.currentTrack)
    ? { ...parsed.currentTrack, autoplay: false }
    : null;

  return {
    currentTrack,
    queue: Array.isArray(parsed.queue)
      ? parsed.queue.filter(isPlayerTrack)
      : [],
    recentlyPlayed: Array.isArray(parsed.recentlyPlayed)
      ? parsed.recentlyPlayed
          .filter(isPlayerTrack)
          .slice(0, RECENTLY_PLAYED_LIMIT)
      : [],
    repeatMode: normalizeRepeatMode(parsed.repeatMode),
    // Only restore visibility when there is a playable track to show.
    visible: parsed.visible === true && currentTrack !== null,
  };
}

function parseStoredPlayerJson(raw: string): StoredPlayerState {
  return buildStoredPlayerState(
    JSON.parse(raw) as {
      currentTrack?: unknown;
      queue?: unknown;
      recentlyPlayed?: unknown;
      repeatMode?: unknown;
      visible?: unknown;
    }
  );
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
