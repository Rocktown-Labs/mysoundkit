import { describe, expect, it } from "vitest";

import { mediaImageSrcProps } from "./image-derivatives";

describe("media image srcset builder", () => {
  const mediaUrl = "https://media.mysoundkit.com/media/uploads/user/cover.png";

  it("builds the full derivative candidate list for media images", () => {
    const result = mediaImageSrcProps(mediaUrl);
    expect(result).toEqual({
      sizes: "(max-width: 768px) 100vw, 640px",
      srcSet: [
        `${mediaUrl}.320w.webp 320w`,
        `${mediaUrl}.640w.webp 640w`,
        `${mediaUrl}.1280w.webp 1280w`,
      ].join(", "),
    });
  });

  it("preserves encoded path segments", () => {
    const encoded =
        "https://media.mysoundkit.com/media/uploads/user/cover%20art.jpg",
      result = mediaImageSrcProps(encoded);
    expect(result?.srcSet).toContain(`${encoded}.640w.webp 640w`);
  });

  it.each([
    "/placeholder.svg",
    "blob:https://mysoundkit.com/abc",
    "data:image/png;base64,AAAA",
    "https://cdn.example.com/photo.png",
    "https://media.mysoundkit.com/v1/uploads/user/cover.png",
    `${mediaUrl}?signature=abc`,
  ])("returns null for unsupported src %s", (src) => {
    expect(mediaImageSrcProps(src)).toBeNull();
  });

  it("ignores extension-less media objects", () => {
    expect(
      mediaImageSrcProps("https://media.mysoundkit.com/media/uploads/user/file")
    ).toBeNull();
  });
});
