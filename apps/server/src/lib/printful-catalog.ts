/* eslint-disable sort-vars, one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  merchCatalogProducts,
  merchCatalogVariants,
} from "@soundkit/db/schema/fulfillment";
import { and, asc, eq, lt, sql } from "drizzle-orm";

import {
  getPrintfulCatalogProduct,
  getPrintfulCatalogVariants,
  getPrintfulMockupStyles,
  getPrintfulProductAvailability,
  getPrintfulProductPrices,
  getPrintfulVariantPrice,
  isPrintfulConfigured,
  printfulPriceToCents,
} from "@/lib/printful";
import type {
  PrintfulAvailabilityEntry,
  PrintfulCatalogProduct,
  PrintfulCatalogVariant,
  PrintfulMockupStyleGroup,
} from "@/lib/printful";
import { logWarn } from "@/middleware/structured-logging";

const CATALOG_SWEEP_BATCH_SIZE = 1,
  CATALOG_SWEEP_STALE_MS = 24 * 60 * 60 * 1000,
  MIN_RETAIL_CENTS_FLOOR = 1200,
  RETAIL_MARGIN_MULTIPLE_MAX = 3.2,
  RETAIL_MARGIN_MULTIPLE_MIN = 1.6,
  RETAIL_MIN_SPREAD_CENTS = 1500;

export interface RetailBoundsCents {
  retailMaxCents: number;
  retailMinCents: number;
}

/**
 * Default retail bounds derived from the cheapest variant base cost so an
 * admin can enable a new blank without pricing it by hand: the floor keeps a
 * healthy artist payout (base * 1.6) and the ceiling leaves headroom.
 */
export const defaultRetailBoundsCents = (
  cheapestBaseCents: number
): RetailBoundsCents => {
  const min = Math.max(
      MIN_RETAIL_CENTS_FLOOR,
      Math.ceil((cheapestBaseCents * RETAIL_MARGIN_MULTIPLE_MIN) / 100) * 100
    ),
    max = Math.max(
      min + RETAIL_MIN_SPREAD_CENTS,
      Math.ceil((cheapestBaseCents * RETAIL_MARGIN_MULTIPLE_MAX) / 100) * 100
    );

  return { retailMaxCents: max, retailMinCents: min };
};

export const validateRetailBoundsCents = ({
  retailMaxCents,
  retailMinCents,
}: RetailBoundsCents): { error?: string; valid: boolean } => {
  if (
    !Number.isInteger(retailMinCents) ||
    !Number.isInteger(retailMaxCents) ||
    retailMinCents < MIN_RETAIL_CENTS_FLOOR ||
    retailMaxCents <= retailMinCents
  ) {
    return {
      error: `Retail bounds must be integer cents with a minimum of $${(
        MIN_RETAIL_CENTS_FLOOR / 100
      ).toFixed(2)} and max above min.`,
      valid: false,
    };
  }

  return { valid: true };
};

// Printful's availability region names vary across docs and products
// ("usa", "worldwide", "north_america"). We match any of the known US
// labels and intentionally default to in-stock when none are present —
// the sync runs frequently enough that stale stock self-corrects.
const IN_STOCK_REGION_NAMES = new Set([
    "usa",
    "us",
    "worldwide",
    "north_america",
  ]),
  isUsaInStock = (entry: PrintfulAvailabilityEntry | undefined) => {
    for (const technique of entry?.techniques ?? []) {
      for (const region of technique.selling_regions ?? []) {
        if (IN_STOCK_REGION_NAMES.has(region.name ?? "")) {
          return region.availability === "in stock";
        }
      }
    }

    return true;
  },
  resolveVariantBasePriceCents = async (variantId: number) => {
    const price = await getPrintfulVariantPrice(variantId),
      techniquePrices = (price?.variant?.techniques ?? [])
        .map((technique) => printfulPriceToCents(technique.price))
        .filter((cents) => Number.isInteger(cents));

    if (techniquePrices.length === 0) {
      throw new Error(`No technique prices returned for variant ${variantId}.`);
    }

    // Cheapest technique is the conservative COGS snapshot — Printful's
    // confirm-time costs remain authoritative for exact reconciliation.
    return Math.min(...techniquePrices);
  },
  toPrintFileRules = (styleGroups: PrintfulMockupStyleGroup[]) => ({
    placements: styleGroups.map((group) => ({
      dpi: group.dpi ?? null,
      placement: group.placement,
      printAreaHeight: group.print_area_height ?? null,
      printAreaType: group.print_area_type ?? null,
      printAreaWidth: group.print_area_width ?? null,
      technique: group.technique ?? null,
    })),
  }),
  serializeCatalogProduct = (
    product: typeof merchCatalogProducts.$inferSelect
  ) => ({
    brand: product.brand,
    description: product.description,
    id: product.id,
    image: product.image,
    isCurated: product.isCurated,
    isDiscontinued: product.isDiscontinued,
    name: product.name,
    retailMaxCents: product.retailMaxCents,
    retailMinCents: product.retailMinCents,
    syncedAt: product.syncedAt.toISOString(),
    type: product.type,
  });

export interface SyncPrintfulCatalogInput {
  curated?: boolean;
  printfulProductId: number;
  retailMaxCents?: number;
  retailMinCents?: number;
}

interface SyncedCatalogData {
  availability: PrintfulAvailabilityEntry[];
  product: PrintfulCatalogProduct;
  styleGroups: PrintfulMockupStyleGroup[];
  variantPrices: Map<number, number>;
  variants: PrintfulCatalogVariant[];
}

const fetchSyncedCatalogData = async (
    printfulProductId: number
  ): Promise<SyncedCatalogData> => {
    const product = await getPrintfulCatalogProduct(printfulProductId);

    if (!product) {
      throw new Error(
        `Printful catalog product ${printfulProductId} was not found.`
      );
    }

    const [availability, styleGroups, variants] = await Promise.all([
      getPrintfulProductAvailability(printfulProductId).catch(() => []),
      getPrintfulMockupStyles(printfulProductId),
      getPrintfulCatalogVariants(printfulProductId),
    ]);

    if (variants.length === 0) {
      throw new Error(
        `Printful catalog product ${printfulProductId} has no variants.`
      );
    }

    // Bulk-fetch prices for the entire product in one request instead of
    // one per variant (Printful v2 supports /catalog-products/{id}/prices).
    const productPrices = await getPrintfulProductPrices(printfulProductId),
      variantPrices = new Map<number, number>();

    for (const variantPrice of productPrices?.variants ?? []) {
      const techniquePrices = (variantPrice.techniques ?? [])
        .map((technique) => printfulPriceToCents(technique.price))
        .filter((cents) => Number.isInteger(cents));

      if (techniquePrices.length > 0) {
        // Cheapest technique is the conservative COGS snapshot.
        variantPrices.set(variantPrice.id, Math.min(...techniquePrices));
      }
    }

    // Fall back to per-variant lookup if the bulk endpoint missed any.
    for (const variant of variants) {
      if (!variantPrices.has(variant.id)) {
        variantPrices.set(
          variant.id,
          await resolveVariantBasePriceCents(variant.id)
        );
      }
    }

    if (variantPrices.size === 0) {
      throw new Error(
        `Printful catalog product ${printfulProductId} has no variant prices.`
      );
    }

    return { availability, product, styleGroups, variantPrices, variants };
  },
  resolveCatalogBounds = async ({
    catalogProductId,
    retailMaxCents,
    retailMinCents,
    variantPrices,
  }: {
    catalogProductId?: string;
    retailMaxCents?: number;
    retailMinCents?: number;
    variantPrices: Map<number, number>;
  }) => {
    const cheapestBaseCents = Math.min(...variantPrices.values()),
      defaultBounds = defaultRetailBoundsCents(cheapestBaseCents);

    // A refresh/sweep passes no bounds — preserve whatever the admin set on
    // the existing row rather than resetting to defaults.
    if (
      retailMinCents === undefined &&
      retailMaxCents === undefined &&
      catalogProductId &&
      isDatabaseConfigured()
    ) {
      const db = createDb();
      const [existing] = await db
        .select({
          retailMaxCents: merchCatalogProducts.retailMaxCents,
          retailMinCents: merchCatalogProducts.retailMinCents,
        })
        .from(merchCatalogProducts)
        .where(eq(merchCatalogProducts.id, catalogProductId))
        .limit(1);

      if (existing) {
        const bounds = {
          retailMaxCents: existing.retailMaxCents,
          retailMinCents: existing.retailMinCents,
        };
        const validation = validateRetailBoundsCents(bounds);

        if (validation.valid) {
          return bounds;
        }
      }
    }

    const bounds = {
      retailMaxCents: retailMaxCents ?? defaultBounds.retailMaxCents,
      retailMinCents: retailMinCents ?? defaultBounds.retailMinCents,
    };
    const validation = validateRetailBoundsCents(bounds);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return bounds;
  },
  upsertCatalogProductRow = async ({
    bounds,
    curated,
    now,
    product,
    styleGroups,
  }: {
    bounds: RetailBoundsCents;
    curated: boolean;
    now: Date;
    product: PrintfulCatalogProduct;
    styleGroups: PrintfulMockupStyleGroup[];
  }) => {
    const values = {
        brand: product.brand ?? null,
        description: product.description ?? null,
        id: String(product.id),
        image: product.image ?? null,
        isCurated: curated,
        isDiscontinued: Boolean(product.is_discontinued),
        mockupStyleIds: styleGroups.flatMap(
          (group) => group.mockup_styles?.map((style) => style.id) ?? []
        ),
        name: product.name,
        placements: (product.placements ?? []) as unknown as Record<
          string,
          unknown
        >[],
        printFileRules: toPrintFileRules(styleGroups),
        retailMaxCents: bounds.retailMaxCents,
        retailMinCents: bounds.retailMinCents,
        syncedAt: now,
        techniques: (product.techniques ?? []) as unknown as Record<
          string,
          unknown
        >[],
        type: product.type ?? null,
      },
      { id: _productId, ...updateSet } = values,
      db = createDb();

    await db
      .insert(merchCatalogProducts)
      .values(values)
      .onConflictDoUpdate({ set: updateSet, target: merchCatalogProducts.id });
  },
  upsertCatalogVariantRow = async ({
    availabilityEntry,
    basePriceCents,
    now,
    product,
    variant,
  }: {
    availabilityEntry: PrintfulAvailabilityEntry | undefined;
    basePriceCents: number;
    now: Date;
    product: PrintfulCatalogProduct;
    variant: PrintfulCatalogVariant;
  }) => {
    const values = {
        availability: (availabilityEntry ?? null) as unknown as Record<
          string,
          unknown
        > | null,
        basePriceCents,
        catalogProductId: String(product.id),
        color: variant.color ?? null,
        colorCode: variant.color_code ?? null,
        id: String(variant.id),
        image: variant.image ?? null,
        inStock: isUsaInStock(availabilityEntry),
        name: variant.name,
        size: variant.size ?? null,
        syncedAt: now,
      },
      { id: _variantId, ...updateSet } = values,
      db = createDb();

    await db
      .insert(merchCatalogVariants)
      .values(values)
      .onConflictDoUpdate({ set: updateSet, target: merchCatalogVariants.id });
  };

/**
 * Pulls a Printful catalog product (product, variants, per-variant prices,
 * mockup styles, availability) into our cache tables and upserts it, so
 * admins can enable any Printful blank on demand. Idempotent by primary key.
 */
export const syncPrintfulCatalogProduct = async ({
  curated = true,
  printfulProductId,
  retailMaxCents,
  retailMinCents,
}: SyncPrintfulCatalogInput) => {
  if (!(isDatabaseConfigured() && isPrintfulConfigured())) {
    throw new Error(
      "Printful catalog sync is not configured (missing PRINTFUL_API_KEY)."
    );
  }

  const { availability, product, styleGroups, variantPrices, variants } =
      await fetchSyncedCatalogData(printfulProductId),
    availabilityByVariant = new Map(
      availability.map((entry) => [entry.catalog_variant_id, entry])
    ),
    bounds = await resolveCatalogBounds({
      catalogProductId: String(printfulProductId),
      retailMaxCents,
      retailMinCents,
      variantPrices,
    }),
    now = new Date();

  await upsertCatalogProductRow({ bounds, curated, now, product, styleGroups });

  for (const variant of variants) {
    await upsertCatalogVariantRow({
      availabilityEntry: availabilityByVariant.get(variant.id),
      basePriceCents: variantPrices.get(variant.id) ?? 0,
      now,
      product,
      variant,
    });
  }

  const db = createDb(),
    [row] = await db
      .select()
      .from(merchCatalogProducts)
      .where(eq(merchCatalogProducts.id, String(product.id)))
      .limit(1);

  return {
    cheapestBaseCents: Math.min(...variantPrices.values()),
    product: row ? serializeCatalogProduct(row) : null,
    variantCount: variants.length,
  };
};

export const listPrintfulCatalogRows = async () => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const db = createDb(),
    rows = await db
      .select({
        inStockCount: sql<number>`count(*) filter (where ${merchCatalogVariants.inStock})`,
        minBasePriceCents: sql<number>`coalesce(min(${merchCatalogVariants.basePriceCents}), 0)`,
        product: merchCatalogProducts,
        variantCount: sql<number>`count(${merchCatalogVariants.id})`,
      })
      .from(merchCatalogProducts)
      .leftJoin(
        merchCatalogVariants,
        eq(merchCatalogVariants.catalogProductId, merchCatalogProducts.id)
      )
      .groupBy(merchCatalogProducts.id)
      .orderBy(asc(merchCatalogProducts.name));

  return rows.map((row) => ({
    ...serializeCatalogProduct(row.product),
    inStockCount: Number(row.inStockCount),
    minBasePriceCents: Number(row.minBasePriceCents),
    variantCount: Number(row.variantCount),
  }));
};

export const setPrintfulCatalogProductState = async ({
  catalogProductId,
  curated,
  retailMaxCents,
  retailMinCents,
}: {
  catalogProductId: string;
  curated?: boolean;
  retailMaxCents?: number;
  retailMinCents?: number;
}) => {
  const db = createDb(),
    [existing] = await db
      .select()
      .from(merchCatalogProducts)
      .where(eq(merchCatalogProducts.id, catalogProductId))
      .limit(1);

  if (!existing) {
    throw new Error("Catalog product is not synced.");
  }

  const bounds = {
      retailMaxCents: retailMaxCents ?? existing.retailMaxCents,
      retailMinCents: retailMinCents ?? existing.retailMinCents,
    },
    validation = validateRetailBoundsCents(bounds);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const [row] = await db
    .update(merchCatalogProducts)
    .set({
      ...(curated === undefined ? {} : { isCurated: curated }),
      retailMaxCents: bounds.retailMaxCents,
      retailMinCents: bounds.retailMinCents,
    })
    .where(eq(merchCatalogProducts.id, catalogProductId))
    .returning();

  return row ? serializeCatalogProduct(row) : null;
};

/**
 * Scheduled safety net: refreshes a small batch of stale curated products per
 * run (the cron fires every 5 minutes) so the daily refresh trickles without
 * ever threatening the 120 req/min leaky bucket.
 */
export const runPrintfulCatalogSweep = async () => {
  if (!(isDatabaseConfigured() && isPrintfulConfigured())) {
    return { refreshed: [] as string[] };
  }

  const db = createDb(),
    refreshed: string[] = [],
    staleBefore = new Date(Date.now() - CATALOG_SWEEP_STALE_MS),
    staleRows = await db
      .select({ id: merchCatalogProducts.id })
      .from(merchCatalogProducts)
      .where(
        and(
          eq(merchCatalogProducts.isCurated, true),
          lt(merchCatalogProducts.syncedAt, staleBefore)
        )
      )
      .limit(CATALOG_SWEEP_BATCH_SIZE);

  for (const row of staleRows) {
    try {
      await syncPrintfulCatalogProduct({
        curated: true,
        printfulProductId: Number(row.id),
      });
      refreshed.push(row.id);
    } catch (error) {
      logWarn({
        error: error instanceof Error ? error.message : String(error),
        event: "printful_catalog_sweep_failed",
        productId: row.id,
      });
    }
  }

  return { refreshed };
};
