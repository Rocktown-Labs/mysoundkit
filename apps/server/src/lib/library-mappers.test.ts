import { describe, expect, it } from "vitest";

import {
  toPurchasedCatalogItem,
  toWatchedItemType,
  watchedSourceTypes,
} from "./library-mappers";

describe("library mappers", () => {
  it("uses project ids for purchased project catalog rows", () => {
    const item = toPurchasedCatalogItem({
      id: "purchase_1",
      licenseOptionId: null,
      priceCents: "12.50",
      productType: "project",
      projectId: "project_1",
      purchasedAt: new Date("2026-07-15T00:00:00.000Z"),
      title: "Project Purchase",
      trackId: null,
    });

    expect(item).toMatchObject({
      id: "project_1",
      productId: "project_1",
      productType: "project",
      purchaseMode: "digital_download",
    });
  });

  it("keeps track ids and download URLs for purchased track rows", () => {
    const item = toPurchasedCatalogItem({
      id: "purchase_2",
      licenseOptionId: "license_1",
      priceCents: "5.00",
      productType: "track",
      projectId: null,
      purchasedAt: new Date("2026-07-15T00:00:00.000Z"),
      title: "Track Purchase",
      trackId: "track_1",
    });

    expect(item).toMatchObject({
      downloadUrl: "/downloads/track_1",
      id: "track_1",
      productId: "track_1",
      productType: "track",
      purchaseMode: "license",
    });
  });

  it("maps watched source types to the routes exposed by the library UI", () => {
    expect(watchedSourceTypes).toEqual([
      "battle",
      "vod",
      "listening_party",
      "community",
    ]);
    expect(toWatchedItemType("battle")).toBe("battle");
    expect(toWatchedItemType("vod")).toBe("video");
    expect(toWatchedItemType("listening_party")).toBe("party");
    expect(toWatchedItemType("community")).toBe("community");
  });
});
