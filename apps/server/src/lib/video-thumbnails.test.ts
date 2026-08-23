import { describe, expect, it } from "vitest";

import {
  resolveVideoThumbnailUrl,
  youtubeThumbnailUrl,
  youtubeVideoIdFromUrl,
} from "./video-thumbnails";

describe("video thumbnail resolution", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=12", "dQw4w9WgXcQ"],
    ["https://youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts the YouTube ID from %s", (url, expectedId) => {
    expect(youtubeVideoIdFromUrl(url)).toBe(expectedId);
  });

  it("rejects non-YouTube and malformed URLs", () => {
    expect(
      youtubeVideoIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ")
    ).toBeNull();
    expect(youtubeVideoIdFromUrl("not a URL")).toBeNull();
  });

  it("builds a reliable YouTube poster URL", () => {
    expect(
      youtubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("prefers explicit artwork, then Mux, then YouTube", () => {
    expect(
      resolveVideoThumbnailUrl({
        externalPlaybackUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        muxPlaybackId: "mux-playback",
        thumbnailUrl: "https://cdn.example.com/poster.jpg",
      })
    ).toBe("https://cdn.example.com/poster.jpg");

    expect(resolveVideoThumbnailUrl({ muxPlaybackId: "mux/playback" })).toBe(
      "https://image.mux.com/mux%2Fplayback/thumbnail.jpg"
    );

    expect(
      resolveVideoThumbnailUrl({
        externalPlaybackUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnailUrl: "/placeholder.svg",
      })
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
