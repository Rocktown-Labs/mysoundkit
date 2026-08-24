import { describe, expect, it } from "vitest";

import { isPublicTrackArtwork } from "./media-access";

const asset = (overrides: {
  assetKind?: string | null;
  purpose?: string | null;
}) => ({
  assetKind: overrides.assetKind ?? null,
  purpose: overrides.purpose ?? null,
});

describe("public track artwork authorization", () => {
  it("accepts v2-pipeline artwork rows", () => {
    expect(isPublicTrackArtwork(asset({ purpose: "artwork" }))).toBe(true);
  });

  it("accepts legacy cover rows with a NULL purpose", () => {
    expect(isPublicTrackArtwork(asset({ assetKind: "cover_art" }))).toBe(true);
  });

  it("accepts legacy cover rows carrying both markers", () => {
    expect(
      isPublicTrackArtwork(
        asset({ assetKind: "cover_art", purpose: "artwork" })
      )
    ).toBe(true);
  });

  it("rejects private asset kinds even when marked artwork-adjacent", () => {
    expect(isPublicTrackArtwork(asset({ assetKind: "master" }))).toBe(false);
    expect(isPublicTrackArtwork(asset({ assetKind: "stems" }))).toBe(false);
    expect(isPublicTrackArtwork(asset({ purpose: "streaming" }))).toBe(false);
  });

  it("rejects rows with neither marker", () => {
    expect(isPublicTrackArtwork(asset({}))).toBe(false);
  });
});
