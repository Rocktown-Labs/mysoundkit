import type { playbackSessions } from "@soundkit/db/schema/app";

export const fallbackArtistSlug = "artist";
export const fallbackCover = "/placeholder.svg";

export const watchedSourceTypes = [
  "battle",
  "vod",
  "listening_party",
  "community",
] as const;

export const toWatchedItemType = (
  sourceType: typeof playbackSessions.$inferSelect.sourceType
) => {
  if (sourceType === "battle") {
    return "battle" as const;
  }

  if (sourceType === "vod") {
    return "video" as const;
  }

  if (sourceType === "listening_party") {
    return "party" as const;
  }

  if (sourceType === "community") {
    return "community" as const;
  }

  return "stream" as const;
};

export interface PurchasedCatalogRow {
  id: string;
  licenseOptionId: string | null;
  priceCents: number | string;
  productType: string;
  projectId: string | null;
  purchasedAt: Date;
  title: string;
  trackDownloadUrl?: string | null;
  trackId: string | null;
}

export const toPurchasedCatalogItem = (row: PurchasedCatalogRow) => {
  const priceCents = Math.round(Number(row.priceCents) * 100),
   productType: "track" | "project" =
    row.productType === "project" ? "project" : "track",
   purchaseMode: "digital_download" | "license" = row.licenseOptionId
    ? "license"
    : "digital_download",
   productId = row.trackId ?? row.projectId ?? row.id;

  return {
    artist: "SoundKit Artist",
    artistSlug: fallbackArtistSlug,
    cover: fallbackCover,
    downloadUrl: row.trackDownloadUrl ?? null,
    duration: null,
    id: productId,
    licenseName: row.licenseOptionId ? "Licensed Instrumental" : null,
    priceCents,
    priceLabel: `$${(priceCents / 100).toFixed(2)}`,
    productId,
    productType,
    purchaseMode,
    purchasedAt: row.purchasedAt.toISOString(),
    regionSlug: null,
    slug: null,
    title: row.title,
  };
};
