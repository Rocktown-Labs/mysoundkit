import { describe, expect, it } from "vitest";

import {
  IMAGE_DERIVATIVE_WIDTHS,
  imageDerivativeObjectKey,
  isLikelyImageObjectKey,
  parseImageDerivativeObjectKey,
} from "./image-derivative-keys";

describe("image derivative object keys", () => {
  it("derives keys and round-trips every supported width", () => {
    for (const widthPx of IMAGE_DERIVATIVE_WIDTHS) {
      const key = imageDerivativeObjectKey(
        "uploads/user/1786-cover.png",
        widthPx
      );
      expect(key).toBe(`uploads/user/1786-cover.png.${widthPx}w.webp`);
      expect(parseImageDerivativeObjectKey(key)).toEqual({
        baseObjectKey: "uploads/user/1786-cover.png",
        widthPx,
      });
    }
  });

  it("rejects keys without the derivative suffix", () => {
    expect(parseImageDerivativeObjectKey("uploads/user/cover.png")).toBeNull();
    expect(parseImageDerivativeObjectKey("uploads/user/cover.webp")).toBeNull();
    expect(parseImageDerivativeObjectKey("profiles/a/avatar.png")).toBeNull();
  });

  it("rejects malformed derivative suffixes", () => {
    expect(parseImageDerivativeObjectKey("cover.png.0w.webp")).toBeNull();
    expect(parseImageDerivativeObjectKey("cover.png.-1w.webp")).toBeNull();
    expect(parseImageDerivativeObjectKey("cover.png.abcw.webp")).toBeNull();
    expect(parseImageDerivativeObjectKey(".webp")).toBeNull();
  });

  it("detects likely image keys by extension", () => {
    expect(isLikelyImageObjectKey("uploads/a/b/cover.png")).toBe(true);
    expect(isLikelyImageObjectKey("uploads/a/b/cover.JPG")).toBe(true);
    expect(isLikelyImageObjectKey("profiles/a/avatar.webp")).toBe(true);
    expect(isLikelyImageObjectKey("uploads/a/b/master.wav")).toBe(false);
    expect(isLikelyImageObjectKey("uploads/a/b/no-extension")).toBe(false);
  });
});
