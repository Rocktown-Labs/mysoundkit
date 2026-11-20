import { describe, expect, it } from "vitest";

import type {
  PublicMerchDesign,
  PublicPhysicalRelease,
  TrackSummary,
} from "@/lib/soundkit-api-hooks";

import {
  buildUnifiedShopItems,
  formatShopPrice,
  getUniqueMerchColors,
  matchesMerchCategory,
  matchesPhysicalCategory,
} from "./shop-model";

const sampleMerch: PublicMerchDesign = {
    artistName: "Pat B",
    artistUsername: "patb",
    brand: "Comfort Colors",
    catalogProductId: "cat-1",
    catalogProductName: "Comfort Colors 1717 Heavyweight Tee",
    category: "Apparel",
    description: "Heavyweight tee",
    id: "merch-1",
    mockups: [
      {
        catalogVariantId: "v-black-m",
        mockupUrl: "https://cdn.example/black.png",
      },
      {
        catalogVariantId: "v-sage-m",
        mockupUrl: "https://cdn.example/sage.png",
      },
    ],
    placement: "front",
    previewMockupUrl: "https://cdn.example/black.png",
    productType: "T-SHIRT",
    projectId: null,
    publishedAt: "2026-11-18T00:00:00.000Z",
    retailPriceCents: 3200,
    technique: "dtg",
    title: "Multiverse Tour Tee",
    trackId: null,
    variantDetails: [
      {
        color: "Black",
        colorCode: "#111111",
        id: "v-black-m",
        inStock: true,
        mockupUrl: "https://cdn.example/black.png",
        size: "M",
      },
      {
        color: "Black",
        colorCode: "#111111",
        id: "v-black-l",
        inStock: true,
        mockupUrl: "https://cdn.example/black.png",
        size: "L",
      },
      {
        color: "Sage",
        colorCode: "#6b7d6a",
        id: "v-sage-m",
        inStock: true,
        mockupUrl: "https://cdn.example/sage.png",
        size: "M",
      },
    ],
  },
  sampleVinyl: PublicPhysicalRelease = {
    artistName: "Pat B",
    artistUsername: "patb",
    coverArtUrl: "https://cdn.example/album.jpg",
    createdAt: "2026-11-19T00:00:00.000Z",
    currency: "USD",
    description: "Limited 180g pressing",
    genreName: "Hip-Hop",
    genreSlug: "hip-hop",
    id: "rel-vinyl-1",
    includesDigitalDownload: true,
    mediaFormat: "vinyl_12",
    projectId: "proj-1",
    projectTitle: "Multiverse",
    retailPriceCents: 3800,
    siblingFormats: [],
    title: "Multiverse LP",
    trackId: null,
    videoId: null,
  },
  sampleDvd: PublicPhysicalRelease = {
    ...sampleVinyl,
    id: "rel-dvd-1",
    mediaFormat: "dvd",
    retailPriceCents: 2200,
    title: "Live in Little Rock DVD",
    videoId: "vid-1",
  },
  sampleTrack = {
    artistName: "Pat B",
    artistUsername: "patb",
    coverArtUrl: "https://cdn.example/track.jpg",
    duration: "3:01",
    genre: "Hip-Hop",
    id: "track-1",
    isForSale: true,
    plays: 120,
    priceCents: 199,
    regionSlug: "us-arkansas",
    slug: "take-my-hands",
    title: "Take My Hands",
  } as unknown as TrackSummary;

describe("shop-model", () => {
  it("formats prices cleanly", () => {
    expect(formatShopPrice(3200)).toBe("$32.00");
    expect(formatShopPrice(199)).toBe("$1.99");
  });

  it("deduplicates merch colors while preserving mockup URLs", () => {
    const colors = getUniqueMerchColors(sampleMerch.variantDetails);
    expect(colors).toHaveLength(2);
    expect(colors[0]?.color).toBe("Black");
    expect(colors[1]?.mockupUrl).toBe("https://cdn.example/sage.png");
  });

  it("filters merch and physical categories accurately", () => {
    expect(matchesMerchCategory(sampleMerch, "apparel")).toBe(true);
    expect(matchesMerchCategory(sampleMerch, "accessories")).toBe(false);
    expect(matchesPhysicalCategory(sampleVinyl, "vinyl")).toBe(true);
    expect(matchesPhysicalCategory(sampleVinyl, "dvd")).toBe(false);
    expect(matchesPhysicalCategory(sampleDvd, "dvd")).toBe(true);
  });

  it("combines, filters, and sorts unified shop items", () => {
    const allAsc = buildUnifiedShopItems({
      category: "all",
      genre: "all",
      merchDesigns: [sampleMerch],
      physicalReleases: [sampleVinyl, sampleDvd],
      query: "",
      sort: "price-asc",
      tracks: [sampleTrack],
    });

    expect(allAsc.map((item) => item.kind)).toEqual([
      "track",
      "release",
      "merch",
      "release",
    ]);

    const vinylOnly = buildUnifiedShopItems({
      category: "vinyl",
      genre: "all",
      merchDesigns: [sampleMerch],
      physicalReleases: [sampleVinyl, sampleDvd],
      query: "multiverse",
      sort: "featured",
      tracks: [sampleTrack],
    });

    expect(vinylOnly).toHaveLength(1);
    expect(vinylOnly[0]?.kind).toBe("release");
  });
});
