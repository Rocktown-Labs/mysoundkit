import type {
  MerchProductCategory,
  PublicMerchDesign,
  PublicPhysicalRelease,
  TrackSummary,
} from "@/lib/soundkit-api-hooks";

export type ShopCategoryFilter =
  | "accessories"
  | "all"
  | "apparel"
  | "cd"
  | "digital"
  | "dvd"
  | "home"
  | "merch"
  | "vinyl";

export type ShopSortOption = "featured" | "newest" | "price-asc" | "price-desc";

export interface ShopCategoryTab {
  id: ShopCategoryFilter;
  label: string;
}

export const SHOP_CATEGORY_TABS: ShopCategoryTab[] = [
  { id: "all", label: "All" },
  { id: "merch", label: "All Merch" },
  { id: "apparel", label: "Apparel" },
  { id: "accessories", label: "Accessories" },
  { id: "home", label: "Home & Living" },
  { id: "vinyl", label: "Vinyl" },
  { id: "cd", label: "CDs" },
  { id: "dvd", label: "DVDs" },
  { id: "digital", label: "Digital" },
];

export const PHYSICAL_FORMAT_LABELS: Record<
  "cd" | "digital" | "dvd" | "vinyl_12" | "vinyl_7",
  string
> = {
  cd: "Audio CD",
  digital: "Digital Download",
  dvd: "DVD",
  vinyl_12: '12" Vinyl',
  vinyl_7: '7" Vinyl',
};

export const formatShopPrice = (cents: number | null | undefined) => {
  const safeCents = typeof cents === "number" ? cents : 199;
  return `$${(safeCents / 100).toFixed(2)}`;
};

export const formatTechniqueLabel = (technique: string | null | undefined) => {
  if (!technique) {
    return "Printed";
  }
  const normalized = technique.toLowerCase();
  if (normalized === "embroidery") {
    return "Embroidered";
  }
  if (normalized === "sublimation") {
    return "Sublimation";
  }
  return "Printed";
};

export interface MerchColorOption {
  color: string;
  colorCode: string;
  mockupUrl: string | null;
}

export const getUniqueMerchColors = (
  variants: PublicMerchDesign["variantDetails"]
): MerchColorOption[] => {
  const map = new Map<string, MerchColorOption>();
  for (const variant of variants) {
    const key = variant.colorCode ?? variant.color;
    if (!key || map.has(key)) {
      continue;
    }
    map.set(key, {
      color: variant.color ?? "Default",
      colorCode: variant.colorCode ?? "#27272a",
      mockupUrl: variant.mockupUrl ?? null,
    });
  }
  return [...map.values()];
};

export const getSizesForMerchColor = (
  variants: PublicMerchDesign["variantDetails"],
  colorCode: string | null
) =>
  variants.filter(
    (v) => v.inStock && (colorCode === null || v.colorCode === colorCode)
  );

export const matchesMerchCategory = (
  merch: PublicMerchDesign,
  filter: ShopCategoryFilter
): boolean => {
  if (filter === "all" || filter === "merch") {
    return true;
  }
  const category: MerchProductCategory = merch.category ?? "Apparel";
  if (filter === "apparel") {
    return category === "Apparel";
  }
  if (filter === "accessories") {
    return category === "Accessories";
  }
  if (filter === "home") {
    return category === "Home & living";
  }
  return false;
};

export const matchesPhysicalCategory = (
  release: PublicPhysicalRelease,
  filter: ShopCategoryFilter
): boolean => {
  if (filter === "all") {
    return true;
  }
  if (filter === "vinyl") {
    return (
      release.mediaFormat === "vinyl_12" || release.mediaFormat === "vinyl_7"
    );
  }
  if (filter === "cd") {
    return release.mediaFormat === "cd";
  }
  if (filter === "dvd") {
    return release.mediaFormat === "dvd";
  }
  return false;
};

export type UnifiedShopItem =
  | {
      createdAt: number;
      kind: "merch";
      merch: PublicMerchDesign;
      priceCents: number;
      title: string;
    }
  | {
      createdAt: number;
      kind: "release";
      priceCents: number;
      release: PublicPhysicalRelease;
      title: string;
    }
  | {
      createdAt: number;
      kind: "track";
      priceCents: number;
      title: string;
      track: TrackSummary;
    };

export const buildUnifiedShopItems = ({
  category,
  genre,
  merchDesigns,
  physicalReleases,
  query,
  sort,
  tracks,
}: {
  category: ShopCategoryFilter;
  genre: string;
  merchDesigns: PublicMerchDesign[];
  physicalReleases: PublicPhysicalRelease[];
  query: string;
  sort: ShopSortOption;
  tracks: TrackSummary[];
}): UnifiedShopItem[] => {
  const normalizedQuery = query.trim().toLowerCase(),
    matchesQuery = (parts: (string | null | undefined)[]) => {
      if (!normalizedQuery) {
        return true;
      }
      return parts.some((part) =>
        part?.toLowerCase().includes(normalizedQuery)
      );
    },
    items: UnifiedShopItem[] = [];

  for (const merch of merchDesigns) {
    if (!matchesMerchCategory(merch, category)) {
      continue;
    }
    if (
      !matchesQuery([
        merch.title,
        merch.artistName,
        merch.brand,
        merch.catalogProductName,
        merch.description,
      ])
    ) {
      continue;
    }
    items.push({
      createdAt: merch.publishedAt ? Date.parse(merch.publishedAt) || 0 : 0,
      kind: "merch",
      merch,
      priceCents: merch.retailPriceCents,
      title: merch.title,
    });
  }

  for (const release of physicalReleases) {
    if (!matchesPhysicalCategory(release, category)) {
      continue;
    }
    if (genre !== "all" && release.genreSlug && release.genreSlug !== genre) {
      continue;
    }
    if (
      !matchesQuery([
        release.title,
        release.artistName,
        release.projectTitle,
        release.description,
        PHYSICAL_FORMAT_LABELS[release.mediaFormat],
      ])
    ) {
      continue;
    }
    items.push({
      createdAt: Date.parse(release.createdAt) || 0,
      kind: "release",
      priceCents: release.retailPriceCents,
      release,
      title: release.title,
    });
  }

  if (category === "all" || category === "digital") {
    for (const track of tracks) {
      if (!track.isForSale) {
        continue;
      }
      if (!matchesQuery([track.title, track.artistName, track.genre])) {
        continue;
      }
      items.push({
        createdAt: 0,
        kind: "track",
        priceCents: track.priceCents ?? 199,
        title: track.title,
        track,
      });
    }
  }

  if (sort === "price-asc") {
    items.sort((a, b) => a.priceCents - b.priceCents);
  } else if (sort === "price-desc") {
    items.sort((a, b) => b.priceCents - a.priceCents);
  } else if (sort === "newest") {
    items.sort((a, b) => b.createdAt - a.createdAt);
  }

  return items;
};
