import { describe, expect, it } from "vitest";

import { trackAssetDescription, trackAssetLabel } from "./track-asset-labels";

describe("track asset labels", () => {
  it("names generated variants by purpose", () => {
    expect(
      trackAssetLabel({ assetKind: "variant_audio", purpose: "streaming" })
    ).toBe("SoundKit Stream");
    expect(
      trackAssetLabel({ assetKind: "variant_audio", purpose: "download" })
    ).toBe("Download Copy");
    expect(
      trackAssetLabel({
        assetKind: "variant_audio",
        purpose: "lossless_download",
      })
    ).toBe("Lossless Download");
  });

  it("explains that battle playback reuses the stream", () => {
    expect(
      trackAssetDescription({
        assetKind: "variant_audio",
        purpose: "streaming",
      })
    ).toContain("streams and battles");
  });
});
