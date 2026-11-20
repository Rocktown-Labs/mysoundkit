import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  genres,
  projectAssets,
  projects,
  trackAssets,
  tracks,
  userProfiles,
  videos,
} from "@soundkit/db/schema/app";
import { physicalReleases } from "@soundkit/db/schema/commerce";
import type { PhysicalMediaFormat } from "@soundkit/db/schema/commerce";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, desc, eq, inArray } from "drizzle-orm";

import { publicAssetUrlFromParts } from "@/lib/asset-urls";

export type MerchProductCategory = "Accessories" | "Apparel" | "Home & living";

const ACCESSORY_TYPES = new Set([
    "BACKPACK",
    "BAG",
    "BEANIE",
    "CAP",
    "HAT",
    "JEWELRY",
    "SOCKS",
    "TOTEBAG",
    "VISOR",
  ]),
  APPAREL_TYPES = new Set([
    "DRESS",
    "HOODIE",
    "JACKET",
    "LEGGINGS",
    "LONGSLEEVE",
    "PANTS",
    "POLO",
    "SHIRT",
    "SHORTS",
    "SKIRT",
    "SPORTSBRA",
    "SWEATPANTS",
    "SWEATSHIRT",
    "SWIMWEAR",
    "TANKTOP",
    "TSHIRT",
    "UNDERWEAR",
    "ZIPHOODIE",
  ]),
  ACCESSORY_PATTERN =
    /\b(?:hats?|caps?|bags?|socks?|beanies?|backpacks?|totes?|visors?)\b/iu,
  APPAREL_PATTERN =
    /\b(?:t[ -]?shirts?|shirts?|hoodies?|sweatshirts?|sweatpants?|jackets?|pants|leggings?|shorts|dresses|tanks?|tees?)\b/iu;

export const classifyMerchCategory = (
  productType: string | null | undefined,
  name: string | null | undefined
): MerchProductCategory => {
  const normalizedType =
    productType?.toUpperCase().replaceAll(/[^A-Z0-9]/gu, "") ?? "";

  if (APPAREL_TYPES.has(normalizedType)) {
    return "Apparel";
  }

  if (ACCESSORY_TYPES.has(normalizedType)) {
    return "Accessories";
  }

  const label = name ?? "";

  if (APPAREL_PATTERN.test(label)) {
    return "Apparel";
  }

  if (ACCESSORY_PATTERN.test(label)) {
    return "Accessories";
  }

  return "Home & living";
};

export interface PublicMerchDesign {
  artistName: string | null;
  artistUsername: string | null;
  brand: string | null;
  catalogProductId: string;
  catalogProductName: string | null;
  category: MerchProductCategory;
  description: string | null;
  id: string;
  mockups: {
    catalogVariantId: string;
    mockupUrl: string;
  }[];
  placement: string;
  previewMockupUrl: string | null;
  printfulVariantIds: string[];
  productType: string | null;
  projectId: string | null;
  publishedAt: string | null;
  retailPriceCents: number;
  technique: string;
  title: string;
  trackId: string | null;
  variantDetails: {
    color: string | null;
    colorCode: string | null;
    id: string;
    inStock: boolean;
    mockupUrl: string | null;
    size: string | null;
  }[];
}

export interface PublicPhysicalSiblingFormat {
  id: string;
  includesDigitalDownload: boolean;
  mediaFormat: PhysicalMediaFormat | "digital";
  retailPriceCents: number;
  title: string;
}

export interface PublicPhysicalRelease {
  artistName: string | null;
  artistUsername: string | null;
  coverArtUrl: string | null;
  createdAt: string;
  currency: string;
  description: string | null;
  genreName: string | null;
  genreSlug: string | null;
  id: string;
  includesDigitalDownload: boolean;
  mediaFormat: PhysicalMediaFormat;
  projectId: string | null;
  projectTitle: string | null;
  retailPriceCents: number;
  siblingFormats: PublicPhysicalSiblingFormat[];
  title: string;
  trackId: string | null;
  videoId: string | null;
}

/**
 * Lists published merch designs with their completed mockup URLs,
 * catalog metadata, variant details, and artist attribution. Backs
 * the /shop storefront, /shop/$id detail page, artist profiles,
 * project pages, and soundkit.bio.
 */
export const listPublicMerch = async ({
  artistUsername,
  catalogProductId,
  designId,
  limit = 24,
  projectId,
  trackId,
}: {
  artistUsername?: string;
  catalogProductId?: string;
  designId?: string;
  limit?: number;
  projectId?: string;
  trackId?: string;
} = {}) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = createDb(),
    designs = await db
      .select({
        artistName: userProfiles.displayName,
        artistUsername: userProfiles.username,
        brand: merchCatalogProducts.brand,
        catalogProductName: merchCatalogProducts.name,
        design: merchDesigns,
        productType: merchCatalogProducts.type,
      })
      .from(merchDesigns)
      .leftJoin(userProfiles, eq(userProfiles.userId, merchDesigns.ownerUserId))
      .leftJoin(
        merchCatalogProducts,
        eq(merchCatalogProducts.id, merchDesigns.printfulCatalogProductId)
      )
      .where(
        and(
          eq(merchDesigns.status, "published"),
          ...(artistUsername
            ? [eq(userProfiles.username, artistUsername)]
            : []),
          ...(catalogProductId
            ? [eq(merchDesigns.printfulCatalogProductId, catalogProductId)]
            : []),
          ...(designId ? [eq(merchDesigns.id, designId)] : []),
          ...(projectId ? [eq(merchDesigns.projectId, projectId)] : []),
          ...(trackId ? [eq(merchDesigns.trackId, trackId)] : [])
        )
      )
      .orderBy(desc(merchDesigns.publishedAt))
      .limit(limit);

  if (designs.length === 0) {
    return [];
  }

  const designIds = designs.map((row) => row.design.id),
    mockups = await db
      .select({
        catalogVariantId: merchMockups.catalogVariantId,
        merchDesignId: merchMockups.merchDesignId,
        mockupUrl: merchMockups.mockupUrl,
      })
      .from(merchMockups)
      .where(
        and(
          inArray(merchMockups.merchDesignId, designIds),
          eq(merchMockups.status, "completed")
        )
      ),
    variantIds = [
      ...new Set(mockups.map((m) => m.catalogVariantId).filter(Boolean)),
    ],
    variants =
      variantIds.length > 0
        ? await db
            .select({
              color: merchCatalogVariants.color,
              colorCode: merchCatalogVariants.colorCode,
              id: merchCatalogVariants.id,
              image: merchCatalogVariants.image,
              inStock: merchCatalogVariants.inStock,
              size: merchCatalogVariants.size,
            })
            .from(merchCatalogVariants)
            .where(inArray(merchCatalogVariants.id, variantIds))
        : [],
    variantMap = new Map(variants.map((v) => [v.id, v]));

  return designs.map((row) => {
    const designMockups = mockups.filter(
        (m) => m.merchDesignId === row.design.id
      ),
      mockupByVariantId = new Map(
        designMockups
          .filter((m): m is typeof m & { mockupUrl: string } =>
            Boolean(m.mockupUrl)
          )
          .map((m) => [m.catalogVariantId, m.mockupUrl])
      ),
      designVariantIds = designMockups
        .map((m) => m.catalogVariantId)
        .filter(Boolean),
      variantDetails = designVariantIds
        .map((id) => variantMap.get(id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
        .map((v) => ({
          color: v.color,
          colorCode: v.colorCode,
          id: v.id,
          inStock: v.inStock,
          mockupUrl: mockupByVariantId.get(v.id) ?? v.image ?? null,
          size: v.size,
        })),
      completedMockups = designMockups
        .filter((m): m is typeof m & { mockupUrl: string } =>
          Boolean(m.mockupUrl)
        )
        .map((m) => ({
          catalogVariantId: m.catalogVariantId,
          mockupUrl: m.mockupUrl,
        }));

    return {
      artistName: row.artistName ?? null,
      artistUsername: row.artistUsername ?? null,
      brand: row.brand ?? null,
      catalogProductId: row.design.printfulCatalogProductId ?? "",
      catalogProductName: row.catalogProductName ?? null,
      category: classifyMerchCategory(
        row.productType,
        row.catalogProductName ?? row.design.title
      ),
      description: row.design.description,
      id: row.design.id,
      mockups: completedMockups,
      placement: row.design.placement,
      previewMockupUrl: completedMockups[0]?.mockupUrl ?? null,
      printfulVariantIds: designVariantIds,
      productType: row.productType ?? null,
      projectId: row.design.projectId,
      publishedAt: row.design.publishedAt?.toISOString() ?? null,
      retailPriceCents: row.design.retailPriceCents,
      technique: row.design.technique,
      title: row.design.title,
      trackId: row.design.trackId,
      variantDetails,
    } satisfies PublicMerchDesign;
  });
};

/**
 * Lists published Kunaki physical media releases (12" Vinyl, 7" Vinyl, CD, DVD)
 * with resolved album/video artwork, artist attribution, genre metadata, and
 * sibling formats for the same project/track/video.
 */
export const listPublicPhysicalReleases = async ({
  artistUsername,
  limit = 48,
  mediaFormat,
  projectId,
  releaseId,
  trackId,
  videoId,
}: {
  artistUsername?: string;
  limit?: number;
  mediaFormat?: PhysicalMediaFormat;
  projectId?: string;
  releaseId?: string;
  trackId?: string;
  videoId?: string;
} = {}): Promise<PublicPhysicalRelease[]> => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = createDb(),
    rows = await db
      .select({
        artistName: userProfiles.displayName,
        artistUsername: userProfiles.username,
        projectGenreId: projects.genreId,
        projectIsForSale: projects.isForSale,
        projectPriceCents: projects.priceCents,
        projectTitle: projects.title,
        release: physicalReleases,
        trackGenreId: tracks.genreId,
        trackIsForSale: tracks.isForSale,
        trackPriceCents: tracks.priceCents,
        trackTitle: tracks.title,
        videoGenreId: videos.genreId,
        videoThumbnailUrl: videos.thumbnailUrl,
        videoTitle: videos.title,
      })
      .from(physicalReleases)
      .leftJoin(
        userProfiles,
        eq(userProfiles.userId, physicalReleases.ownerUserId)
      )
      .leftJoin(projects, eq(projects.id, physicalReleases.projectId))
      .leftJoin(tracks, eq(tracks.id, physicalReleases.trackId))
      .leftJoin(videos, eq(videos.id, physicalReleases.videoId))
      .where(
        and(
          eq(physicalReleases.status, "published"),
          ...(artistUsername
            ? [eq(userProfiles.username, artistUsername)]
            : []),
          ...(mediaFormat
            ? [eq(physicalReleases.mediaFormat, mediaFormat)]
            : []),
          ...(projectId ? [eq(physicalReleases.projectId, projectId)] : []),
          ...(releaseId ? [eq(physicalReleases.id, releaseId)] : []),
          ...(trackId ? [eq(physicalReleases.trackId, trackId)] : []),
          ...(videoId ? [eq(physicalReleases.videoId, videoId)] : [])
        )
      )
      .orderBy(desc(physicalReleases.createdAt))
      .limit(limit);

  if (rows.length === 0) {
    return [];
  }

  const projectIds = [
      ...new Set(
        rows
          .map((row) => row.release.projectId)
          .filter((id): id is string => Boolean(id))
      ),
    ],
    trackIds = [
      ...new Set(
        rows
          .map((row) => row.release.trackId)
          .filter((id): id is string => Boolean(id))
      ),
    ],
    genreIds = [
      ...new Set(
        rows
          .map(
            (row) => row.projectGenreId ?? row.trackGenreId ?? row.videoGenreId
          )
          .filter((id): id is string => Boolean(id))
      ),
    ],
    [projectCoverRows, trackCoverRows, genreRows, siblingRows] =
      await Promise.all([
        projectIds.length > 0
          ? db
              .select({
                metadata: projectAssets.metadata,
                objectKey: projectAssets.objectKey,
                projectId: projectAssets.projectId,
              })
              .from(projectAssets)
              .where(
                and(
                  inArray(projectAssets.projectId, projectIds),
                  eq(projectAssets.assetKind, "cover_art")
                )
              )
          : Promise.resolve([]),
        trackIds.length > 0
          ? db
              .select({
                metadata: trackAssets.metadata,
                objectKey: trackAssets.objectKey,
                trackId: trackAssets.trackId,
              })
              .from(trackAssets)
              .where(
                and(
                  inArray(trackAssets.trackId, trackIds),
                  eq(trackAssets.assetKind, "cover_art")
                )
              )
          : Promise.resolve([]),
        genreIds.length > 0
          ? db
              .select({
                id: genres.id,
                name: genres.name,
                slug: genres.slug,
              })
              .from(genres)
              .where(inArray(genres.id, genreIds))
          : Promise.resolve([]),
        projectIds.length > 0
          ? db
              .select({
                id: physicalReleases.id,
                includesDigitalDownload:
                  physicalReleases.includesDigitalDownload,
                mediaFormat: physicalReleases.mediaFormat,
                projectId: physicalReleases.projectId,
                retailPriceCents: physicalReleases.retailPriceCents,
                title: physicalReleases.title,
              })
              .from(physicalReleases)
              .where(
                and(
                  inArray(physicalReleases.projectId, projectIds),
                  eq(physicalReleases.status, "published")
                )
              )
          : Promise.resolve([]),
      ]),
    projectCoverMap = new Map(
      projectCoverRows.map((asset) => [
        asset.projectId,
        publicAssetUrlFromParts({
          metadata: asset.metadata,
          objectKey: asset.objectKey,
        }),
      ])
    ),
    trackCoverMap = new Map(
      trackCoverRows.map((asset) => [
        asset.trackId,
        publicAssetUrlFromParts({
          metadata: asset.metadata,
          objectKey: asset.objectKey,
        }),
      ])
    ),
    genreMap = new Map(genreRows.map((g) => [g.id, g]));

  return rows.map((row) => {
    const packagingKey =
        row.release.packagingAssets?.frontCoverKey ??
        row.release.packagingAssets?.outerJacketKey,
      packagingCoverUrl = packagingKey
        ? publicAssetUrlFromParts({ metadata: null, objectKey: packagingKey })
        : null,
      coverArtUrl =
        packagingCoverUrl ??
        (row.release.projectId
          ? (projectCoverMap.get(row.release.projectId) ?? null)
          : null) ??
        (row.release.trackId
          ? (trackCoverMap.get(row.release.trackId) ?? null)
          : null) ??
        row.videoThumbnailUrl ??
        null,
      genreId = row.projectGenreId ?? row.trackGenreId ?? row.videoGenreId,
      genre = genreId ? (genreMap.get(genreId) ?? null) : null,
      siblings: PublicPhysicalSiblingFormat[] = [];

    if (row.release.projectId) {
      for (const sibling of siblingRows) {
        if (sibling.projectId === row.release.projectId) {
          siblings.push({
            id: sibling.id,
            includesDigitalDownload: sibling.includesDigitalDownload,
            mediaFormat: sibling.mediaFormat,
            retailPriceCents: sibling.retailPriceCents,
            title: sibling.title,
          });
        }
      }

      if (row.projectIsForSale && typeof row.projectPriceCents === "number") {
        siblings.push({
          id: row.release.projectId,
          includesDigitalDownload: true,
          mediaFormat: "digital",
          retailPriceCents: row.projectPriceCents,
          title: row.projectTitle ?? row.release.title,
        });
      }
    } else {
      siblings.push({
        id: row.release.id,
        includesDigitalDownload: row.release.includesDigitalDownload,
        mediaFormat: row.release.mediaFormat,
        retailPriceCents: row.release.retailPriceCents,
        title: row.release.title,
      });

      if (
        row.release.trackId &&
        row.trackIsForSale &&
        typeof row.trackPriceCents === "number"
      ) {
        siblings.push({
          id: row.release.trackId,
          includesDigitalDownload: true,
          mediaFormat: "digital",
          retailPriceCents: row.trackPriceCents,
          title: row.trackTitle ?? row.release.title,
        });
      }
    }

    return {
      artistName: row.artistName ?? null,
      artistUsername: row.artistUsername ?? null,
      coverArtUrl,
      createdAt: row.release.createdAt.toISOString(),
      currency: row.release.currency,
      description: row.release.description,
      genreName: genre?.name ?? null,
      genreSlug: genre?.slug ?? null,
      id: row.release.id,
      includesDigitalDownload: row.release.includesDigitalDownload,
      mediaFormat: row.release.mediaFormat,
      projectId: row.release.projectId,
      projectTitle: row.projectTitle ?? null,
      retailPriceCents: row.release.retailPriceCents,
      siblingFormats: siblings,
      title: row.release.title,
      trackId: row.release.trackId,
      videoId: row.release.videoId,
    };
  });
};
