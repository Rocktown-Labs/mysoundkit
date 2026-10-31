/* eslint-disable one-var, sort-vars, no-script-url -- Negative fixtures verify that script URLs are rejected. */
import { describe, expect, it } from "vitest";

import type { PlayerTrack } from "../components/audio-player-provider";
import {
  getYouTubeVideoId,
  isDirectVideoUrl,
  isStoredVideoMetadata,
  videoQueueItem,
} from "./player-media";
import { completeQueuedTrack } from "./player-queue";

const video = {
  artist: "Artist",
  externalPlaybackUrl: "https://www.youtube.com/watch?v=4U4tFM8iapc",
  posterUrl: "/poster.jpg",
  title: "Video",
  verifiedOnPlatform: false,
  videoHref: "/videos/one",
  videoId: "one",
};

describe("mixed media queue", () => {
  it.each([
    "https://www.youtube.com/watch?list=abc&v=4U4tFM8iapc",
    "https://youtu.be/4U4tFM8iapc?t=30",
    "https://www.youtube-nocookie.com/embed/4U4tFM8iapc",
  ])("normalizes supported YouTube links: %s", (url) => {
    expect(getYouTubeVideoId(url)).toBe("4U4tFM8iapc");
  });
  it.each([
    "https://youtube.com.attacker.test/watch?v=4U4tFM8iapc",
    "https://attacker.test/?url=youtu.be/4U4tFM8iapc",
    "javascript:4U4tFM8iapc",
    "https://youtube.com/watch?v=bad",
  ])("rejects unsupported embeds: %s", (url) => {
    expect(getYouTubeVideoId(url)).toBeNull();
  });
  it("rejects persisted video metadata without a supported source", () => {
    expect(
      isStoredVideoMetadata({
        externalPlaybackUrl: "javascript:alert(1)",
        verifiedOnPlatform: false,
        videoId: "one",
      })
    ).toBe(false);
    expect(
      isStoredVideoMetadata({
        muxPlaybackId: "validMuxId123",
        verifiedOnPlatform: true,
        videoId: "one",
      })
    ).toBe(true);
    expect(isDirectVideoUrl("/media/recording.mp4?token=dummy")).toBe(true);
    expect(isDirectVideoUrl("javascript:recording.mp4")).toBe(false);
  });
  it("advances song to YouTube video to hosted video and back to a song", () => {
    const first: PlayerTrack = {
      artist: "Artist",
      id: "song-one",
      src: "/one.mp3",
      title: "Song one",
    };
    const last: PlayerTrack = { ...first, id: "song-two", title: "Song two" };
    const youtube = videoQueueItem(video);
    const hosted = videoQueueItem({
      ...video,
      externalPlaybackUrl: null,
      muxPlaybackId: "validMuxId123",
      videoId: "two",
    });
    if (!youtube || !hosted) {
      throw new Error("Video fixture is invalid");
    }
    const songEnd = completeQueuedTrack({
      currentTrack: first,
      queue: [first, youtube, hosted, last],
      repeatMode: "off",
    });
    expect(songEnd.nextTrack).toEqual(youtube);
    const youtubeEnd = completeQueuedTrack({
      currentTrack: youtube,
      queue: songEnd.queue,
      repeatMode: "off",
    });
    expect(youtubeEnd.nextTrack).toEqual(hosted);
    const hostedEnd = completeQueuedTrack({
      currentTrack: hosted,
      queue: youtubeEnd.queue,
      repeatMode: "off",
    });
    expect(hostedEnd.nextTrack).toEqual(last);
    expect(hostedEnd.queue).toEqual([last]);
  });
  it("gives videos distinct identities from tracks and preserves repeat modes", () => {
    const item = videoQueueItem(video);
    if (!item) {
      throw new Error("Video fixture is invalid");
    }
    expect(item.id).toBe("video:one");
    expect(
      completeQueuedTrack({
        currentTrack: item,
        queue: [item],
        repeatMode: "one",
      }).restartCurrent
    ).toBe(true);
  });
});
