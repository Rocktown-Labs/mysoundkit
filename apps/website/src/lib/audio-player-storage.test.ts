import { describe, expect, it } from "vitest";

import {
  AUDIO_PLAYER_STORAGE_KEY,
  createEmptyPlayerState,
  isSafeUrl,
  migrateLegacyPlayerStorage,
  readStoredPlayerState,
  sanitizePlayerStateForStorage,
} from "./audio-player-storage";
import type { PlayerTrack } from "./audio-player-storage";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

const blobTrack: PlayerTrack = {
    artist: "Local Artist",
    id: "track-blob",
    src: "blob:https://mysoundkit.com/temp-id",
    title: "Temp Recording",
  },
  sampleTrack: PlayerTrack = {
    artist: "SoundKit Artist",
    id: "track-1",
    src: "https://media.mysoundkit.com/track-1.mp3",
    title: "Track One",
  };

describe("audio-player-storage", () => {
  it("returns fresh empty state objects so instances cannot share mutable arrays", () => {
    const first = createEmptyPlayerState(),
      second = createEmptyPlayerState();

    first.queue.push(sampleTrack);
    expect(second.queue).toEqual([]);
    expect(first).not.toBe(second);
  });

  it("migrates legacy unscoped storage into the scoped key once without dropping data", () => {
    const payload = JSON.stringify({
        currentTrack: sampleTrack,
        queue: [sampleTrack],
        recentlyPlayed: [],
        repeatMode: "all",
        visible: true,
      }),
      scopedKey = `${AUDIO_PLAYER_STORAGE_KEY}:user-1`,
      storage = createMemoryStorage({
        [AUDIO_PLAYER_STORAGE_KEY]: payload,
      });

    expect(migrateLegacyPlayerStorage(storage, scopedKey)).toBe(true);
    expect(storage.getItem(AUDIO_PLAYER_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(scopedKey)).toBe(payload);

    expect(readStoredPlayerState(storage, scopedKey)).toMatchObject({
      currentTrack: { id: sampleTrack.id },
      repeatMode: "all",
      visible: true,
    });
  });

  it("preserves existing scoped data during legacy migration", () => {
    const scopedKey = `${AUDIO_PLAYER_STORAGE_KEY}:user-1`,
      scopedPayload = JSON.stringify({
        currentTrack: sampleTrack,
        queue: [],
        recentlyPlayed: [],
        repeatMode: "one",
        visible: true,
      }),
      storage = createMemoryStorage({
        [AUDIO_PLAYER_STORAGE_KEY]: JSON.stringify({ visible: false }),
        [scopedKey]: scopedPayload,
      });

    expect(migrateLegacyPlayerStorage(storage, scopedKey)).toBe(true);
    expect(storage.getItem(scopedKey)).toBe(scopedPayload);
    expect(storage.getItem(AUDIO_PLAYER_STORAGE_KEY)).toBeNull();
  });

  it("discards unowned legacy data without restoring it into the anonymous scope", () => {
    const anonymousKey = `${AUDIO_PLAYER_STORAGE_KEY}:anonymous`,
      storage = createMemoryStorage({
        [AUDIO_PLAYER_STORAGE_KEY]: JSON.stringify({
          currentTrack: sampleTrack,
        }),
      });

    expect(migrateLegacyPlayerStorage(storage, anonymousKey)).toBe(false);
    expect(storage.getItem(AUDIO_PLAYER_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(anonymousKey)).toBeNull();
  });

  it("strips unplayable blob: tracks before persisting to storage", () => {
    const sanitized = sanitizePlayerStateForStorage({
      currentTrack: blobTrack,
      queue: [sampleTrack, blobTrack],
      recentlyPlayed: [blobTrack, sampleTrack],
      repeatMode: "off",
      visible: true,
    });

    expect(sanitized.currentTrack).toBeNull();
    expect(sanitized.visible).toBe(false);
    expect(sanitized.queue).toEqual([sampleTrack]);
    expect(sanitized.recentlyPlayed).toEqual([sampleTrack]);
  });

  it("rejects dangerous URL schemes on track src, links, and cover art", () => {
    const scriptUrl = ["javascript", "alert(1)"].join(":"),
      storage = createMemoryStorage({
        [`${AUDIO_PLAYER_STORAGE_KEY}:user-1`]: JSON.stringify({
          currentTrack: {
            ...sampleTrack,
            artistHref: scriptUrl,
          },
          queue: [
            { ...sampleTrack, id: "bad-src", src: scriptUrl },
            {
              ...sampleTrack,
              cover: "data:text/html,<script>",
              id: "bad-cover",
            },
            { ...sampleTrack, id: "bad-href", trackHref: "//evil.com/phish" },
            {
              ...sampleTrack,
              artistHref: "/artist/demo",
              cover: "/images/cover.jpg",
              id: "good-relative",
              trackHref: "/tracks/1",
            },
          ],
          recentlyPlayed: [],
          repeatMode: "invalid",
          visible: true,
        }),
      });

    expect(
      readStoredPlayerState(storage, `${AUDIO_PLAYER_STORAGE_KEY}:user-1`)
    ).toMatchObject({
      currentTrack: null,
      queue: [{ id: "good-relative" }],
      repeatMode: "off",
      visible: false,
    });
  });

  it("rejects browser-stripped URL separators across stored track fields", () => {
    for (const separator of ["\t", "\n", "\r"]) {
      const unsafeUrl = `/${separator}/evil.com/phish`;
      expect(isSafeUrl(unsafeUrl)).toBe(false);
      for (const field of ["src", "artistHref", "trackHref", "cover"]) {
        const sanitized = sanitizePlayerStateForStorage({
          currentTrack: { ...sampleTrack, [field]: unsafeUrl },
          queue: [{ ...sampleTrack, [field]: unsafeUrl }],
          recentlyPlayed: [{ ...sampleTrack, [field]: unsafeUrl }],
          repeatMode: "off",
          visible: true,
        });
        expect(sanitized.currentTrack).toBeNull();
        expect(sanitized.queue).toEqual([]);
        expect(sanitized.recentlyPlayed).toEqual([]);
      }
    }
  });

  it("no-ops when scopedStorageKey aliases the legacy storage key", () => {
    const payload = JSON.stringify({ visible: true }),
      storage = createMemoryStorage({
        [AUDIO_PLAYER_STORAGE_KEY]: payload,
      });

    expect(migrateLegacyPlayerStorage(storage, AUDIO_PLAYER_STORAGE_KEY)).toBe(
      false
    );
    expect(storage.getItem(AUDIO_PLAYER_STORAGE_KEY)).toBe(payload);
  });
});
