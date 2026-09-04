/* eslint-disable one-var, sort-vars */
import { afterEach, describe, expect, it } from "vitest";

import {
  objectUrlFromMetadata,
  publicAssetUrl,
  publicAssetUrlFromParts,
  publicProfileAssetUrl,
} from "./asset-urls";

const originalMediaPublicUrl = process.env.MEDIA_PUBLIC_URL;

afterEach(() => {
  if (originalMediaPublicUrl === undefined) {
    delete process.env.MEDIA_PUBLIC_URL;
    return;
  }

  process.env.MEDIA_PUBLIC_URL = originalMediaPublicUrl;
});

describe("public asset URLs", () => {
  it("uses the current media host for durable object keys", () => {
    process.env.MEDIA_PUBLIC_URL = "https://media.mysoundkit.com/media/";

    expect(
      publicAssetUrlFromParts({
        metadata: {
          url: "https://api-pr-75.mysoundkit.com/media/uploads/user/cover.jpg",
        },
        objectKey: "uploads/user/cover.jpg",
      })
    ).toBe("https://media.mysoundkit.com/media/uploads/user/cover.jpg");
  });

  it("canonicalizes profile object keys instead of stale preview URLs", () => {
    process.env.MEDIA_PUBLIC_URL = "https://media.mysoundkit.com/media";

    expect(
      publicProfileAssetUrl({
        fallbackUrl: "https://media-pr-43.mysoundkit.com/profiles/avatar.jpg",
        objectKey: "profiles/user/avatar.jpg",
      })
    ).toBe("https://media.mysoundkit.com/media/profiles/user/avatar.jpg");
  });

  it("encodes object-key characters without changing path separators", () => {
    process.env.MEDIA_PUBLIC_URL = "https://media.mysoundkit.com/media";

    expect(
      publicProfileAssetUrl({
        objectKey: "profiles/user/cover art #1.jpg",
      })
    ).toBe(
      "https://media.mysoundkit.com/media/profiles/user/cover%20art%20%231.jpg"
    );
  });

  it("keeps metadata URLs as a legacy fallback", () => {
    process.env.MEDIA_PUBLIC_URL = "https://media.mysoundkit.com";

    expect(
      publicAssetUrl({
        metadata: { url: "https://legacy.example/cover.jpg" },
        objectKey: null,
      })
    ).toBe("https://legacy.example/cover.jpg");
    expect(objectUrlFromMetadata({ url: 42 })).toBeNull();
  });
});
