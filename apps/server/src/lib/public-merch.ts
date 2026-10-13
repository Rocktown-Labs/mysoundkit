import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { userProfiles } from "@soundkit/db/schema/app";
import {
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, desc, eq, inArray } from "drizzle-orm";

export interface PublicMerchDesign {
  artistName: string | null;
  artistUsername: string | null;
  catalogProductId: string;
  description: string | null;
  id: string;
  previewMockupUrl: string | null;
  printfulVariantIds: string[];
  projectId: string | null;
  retailPriceCents: number;
  title: string;
  trackId: string | null;
  variantDetails: {
    color: string | null;
    colorCode: string | null;
    id: string;
    inStock: boolean;
    size: string | null;
  }[];
}

/**
 * Lists published merch designs with their first completed mockup URL,
 * variant details, and artist attribution. Backs the /shop grid, artist
 * profiles, project pages, and soundkit.bio.
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
        design: merchDesigns,
      })
      .from(merchDesigns)
      .leftJoin(userProfiles, eq(userProfiles.userId, merchDesigns.ownerUserId))
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
      designVariantIds = designMockups
        .map((m) => m.catalogVariantId)
        .filter(Boolean),
      variantDetails = designVariantIds
        .map((id) => variantMap.get(id))
        .filter(Boolean)
        .map((v) => ({
          color: v!.color,
          colorCode: v!.colorCode,
          id: v!.id,
          inStock: v!.inStock,
          size: v!.size,
        }));

    return {
      artistName: row.artistName ?? null,
      artistUsername: row.artistUsername ?? null,
      catalogProductId: row.design.printfulCatalogProductId ?? "",
      description: row.design.description,
      id: row.design.id,
      previewMockupUrl:
        designMockups.find((m) => m.mockupUrl)?.mockupUrl ?? null,
      printfulVariantIds: designVariantIds,
      projectId: row.design.projectId,
      retailPriceCents: row.design.retailPriceCents,
      title: row.design.title,
      trackId: row.design.trackId,
      variantDetails,
    } satisfies PublicMerchDesign;
  });
};
